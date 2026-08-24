/**
 * Advances a hire from `pending` to `completed` (or `failed`).
 *
 * Two properties this file is built around:
 *
 * 1. NO ARTIFICIAL DELAY. Nothing here sleeps to make the timeline look busy.
 *    Each step is marked done when it is actually done, and `durationMs` is
 *    measured with a clock, not chosen. If a run takes 900ms, the page says 900ms.
 *
 * 2. EVERY TRANSITION IS PERSISTED. The runner saves after each step so a poll
 *    arriving mid-run sees real progress rather than a frozen record. That costs a
 *    few extra writes and buys a timeline that isn't theatre.
 *
 * The run is fire-and-forget from the controller's point of view: the HTTP
 * response returns as soon as the execution is claimed, and the client polls. A
 * request that waited for completion would hold a connection open for the whole
 * run and give the user nothing to look at.
 */
import { assertRunnableInput, executeForAgent, TaskInputError } from './agentExecutors.js';
import { ChainReadError, readChainState } from './blockchainService.js';
import { claimForRun, getHireableAgent } from './executionService.js';

/**
 * Errors whose message was written to be read by a user. Anything else gets a
 * generic message, because an unexpected error's text can carry internals.
 */
function isUserSafe(err) {
  return err instanceof ChainReadError || err instanceof TaskInputError;
}

/**
 * Set a step's state and save immediately, so pollers see it.
 * Unknown keys are ignored rather than thrown — a step rename must not be able
 * to abort a run that is otherwise fine.
 */
async function markStep(doc, key, state) {
  const step = doc.steps.find((s) => s.key === key);
  if (!step) return;
  step.state = state;
  step.at = new Date();
  doc.markModified('steps');
  await doc.save();
}

/** Whichever step was in flight when things went wrong. */
function failActiveStep(doc) {
  const active = doc.steps.find((s) => s.state === 'active');
  if (active) {
    active.state = 'failed';
    active.at = new Date();
    doc.markModified('steps');
  }
}

/**
 * Run one execution.
 *
 * @returns {Promise<{ claimed: boolean }>} `claimed: false` means another request
 *   already owns this run (or it has already finished) and nothing was done.
 */
export async function runExecution(executionId) {
  // Atomic pending → running. This is what makes a double-mounted React effect,
  // an impatient retry click, and two browser tabs all safe.
  const doc = await claimForRun(executionId);
  if (!doc) return { claimed: false };

  const startedAt = Date.now();

  try {
    const agent = await getHireableAgent(doc.agentId);
    if (!agent) {
      throw new Error(`Agent "${doc.agentId}" no longer exists, so this task cannot be run.`);
    }

    // Check the configuration before spending a round trip on it. A malformed
    // address should fail in milliseconds with a readable message, not after the
    // node has rejected it.
    assertRunnableInput(agent, doc.input || {});

    // --- Querying on-chain data (already marked active by the claim) ---------
    const chain = await readChainState();
    await markStep(doc, 'query', 'done');

    // --- Analyzing ----------------------------------------------------------
    await markStep(doc, 'analyse', 'active');
    const output = await executeForAgent({ agent, execution: doc, chain });
    await markStep(doc, 'analyse', 'done');

    // --- Generating result --------------------------------------------------
    await markStep(doc, 'report', 'active');
    doc.output = output;
    doc.status = 'completed';
    doc.durationMs = Date.now() - startedAt;
    doc.completedAt = new Date();
    doc.errorMessage = '';
    const report = doc.steps.find((s) => s.key === 'report');
    if (report) {
      report.state = 'done';
      report.at = new Date();
      doc.markModified('steps');
    }
    await doc.save();

    return { claimed: true };
  } catch (err) {
    failActiveStep(doc);
    doc.status = 'failed';
    doc.durationMs = Date.now() - startedAt;
    doc.completedAt = new Date();
    // ChainReadError and TaskInputError messages are written to be shown to a
    // user. Anything else gets a generic message: an unexpected error's text may
    // contain internals, and the real detail belongs in the server log.
    doc.errorMessage = isUserSafe(err)
      ? err.message
      : 'The agent could not complete this task. Nothing was charged and nothing was sent on-chain.';
    await doc.save();

    if (!isUserSafe(err)) {
      console.error(`[execution ${executionId}] failed:`, err);
    }
    return { claimed: true };
  }
}
