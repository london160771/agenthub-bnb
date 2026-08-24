import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, SearchX, Droplets, Clock, Play } from 'lucide-react';
import { useApi } from '../hooks/useApi.js';
import { Container } from '../components/ui/Container.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { Button, ButtonLink } from '../components/ui/Button.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { ErrorState } from '../components/ui/ErrorState.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { ExecutionTimeline } from '../components/execution/ExecutionTimeline.jsx';
import { ExecutionResult } from '../components/execution/ExecutionResult.jsx';
import { ExecutionFailed } from '../components/execution/ExecutionFailed.jsx';
import { getExecution, runExecution } from '../services/executions.js';
import { getAgent } from '../services/agents.js';
import { DEFAULT_CHAIN } from '../config.js';
import { formatBnb } from '../lib/format.js';
import {
  STATUS_META,
  isTerminal,
  formatMs,
  POLL_INTERVAL_MS,
  POLL_TIMEOUT_MS,
} from '../lib/execution.js';

/**
 * EXECUTION (spec §13/§14): a live timeline, then a real result, for one hire.
 *
 * The lifecycle this page drives:
 *   1. Load the execution.
 *   2. Ask the backend to run it — automatically if the user just hired, on a
 *      button press if they arrived by link.
 *   3. Poll while the run is genuinely in flight, so the timeline advances for
 *      real rather than on a timer.
 *   4. Stop polling the instant the status is terminal, and render the outcome.
 *
 * Polling gives up after a deadline. A spinner with no exit is the one failure
 * mode worse than an error message.
 */
export default function ExecutionPage() {
  const { executionId } = useParams();
  // Remount on id change so no state leaks between two different executions.
  return <ExecutionFlow key={executionId} executionId={executionId} />;
}

function ExecutionFlow({ executionId }) {
  const [searchParams] = useSearchParams();
  // The hire success screen links here with ?new=1, which means "I just created
  // this, start it". Without it we don't kick off work the visitor didn't ask for.
  const cameFromHire = searchParams.get('new') === '1';

  const [runRequested, setRunRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  const runStartedRef = useRef(false);
  const deadlineRef = useRef(null);

  // The execution record itself. `setData` lets the poll loop refresh it without
  // flipping `loading` back on, which would flash the skeleton every tick.
  const {
    data: execution,
    error: loadError,
    loading,
    refetch,
    setData: setExecution,
  } = useApi((signal) => getExecution(executionId, { signal }), [executionId]);

  // The agent, for header context. Keyed on the id the execution reports, so it
  // loads as soon as that arrives. A failure here is harmless — the page renders
  // without it.
  const { data: agent } = useApi(
    (signal) => (execution ? getAgent(execution.agentId, { signal }) : Promise.resolve(null)),
    [execution?.agentId],
  );

  const status = execution?.status;

  /**
   * Poll only when a run is actually in flight: either the server says
   * `running`, or we asked it to start and it hasn't picked the job up yet. A
   * `pending` execution that nobody has started is idle, not slow — polling it
   * would spin to the deadline and then wrongly report a stuck run.
   */
  const polling =
    execution != null && !isTerminal(status) && (status === 'running' || runRequested);

  /** Refresh the record quietly, outside the loading lifecycle. */
  const refresh = useCallback(async () => {
    const data = await getExecution(executionId);
    setExecution(data);
    return data;
  }, [executionId, setExecution]);

  /** Ask the backend to run (or re-run) this execution, then start watching. */
  const startRun = useCallback(async () => {
    runStartedRef.current = true;
    deadlineRef.current = Date.now() + POLL_TIMEOUT_MS;
    setTimedOut(false);
    setRunRequested(true);
    setBusy(true);
    try {
      await runExecution(executionId);
      // Read the record straight back so the timeline moves immediately instead
      // of waiting out a full poll interval.
      await refresh();
    } catch {
      // The poll loop still observes whatever state the record reaches; a failed
      // run request must not blank a page that already has content.
    } finally {
      setBusy(false);
    }
  }, [executionId, refresh]);

  // Auto-start for a fresh hire, exactly once.
  useEffect(() => {
    if (!execution || runStartedRef.current) return;
    if (execution.status !== 'pending' || !cameFromHire) return;
    // Starting the run is an external side effect (a POST); the state it sets is
    // a consequence of that, which is what an effect is for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    startRun();
  }, [execution, cameFromHire, startRun]);

  // Watch the run until it reaches a terminal state or the deadline passes.
  useEffect(() => {
    if (!polling) return undefined;
    if (deadlineRef.current == null) deadlineRef.current = Date.now() + POLL_TIMEOUT_MS;

    let cancelled = false;
    let timer = null;

    const tick = async () => {
      if (cancelled) return;
      if (Date.now() > deadlineRef.current) {
        setTimedOut(true);
        return;
      }
      try {
        await refresh();
      } catch {
        // Transient failure mid-poll: keep trying until the deadline.
      }
      if (!cancelled) timer = setTimeout(tick, POLL_INTERVAL_MS);
    };

    timer = setTimeout(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [polling, refresh]);

  const backLink = (
    <Link
      to={agent ? `/agents/${agent.agentId}` : '/discover'}
      className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
    >
      <ArrowLeft size={16} aria-hidden="true" />
      {agent ? 'Back to agent' : 'Back to marketplace'}
    </Link>
  );

  if (loading) {
    return (
      <Container className="py-8 lg:py-12">
        {backLink}
        <ExecutionSkeleton />
      </Container>
    );
  }

  if (loadError) {
    return (
      <Container className="py-8 lg:py-12">
        {backLink}
        <div className="mt-6">
          {loadError.status === 404 ? (
            <EmptyState
              icon={SearchX}
              title="Execution not found"
              description={`No execution with id “${executionId}”. Check the link, or hire an agent to create one.`}
              action={
                <ButtonLink to="/discover" variant="outline">
                  Browse the marketplace
                </ButtonLink>
              }
            />
          ) : (
            <ErrorState error={loadError} onRetry={refetch} />
          )}
        </div>
      </Container>
    );
  }

  if (!execution) return null;

  const meta = STATUS_META[status] || STATUS_META.pending;

  return (
    <Container className="py-8 lg:py-12">
      {backLink}

      <PageHeader
        className="mt-6"
        eyebrow="Execution"
        title={agent ? agent.name : 'Execution'}
        description={execution.task}
        actions={
          <Badge variant={meta.variant} className="text-sm">
            {status === 'running' && (
              <span
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-current"
                aria-hidden="true"
              />
            )}
            {meta.label}
          </Badge>
        }
      />

      {/* Live region so a screen reader hears the status change instead of only
          seeing it. The timeline itself is visual detail. */}
      <p className="sr-only" role="status" aria-live="polite">
        {meta.label}. {meta.description}
      </p>

      <div className="mt-6 grid gap-5 sm:mt-8 sm:gap-6 lg:grid-cols-[340px_1fr] lg:items-start">
        {/* Left rail: progress + facts, sticky on desktop so a long result
            scrolls against a stable summary. min-w-0 so a grid column can't be
            forced wider than the viewport by unbreakable content. */}
        <div className="min-w-0 space-y-5 lg:sticky lg:top-20">
          <Card>
            <CardBody>
              <h2 className="text-sm font-semibold text-fg">Progress</h2>
              <p className="mb-4 mt-0.5 text-xs text-muted">{meta.description}</p>
              <ExecutionTimeline steps={execution.steps} />
            </CardBody>
          </Card>

          <ExecutionFacts execution={execution} />
        </div>

        {/* Right: the main event. */}
        <div className="min-w-0 space-y-5">
          {status === 'completed' ? (
            <ExecutionResult execution={execution} />
          ) : status === 'failed' ? (
            <ExecutionFailed execution={execution} onRetry={startRun} retrying={busy} />
          ) : timedOut ? (
            <ErrorState
              message="This run is taking much longer than expected and may be stuck. Nothing was charged — you can start it again."
              onRetry={startRun}
            />
          ) : polling ? (
            <RunningNotice status={status} />
          ) : (
            <PendingPrompt onStart={startRun} busy={busy} />
          )}

          <FaucetNote />
        </div>
      </div>
    </Container>
  );
}

/** The hire's facts: id, recorded fee, network, measured duration. */
function ExecutionFacts({ execution }) {
  const rows = [
    [
      'Execution ID',
      <span key="id" className="break-all font-mono text-xs">
        {execution.executionId}
      </span>,
    ],
    ['Recorded fee', formatBnb(execution.cost, execution.currency || DEFAULT_CHAIN.currency)],
    ['Network', DEFAULT_CHAIN.name],
    execution.durationMs != null && ['Duration', formatMs(execution.durationMs)],
    [
      'Transaction',
      // Empty on purpose: no transaction was broadcast, so showing a hash here
      // would be fabricating on-chain data.
      <span key="tx" className="text-faint">
        None — payment simulated
      </span>,
    ],
  ].filter(Boolean);

  return (
    <Card>
      <CardBody>
        <h2 className="text-sm font-semibold text-fg">Details</h2>
        <dl className="mt-3 space-y-2 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-3">
              <dt className="shrink-0 text-muted">{label}</dt>
              <dd className="min-w-0 text-right text-fg">{value}</dd>
            </div>
          ))}
        </dl>
      </CardBody>
    </Card>
  );
}

function RunningNotice({ status }) {
  return (
    <Card>
      <CardBody className="flex flex-col items-center py-14 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-info/10 text-info">
          <Clock size={22} aria-hidden="true" className="animate-pulse" />
        </span>
        <h2 className="mt-3 text-base font-semibold text-fg">
          {status === 'pending' ? 'Starting the agent…' : 'The agent is working'}
        </h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted">
          It&apos;s reading live data from {DEFAULT_CHAIN.name}. This usually takes a couple of
          seconds — each step ticks over as it finishes.
        </p>
      </CardBody>
    </Card>
  );
}

function PendingPrompt({ onStart, busy }) {
  return (
    <Card>
      <CardBody className="flex flex-col items-center py-14 text-center">
        <h2 className="text-base font-semibold text-fg">This task hasn&apos;t run yet</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted">
          It&apos;s queued and ready. Running it reads public data from {DEFAULT_CHAIN.name} — no
          funds move and nothing is signed.
        </p>
        <div className="mt-5">
          <Button variant="primary" onClick={onStart} disabled={busy}>
            <Play size={15} aria-hidden="true" />
            {busy ? 'Starting…' : 'Run the agent'}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

/** Test funds are free and worthless — worth saying next to real balances. */
function FaucetNote() {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-line bg-panel-2 p-3">
      <Droplets size={15} className="mt-0.5 shrink-0 text-info" aria-hidden="true" />
      <p className="text-xs leading-relaxed text-muted">
        Any balance shown above is a real reading from {DEFAULT_CHAIN.name}. Test funds
        ({DEFAULT_CHAIN.currency}) are free from the{' '}
        <a
          href={DEFAULT_CHAIN.faucet}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand hover:underline"
        >
          BNB testnet faucet
        </a>{' '}
        and have no monetary value.
      </p>
    </div>
  );
}

function ExecutionSkeleton() {
  return (
    <div className="mt-6 space-y-6">
      <Skeleton className="h-9 w-64" />
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-5">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    </div>
  );
}
