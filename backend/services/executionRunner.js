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
import { ChainReadError, readChainState, withRpcLog } from './blockchainService.js';
import { claimForRun, getHireableAgent } from './executionService.js';
import { Agent } from '../models/Agent.js';
import { AGENT_CAPABILITIES, getAgentCapability } from './agentCapabilities.js';
import { getExecutionAdapterForAgent, isPaidExecutionEligibleAgent } from './adapters/registry.js';

/**
 * Errors whose message was written to be read by a user. Anything else gets a
 * generic message, because an unexpected error's text can carry internals.
 */
function isUserSafe(err) {
  if (err instanceof ChainReadError || err instanceof TaskInputError) return true;
  return false;
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

  // Measure against the timestamp the claim persisted, not a fresh clock read.
  // Both numbers then describe the same instant, so `startedAt + durationMs`
  // equals `completedAt` in the stored record instead of merely being close to
  // it — which is what makes the timing reconstructible by anyone reading the
  // document later. The fallback only matters if a stored date were missing.
  const startedAt = doc.startedAt ? doc.startedAt.getTime() : Date.now();

  // Collects every JSON-RPC request this run issues. Owned here so it survives a
  // throw: a failed run's read count is as real as a successful one's.
  const rpcLog = [];

  try {
    return await withRpcLog(rpcLog, async () => {
      const agent = await getHireableAgent(doc.agentId);
      if (!agent) {
        throw new Error(`Agent "${doc.agentId}" no longer exists, so this task cannot be run.`);
      }

      const capability = getAgentCapability(agent);
      const paidExecutionEligible = isPaidExecutionEligibleAgent(agent);
      if (
        (
          capability === AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID_READY
          || capability === AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID
        )
        && !paidExecutionEligible
      ) {
        throw new TaskInputError(
          capability === AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID_READY
            ? `"${agent.name}" is payment-preflight only. Wallet payment and task execution remain disabled until a verified paid executor is enabled.`
            : `"${agent.name}" has no enabled verified paid executor for its payment protocol, so AgentHub will not run it.`,
        );
      }
      const externalAdapter = getExecutionAdapterForAgent(agent);
      if (capability !== AGENT_CAPABILITIES.LOCAL_EXECUTABLE && !externalAdapter) {
        throw new TaskInputError(
          `"${agent.name}" is catalog/watch-only. AgentHub has not verified task execution for this indexed agent, so no local or Mainnet execution was attempted.`,
        );
      }
      if (
        (capability === AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID || paidExecutionEligible) &&
        doc.payment?.status !== 'confirmed'
      ) {
        throw new TaskInputError('The paid task cannot run until its BSC Mainnet payment is confirmed.');
      }

      await markStep(doc, 'analyse', 'active');
      let output;
      if (externalAdapter) {
        // External agents own validation and use their published HTTP service.
        // This branch deliberately never calls the local chain-97 reader.
        await markStep(doc, 'query', 'done');
        output = await externalAdapter.execute({ agent, execution: doc });
      } else {
        // Check the configuration before spending a round trip on it. This is
        // the unchanged local executor path.
        assertRunnableInput(agent, doc.input || {});
        const chain = await readChainState();
        await markStep(doc, 'query', 'done');
        output = await executeForAgent({ agent, execution: doc, chain });
      }
      await markStep(doc, 'analyse', 'done');

      // A paid adapter may promote its exact indexed identity only after it
      // has validated and returned the requested external task result.
      if (externalAdapter?.paid && output?.executionVerified === true) {
        await Agent.updateOne(
          { agentId: agent.agentId, source: 'indexed' },
          { $set: { executionVerified: true, lastVerifiedAt: new Date(), capability: AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID } },
        );
      }

      // --- Generating result ------------------------------------------------
      await markStep(doc, 'report', 'active');
      // The measured read log, attached at the one place that holds it.
      doc.output = { ...output, reads: output.reads || [...rpcLog] };
      doc.rawResult = output.rawResponse || null;
      const { rawResponse: _rawResponse, ...normalizedResult } = output;
      doc.normalizedResult = normalizedResult;
      doc.provenance = output.provenance || null;
      doc.executionVerified = output.executionVerified === true;
      doc.status = 'completed';
      doc.durationMs = Date.now() - startedAt;
      doc.rpcCallCount = rpcLog.length;
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
    });
  } catch (err) {
    failActiveStep(doc);
    doc.status = 'failed';
    doc.durationMs = Date.now() - startedAt;
    // Reads issued before the failure. Recorded because the work happened, even
    // though it produced no result.
    doc.rpcCallCount = rpcLog.length;
    doc.completedAt = new Date();
    // A paid provider's unrecognized response is retained for private audit,
    // but it is never normalized, exposed through public reads, or promoted to
    // verified execution capability.
    if (err?.rawResult !== undefined) {
      doc.rawResult = err.rawResult;
      doc.normalizedResult = null;
      doc.executionVerified = false;
    }
    // ChainReadError and TaskInputError messages are written to be shown to a
    // user. Anything else gets a generic message: an unexpected error's text may
    // contain internals, and the real detail belongs in the server log.
    const paymentStatus = doc.payment?.status;
    doc.errorMessage = isUserSafe(err)
      ? err.message
      : paymentStatus === 'confirmed'
        ? 'The paid agent could not complete this task after payment confirmation. Do not submit another payment automatically; review the confirmed transaction and provider status.'
        : paymentStatus && paymentStatus !== 'none'
          ? 'Payment status is uncertain. Do not retry payment automatically; review the saved execution and wallet activity first.'
          : 'The agent could not complete this read-only task. No payment was required and nothing was sent on-chain.';
    await doc.save();

    if (!isUserSafe(err)) {
      console.error(`[execution ${executionId}] failed:`, err);
    }
    return { claimed: true };
  }
}
