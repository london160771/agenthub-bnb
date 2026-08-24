/**
 * HTTP layer for hire records. Parses and validates the request body, enforces
 * the testnet-only safety rules, and delegates to executionService.
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
  getHireableAgent,
  resetForRetry,
  HIRE_CHAIN_ID,
} from '../services/executionService.js';
import { ApiError, sendSuccess, asyncHandler } from '../utils/apiResponse.js';

/** Shape check only — this is not an EIP-55 checksum validation. */
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const MAX_TASK_LENGTH = 300;
const MAX_INPUT_KEYS = 12;
// Generous enough for the optional free-text "notes" field the hire form offers,
// while still bounding what a single value can write into the record.
const MAX_INPUT_VALUE_LENGTH = 500;

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
      if (value.length > MAX_INPUT_VALUE_LENGTH) {
        throw ApiError.badRequest(
          `"input.${key}" must be ${MAX_INPUT_VALUE_LENGTH} characters or fewer.`,
        );
      }
      out[key] = value.trim();
    } else {
      throw ApiError.badRequest(`"input.${key}" must be a string, number or boolean.`);
    }
  }
  return out;
}

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

  /**
   * Wrong-network / accidental-mainnet safeguard (AGENTS.md). The client tells
   * us which chain its wallet is on; anything that isn't BNB testnet is
   * refused outright rather than quietly accepted.
   */
  if (body.chainId != null) {
    const chainId = Number(body.chainId);
    if (!Number.isInteger(chainId)) {
      throw ApiError.badRequest('"chainId" must be a number.');
    }
    if (chainId !== HIRE_CHAIN_ID) {
      throw ApiError.badRequest(
        `Hiring is only available on BNB Smart Chain Testnet (chain ${HIRE_CHAIN_ID}). ` +
          'This build never hires on mainnet or any other network.',
        { received: chainId, expected: HIRE_CHAIN_ID },
      );
    }
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
  sendSuccess(res, execution, 201);
});

/**
 * POST /api/executions/:executionId/run — start (or retry) the agent's work.
 *
 * Responds as soon as the run is claimed rather than waiting for it to finish, so
 * the client can render the timeline while it happens. A `failed` execution is
 * reset and re-run, which makes this the retry endpoint too — safe because a run
 * only reads the chain and writes this record. Nothing is charged or broadcast.
 */
export const postExecutionRun = asyncHandler(async (req, res) => {
  ensureDb();
  const executionId = String(req.params.executionId);

  const existing = await getExecutionById(executionId);
  if (!existing) {
    throw ApiError.notFound(`No execution found with id "${executionId}".`);
  }

  if (existing.status === 'failed') {
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
