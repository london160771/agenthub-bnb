/**
 * Write + read logic for hire records ("executions").
 *
 * Creating a record leaves it `pending`; `executionRunner.js` is what advances it
 * to `running` and then `completed`/`failed`.
 *
 * Two deliberate safety properties live here rather than in the controller,
 * because they must hold for every caller:
 *   1. Cost is read from the agent document on the server, never from the
 *      request body — a tampered client cannot change what a hire costs.
 *   2. The network is a server constant, and no transaction hash is invented.
 */
import { randomUUID } from 'node:crypto';
import { Agent } from '../models/Agent.js';
import { Execution } from '../models/Execution.js';
import { isExternallyExecutableAgent } from './agentCapabilities.js';

const PROJECTION = '-__v -_id';

/** The only network this build hires on. Testnet-only — see AGENTS.md. */
export const HIRE_CHAIN = 'bnb-testnet';
/** BNB Smart Chain Testnet, verified against official BNB Chain docs. */
export const HIRE_CHAIN_ID = 97;
/**
 * What the fee is actually denominated in on this network.
 *
 * Seeded agents declare their price in "BNB" because that is the chain's asset
 * name, but the testnet's native token is tBNB — a valueless test token. Storing
 * "BNB" would have the record disagree with every screen that (correctly) says
 * tBNB, and would overstate what a hire costs. The chain decides the label.
 */
export const HIRE_CURRENCY = 'tBNB';

/** Window in which an identical hire is treated as an accidental double-submit. */
const DUPLICATE_WINDOW_MS = 15_000;

/**
 * The timeline the execution page renders, using the step names from the spec.
 *
 * The first three are marked `done` the moment the record is created, because
 * they are genuinely already true: the hire happened, the task was received, and
 * the wallet address and chain id were validated before we got here. The last
 * three are the actual work and stay `pending` until the runner does them.
 */
const STEP_TEMPLATE = [
  { key: 'hired', label: 'Agent hired', atCreate: true },
  { key: 'received', label: 'Task received', atCreate: true },
  { key: 'wallet', label: 'Wallet verified', atCreate: true },
  { key: 'query', label: 'Querying on-chain data' },
  { key: 'analyse', label: 'Analyzing' },
  { key: 'report', label: 'Generating result' },
];

/** Steps the runner advances, in order. */
export const RUN_STEP_KEYS = STEP_TEMPLATE.filter((s) => !s.atCreate).map((s) => s.key);

function buildSteps(now, external = false) {
  return STEP_TEMPLATE.map(({ key, label, atCreate }) => ({
    key,
    label: external && key === 'query' ? 'Calling external agent' : label,
    state: atCreate ? 'done' : 'pending',
    at: atCreate ? now : null,
  }));
}

function newExecutionId() {
  return `exe_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

/** Drop Mongo internals so responses match the shape of every other endpoint. */
function toPublic(doc) {
  const obj = doc.toObject();
  delete obj.__v;
  delete obj._id;
  return obj;
}

/** The agent being hired. Returns null when the id is unknown. */
export async function getHireableAgent(agentId) {
  return Agent.findOne({ agentId }).select(PROJECTION).lean();
}

export async function getExecutionById(executionId) {
  return Execution.findOne({ executionId }).select(PROJECTION).lean();
}

/**
 * The mutable Mongoose document (not a lean object) — the runner needs to save
 * step-by-step progress, so it works on the live document rather than a copy.
 */
export async function getExecutionDoc(executionId) {
  return Execution.findOne({ executionId });
}

/**
 * Atomically claim a pending execution for running. Returns the document if this
 * call won the claim, or null if it was already claimed/finished — so two
 * concurrent run requests can't execute the same hire twice.
 *
 * `startedAt` is written here, in the same atomic update as the status flip,
 * because this instant IS the start of work. Recording it anywhere else would
 * either miss a run that dies early or drift from the status it describes. The
 * runner then measures against the stored timestamp, so the persisted duration
 * and the persisted timestamps always agree.
 */
export async function claimForRun(executionId) {
  const now = new Date();
  return Execution.findOneAndUpdate(
    { executionId, status: 'pending' },
    {
      $set: {
        status: 'running',
        startedAt: now,
        'steps.$[query].state': 'active',
        'steps.$[query].at': now,
      },
    },
    {
      new: true,
      arrayFilters: [{ 'query.key': 'query' }],
    },
  );
}

/**
 * Put a failed execution back to `pending` so it can be run again.
 *
 * Retries are safe here precisely because a run has no side effects beyond this
 * record: it reads the chain and writes a result. Nothing was charged, nothing
 * was sent, so re-running cannot double-anything.
 *
 * Only `failed` is eligible — a `completed` execution keeps its result, and a
 * `running` one is someone else's in-flight work.
 */
export async function resetForRetry(executionId) {
  const doc = await Execution.findOne({ executionId, status: 'failed' });
  if (!doc) return null;

  for (const step of doc.steps) {
    if (RUN_STEP_KEYS.includes(step.key)) {
      step.state = 'pending';
      step.at = null;
    }
  }
  doc.markModified('steps');
  doc.status = 'pending';
  doc.errorMessage = '';
  doc.output = null;
  doc.durationMs = null;
  // Cleared with the rest of the measurements: a retry's timing and read count
  // must describe the new run, not blend it with the attempt that failed.
  doc.startedAt = null;
  doc.rpcCallCount = null;
  doc.completedAt = null;
  await doc.save();
  return doc;
}

/**
 * An identical, still-pending hire from the same wallet in the last few
 * seconds — almost always a double-click or a resubmitted form.
 */
export async function findRecentDuplicate({ userAddress, agentId, task }) {
  return Execution.findOne({
    userAddress: String(userAddress).toLowerCase(),
    agentId,
    task,
    status: 'pending',
    createdAt: { $gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
  })
    .select(PROJECTION)
    .lean();
}

/**
 * Create the hire record.
 *
 * @param {object} args
 * @param {string} args.agentId
 * @param {string} args.userAddress  Validated 0x address (stored lowercase).
 * @param {string} args.task         Human-readable summary of the request.
 * @param {object} args.input        Structured task configuration.
 * @param {object} args.agent        Already-loaded agent — the price source.
 */
export async function createExecution({ agentId, userAddress, task, input, agent }) {
  const now = new Date();
  const external = isExternallyExecutableAgent(agent);
  const doc = {
    executionId: newExecutionId(),
    agentId,
    userAddress,
    task,
    input,
    steps: buildSteps(now, external),
    status: 'pending',
    // Server-authoritative price: whatever the agent actually charges.
    cost: agent.pricing?.amount ?? 0,
    // Testnet fees are in tBNB regardless of how the agent labels its price.
    currency: external ? 'none' : HIRE_CURRENCY,
    chain: external ? 'bnb-mainnet' : HIRE_CHAIN,
    // Nothing is signed or broadcast in this phase, so there is no hash to
    // record. Left empty rather than fabricated.
    transactionHash: '',
  };

  try {
    return toPublic(await Execution.create(doc));
  } catch (err) {
    // executionId has a unique index; a collision is astronomically unlikely
    // but cheap to survive.
    if (err?.code === 11000) {
      return toPublic(await Execution.create({ ...doc, executionId: newExecutionId() }));
    }
    throw err;
  }
}
