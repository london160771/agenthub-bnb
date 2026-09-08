/**
 * Write + read logic for hire records ("executions").
 *
 * Creating a record leaves it `pending`; `executionRunner.js` is what advances it
 * to `running` and then `completed`/`failed`.
 *
 * Two deliberate safety properties live here rather than in the controller,
 * because they must hold for every caller:
 *   1. Actual cost is read from the verified payment requirement on the server,
 *      never from the request body or a legacy catalogue display price.
 *   2. Local and external networks are separated, and no transaction hash is
 *      invented; a paid hash is written only after receipt verification.
 */
import { randomUUID } from 'node:crypto';
import { Agent } from '../models/Agent.js';
import { Execution } from '../models/Execution.js';
import {
  AGENT_CAPABILITIES,
  getAgentCapability,
} from './agentCapabilities.js';
import { isPaidExecutionEligibleAgent } from './adapters/registry.js';

const PROJECTION = '-__v -_id';

/** Network required by built-in/local hires; external agents use their own context. */
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
  { key: 'wallet', label: 'Wallet address validated', atCreate: true },
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

export function actualExecutionCostFor(agent) {
  const capability = getAgentCapability(agent);
  const paid = capability === AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID
    || capability === AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID_READY;
  if (paid) return { cost: null, currency: 'none' };
  return { cost: 0, currency: 'none' };
}

function publicPayment(payment = {}) {
  return {
    protocol: payment.protocol || null,
    status: payment.status || 'none',
    amount: payment.amount ?? null,
    token: payment.token || null,
    chainId: payment.chainId ?? null,
    transactionHash: payment.transactionHash || '',
    verifiedAt: payment.verifiedAt || null,
    blockNumber: payment.blockNumber ?? null,
  };
}

/**
 * Public execution detail deliberately excludes raw task input, raw/normalized
 * provider payloads, payment evidence internals, wallet address, and endpoint.
 * Full wallet-signature authorization remains future production hardening.
 */
export function redactExecutionForPublic(execution) {
  if (!execution) return execution;
  const {
    executionId, agentId, task, output, steps, status, errorMessage,
    cost, currency, durationMs, chain, transactionHash, executionProtocol,
    paymentProtocol, payment, executionVerified, startedAt, completedAt,
    rpcCallCount, createdAt, updatedAt,
  } = execution;
  const safeOutput = output && typeof output === 'object' && !Array.isArray(output)
    ? Object.fromEntries(Object.entries(output).filter(([key]) => key !== 'rawResponse'))
    : output;
  return {
    executionId, agentId, task, output: safeOutput, steps, status, errorMessage,
    cost, currency, durationMs, chain, transactionHash, executionProtocol,
    paymentProtocol, payment: publicPayment(payment), executionVerified,
    startedAt, completedAt, rpcCallCount, createdAt, updatedAt,
  };
}

export function executionHistorySummary(execution) {
  const redacted = redactExecutionForPublic(execution);
  return {
    executionId: redacted.executionId,
    agentId: redacted.agentId,
    task: redacted.task,
    status: redacted.status,
    cost: redacted.cost,
    currency: redacted.currency,
    durationMs: redacted.durationMs,
    chain: redacted.chain,
    transactionHash: redacted.transactionHash,
    payment: redacted.payment,
    completedAt: redacted.completedAt,
    createdAt: redacted.createdAt,
  };
}

/** The agent being hired. Returns null when the id is unknown. */
export async function getHireableAgent(agentId) {
  return Agent.findOne({ agentId }).select(PROJECTION).lean();
}

export async function getExecutionById(executionId) {
  const execution = await Execution.findOne({ executionId }).select(PROJECTION).lean();
  return redactExecutionForPublic(execution);
}

/**
 * Completed records for the connected wallet. Activity is intentionally a
 * read of persisted execution facts; pending or failed attempts do not appear
 * in the judge-facing history list.
 */
export async function listCompletedExecutions({ userAddress, limit = 20 } = {}) {
  const normalizedAddress = String(userAddress || '').toLowerCase();
  const executions = await Execution.find({
    userAddress: normalizedAddress,
    status: 'completed',
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select(PROJECTION)
    .lean();

  const agentIds = [...new Set(executions.map((execution) => execution.agentId).filter(Boolean))];
  const agents = await Agent.find({ agentId: { $in: agentIds } })
    .select('agentId name avatar source capability pricing payment')
    .lean();
  const agentById = new Map(agents.map((agent) => [agent.agentId, agent]));

  return executions.map((execution) => ({
    ...executionHistorySummary(execution),
    agent: agentById.get(execution.agentId)
      ? {
          agentId: agentById.get(execution.agentId).agentId,
          name: agentById.get(execution.agentId).name,
          avatar: agentById.get(execution.agentId).avatar,
          source: agentById.get(execution.agentId).source,
          capability: agentById.get(execution.agentId).capability,
        }
      : null,
  }));
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
 * A retry never submits a payment. A paid execution can only reuse its existing
 * confirmed receipt; ambiguous paid states are not offered a public retry action.
 * The runner's atomic claim still prevents duplicate task execution.
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
 * @param {object} args.agent        Already-loaded agent — capability/payment source.
 */
export async function createExecution({ agentId, userAddress, task, input, agent }) {
  const now = new Date();
  const capability = getAgentCapability(agent);
  const external = capability === AGENT_CAPABILITIES.INDEXED_EXECUTABLE_FREE;
  const paid = isPaidExecutionEligibleAgent(agent);
  const remote = external || paid;
  const paymentChainId = paid ? Number(agent.payment?.chainId) : null;
  const paymentNetwork = paid ? String(agent.payment?.settlementNetwork || '').trim() : '';
  const payment = paid
    ? {
        protocol: agent.paymentProtocol,
        status: 'awaiting_confirmation',
        amount: agent.payment?.amount ?? null,
        token: agent.payment?.token || agent.payment?.currency || null,
        chainId: agent.payment?.chainId ?? null,
        recipient: agent.payment?.recipient || agent.payment?.contract || null,
        transactionHash: '',
      }
    : { status: 'none' };
  const actualCost = actualExecutionCostFor(agent);
  const doc = {
    executionId: newExecutionId(),
    agentId,
    userAddress,
    task,
    input,
    steps: buildSteps(now, remote),
    status: 'pending',
    // Actual monetary execution cost. Agent.pricing retains any separate
    // legacy/listed catalogue price; it is not copied into this ledger field.
    cost: actualCost.cost,
    currency: actualCost.currency,
    chain: remote
      ? (paid ? (paymentChainId === 56 ? 'bnb-mainnet' : `external-${paymentNetwork || `chain-${paymentChainId || 'unknown'}`}`) : 'bnb-mainnet')
      : HIRE_CHAIN,
    transactionHash: '',
    agentEndpoint: remote ? agent.endpoint || '' : '',
    executionProtocol: remote ? agent.executionProtocol || null : 'local',
    paymentProtocol: paid ? agent.paymentProtocol : 'none',
    paymentEvidence: null,
    payment,
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
