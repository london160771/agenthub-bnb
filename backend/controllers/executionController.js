/**
 * HTTP layer for hire records. Parses and validates the request body, enforces
 * local testnet / paid Mainnet network rules, and delegates to executionService.
 *
 * Mirrors agentController: ensureDb() guard, asyncHandler wrapper, ApiError
 * factories for failures.
 */
import { isDbConnected } from '../config/db.js';
import { runExecution } from '../services/executionRunner.js';
import {
  createExecution,
  findRecentDuplicate,
  getExecutionById,
  listCompletedExecutions,
  getHireableAgent,
  redactExecutionForPublic,
  resetForRetry,
  HIRE_CHAIN_ID,
} from '../services/executionService.js';
import { ApiError, sendSuccess, asyncHandler } from '../utils/apiResponse.js';
import {
  getAgentCapability,
  AGENT_CAPABILITIES,
} from '../services/agentCapabilities.js';
import { isPaidExecutionEligibleAgent } from '../services/adapters/registry.js';
import { prepareExecution } from '../services/executionPreparationService.js';

/** Shape check only — this is not an EIP-55 checksum validation. */
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const MAX_TASK_LENGTH = 300;
const MAX_INPUT_KEYS = 12;
// Generous enough for the optional free-text "notes" field the hire form offers,
// while still bounding what a single value can write into the record.
const MAX_INPUT_VALUE_LENGTH = 500;
const MAX_SOLIDITY_SOURCE_LENGTH = 50_000;

function ensureDb() {
  if (!isDbConnected()) {
    throw ApiError.unavailable('The marketplace database is not available right now.');
  }
}

/**
 * Structural validation of the task configuration: shape, size and types.
 *
 * Deliberately generic. The category-specific rules (which fields exist for a
 * research agent vs. a trading agent) live in frontend/src/lib/hire.js where
 * the field schema is declared; re-encoding them here would guarantee drift
 * between the two copies. The backend's job is to refuse anything malformed or
 * oversized, and to store only primitives.
 */
function parseInput(raw) {
  if (raw == null) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw ApiError.badRequest('"input" must be an object.');
  }

  const entries = Object.entries(raw);
  if (entries.length > MAX_INPUT_KEYS) {
    throw ApiError.badRequest(`"input" may contain at most ${MAX_INPUT_KEYS} fields.`);
  }

  const out = {};
  for (const [key, value] of entries) {
    // Skip empties so optional fields don't clutter the stored record.
    if (value == null || value === '') continue;

    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        throw ApiError.badRequest(`"input.${key}" must be a finite number.`);
      }
      out[key] = value;
    } else if (typeof value === 'boolean') {
      out[key] = value;
    } else if (typeof value === 'string') {
      const maxLength = key === 'solidityCode' ? MAX_SOLIDITY_SOURCE_LENGTH : MAX_INPUT_VALUE_LENGTH;
      if (value.length > maxLength) {
        throw ApiError.badRequest(
          `"input.${key}" must be ${maxLength} characters or fewer.`,
        );
      }
      out[key] = value.trim();
    } else {
      throw ApiError.badRequest(`"input.${key}" must be a string, number or boolean.`);
    }
  }
  return out;
}

/** GET /api/executions?userAddress=0x... — completed activity for one wallet. */
export const getExecutions = asyncHandler(async (req, res) => {
  ensureDb();
  const userAddress = typeof req.query.userAddress === 'string' ? req.query.userAddress.trim() : '';
  if (!ADDRESS_RE.test(userAddress)) {
    throw ApiError.badRequest('"userAddress" must be a 0x-prefixed, 40-character wallet address.');
  }

  const rawLimit = req.query.limit == null ? 20 : Number(req.query.limit);
  if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 50) {
    throw ApiError.badRequest('"limit" must be an integer from 1 to 50.');
  }

  const items = await listCompletedExecutions({ userAddress, limit: rawLimit });
  sendSuccess(res, { items, total: items.length });
});

/** POST /api/executions/prepare — normalize a safe next step without running it. */
export const postExecutionPreparation = asyncHandler(async (req, res) => {
  ensureDb();
  const body = req.body || {};
  const agentId = typeof body.agentId === 'string' ? body.agentId.trim() : '';
  if (!agentId) throw ApiError.badRequest('"agentId" is required.');

  const task = typeof body.task === 'string' ? body.task.trim() : '';
  if (!task) throw ApiError.badRequest('"task" is required.');
  if (task.length > MAX_TASK_LENGTH) {
    throw ApiError.badRequest(`"task" must be ${MAX_TASK_LENGTH} characters or fewer.`);
  }

  const input = parseInput(body.input);
  const walletAddress = typeof body.userAddress === 'string' ? body.userAddress.trim() : null;
  const agent = await getHireableAgent(agentId);
  if (!agent) throw ApiError.notFound(`No agent found with id "${agentId}".`);

  sendSuccess(res, prepareExecution({ agent, task, input, walletAddress }));
});

/** POST /api/executions — hire an agent (creates a pending execution). */
export const postExecution = asyncHandler(async (req, res) => {
  ensureDb();
  const body = req.body || {};

  const agentId = typeof body.agentId === 'string' ? body.agentId.trim() : '';
  if (!agentId) throw ApiError.badRequest('"agentId" is required.');

  const userAddress = typeof body.userAddress === 'string' ? body.userAddress.trim() : '';
  if (!ADDRESS_RE.test(userAddress)) {
    throw ApiError.badRequest(
      '"userAddress" must be a 0x-prefixed, 40-character wallet address.',
    );
  }

  const task = typeof body.task === 'string' ? body.task.trim() : '';
  if (!task) throw ApiError.badRequest('"task" is required.');
  if (task.length > MAX_TASK_LENGTH) {
    throw ApiError.badRequest(`"task" must be ${MAX_TASK_LENGTH} characters or fewer.`);
  }

  const input = parseInput(body.input);

  const agent = await getHireableAgent(agentId);
  if (!agent) throw ApiError.notFound(`No agent found with id "${agentId}".`);
  if (agent.status === 'paused') {
    throw ApiError.conflict(`"${agent.name}" is paused and is not accepting new work right now.`);
  }
  const capability = getAgentCapability(agent);
  const external = capability === AGENT_CAPABILITIES.INDEXED_EXECUTABLE_FREE;
  const paidExecutionEligible = isPaidExecutionEligibleAgent(agent);
  const paid = paidExecutionEligible;
  const remote = external || paidExecutionEligible;
  if (capability !== AGENT_CAPABILITIES.LOCAL_EXECUTABLE && !remote) {
    const reason = capability === AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID_READY && !paidExecutionEligible
      ? 'This is payment preflight only until a real paid task result is verified.'
      : 'Only exact allowlisted built-ins or independently verified external task adapters can run.';
    throw ApiError.badRequest(
      `"${agent.name}" is discoverable in AgentHub but is not executable here. ${reason}`,
    );
  }

  /**
   * Local hires are tied to the testnet wallet gate. Free external hires make a
   * read-only HTTP request to a verified Mainnet agent; paid external hires use
   * the backend-authoritative settlement chain for the separately confirmed
   * payment.
   */
  if (body.chainId != null) {
    const chainId = Number(body.chainId);
    if (!Number.isInteger(chainId)) throw ApiError.badRequest('"chainId" must be a number.');
    const paymentChainId = paid ? Number(agent.payment?.chainId) : null;
    const allowed = remote ? (paid ? [paymentChainId].filter(Number.isInteger) : [56, HIRE_CHAIN_ID]) : [HIRE_CHAIN_ID];
    if (!allowed.includes(chainId)) {
      throw ApiError.badRequest(
        remote
          ? paid
            ? `Paid external hires require the provider settlement network (chain ${paymentChainId || 'unknown'}) for the confirmed payment.`
            : 'External read-only hires accept a BSC Mainnet or Testnet wallet context; no transaction uses that wallet.'
          : `Hiring is only available on BNB Smart Chain Testnet (chain ${HIRE_CHAIN_ID}).`,
        { received: chainId, expected: allowed },
      );
    }
  }

  // Duplicate-submission safeguard: hand back the hire they already made.
  const duplicate = await findRecentDuplicate({ userAddress, agentId, task });
  if (duplicate) {
    throw ApiError.conflict(
      'You just submitted this exact hire. Open the existing one instead of running it twice.',
      { executionId: duplicate.executionId },
    );
  }

  // Note: any `cost`/`currency`/`chain`/`transactionHash` in the request body
  // is ignored — the service derives all of them.
  const execution = await createExecution({ agentId, userAddress, task, input, agent });
  sendSuccess(res, redactExecutionForPublic(execution), 201);
});

/**
 * POST /api/executions/:executionId/run — start (or retry) the agent's work.
 *
 * Responds as soon as the run is claimed rather than waiting for it to finish, so
 * the client can render the timeline while it happens. A `failed` execution is
 * reset and re-run, which makes this the retry endpoint too. Paid executions
 * must already carry a separately verified payment receipt.
 */
export const postExecutionRun = asyncHandler(async (req, res) => {
  ensureDb();
  const executionId = String(req.params.executionId);

  const existing = await getExecutionById(executionId);
  if (!existing) {
    throw ApiError.notFound(`No execution found with id "${executionId}".`);
  }

  if (existing.payment?.status === 'awaiting_confirmation') {
    throw ApiError.badRequest(
      'This paid task cannot run until its backend-verified payment is confirmed by AgentHub.',
    );
  }
  if (existing.payment?.protocol && existing.payment.status !== 'confirmed' && existing.payment.status !== 'none') {
    throw ApiError.badRequest('This paid task does not have a confirmed payment.');
  }

  if (existing.status === 'failed') {
    if (existing.payment?.status === 'confirmed') {
      throw ApiError.conflict(
        'This paid task cannot be retried with the same payment transaction. Start a new hire if the provider supports another paid attempt.',
      );
    }
    await resetForRetry(executionId);
  } else if (existing.status === 'running') {
    // Already in flight. Not an error — the client should just keep polling.
    return sendSuccess(res, { executionId, status: 'running', started: false });
  } else if (existing.status === 'completed') {
    throw ApiError.conflict(
      'This task has already completed. Hire the agent again to run a new task.',
      { executionId },
    );
  }

  // Deliberately not awaited: the run persists its own progress, and holding the
  // response open would leave the user watching a blank page instead of a timeline.
  runExecution(executionId).catch((err) => {
    // runExecution handles its own failures; this only catches a crash in the
    // claim itself, which must not become an unhandled rejection.
    console.error(`[execution ${executionId}] runner crashed:`, err);
  });

  sendSuccess(res, { executionId, status: 'running', started: true }, 202);
});

/** GET /api/executions/:executionId */
export const getExecution = asyncHandler(async (req, res) => {
  ensureDb();
  const execution = await getExecutionById(String(req.params.executionId));
  if (!execution) {
    throw ApiError.notFound(`No execution found with id "${req.params.executionId}".`);
  }
  sendSuccess(res, execution);
});
