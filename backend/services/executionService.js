/**
 * Write + read logic for hire records ("executions").
 *
 * Phase 5 (HIRE) only *creates* the record: every execution starts `pending`
 * with a seeded timeline. Advancing it belongs to Phase 6 (EXECUTE).
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

const PROJECTION = '-__v -_id';

/** The only network this build hires on. Testnet-only — see AGENTS.md. */
export const HIRE_CHAIN = 'bnb-testnet';
/** BNB Smart Chain Testnet, verified against official BNB Chain docs. */
export const HIRE_CHAIN_ID = 97;

/** Window in which an identical hire is treated as an accidental double-submit. */
const DUPLICATE_WINDOW_MS = 15_000;

/**
 * The timeline the execution page will render. At creation only `queued` is
 * done, because queuing is the only thing that has actually happened — the
 * remaining steps are honestly `pending` until Phase 6 runs them.
 */
const STEP_TEMPLATE = [
  { key: 'queued', label: 'Hire queued' },
  { key: 'validate', label: 'Validating task input' },
  { key: 'fetch', label: 'Reading on-chain data' },
  { key: 'analyse', label: 'Running agent analysis' },
  { key: 'report', label: 'Preparing result' },
];

function buildSteps(now) {
  return STEP_TEMPLATE.map((step, i) => ({
    ...step,
    state: i === 0 ? 'done' : 'pending',
    at: i === 0 ? now : null,
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
  const doc = {
    executionId: newExecutionId(),
    agentId,
    userAddress,
    task,
    input,
    steps: buildSteps(now),
    status: 'pending',
    // Server-authoritative price: whatever the agent actually charges.
    cost: agent.pricing?.amount ?? 0,
    currency: agent.pricing?.currency || 'BNB',
    chain: HIRE_CHAIN,
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
