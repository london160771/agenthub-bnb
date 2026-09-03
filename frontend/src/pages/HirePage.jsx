import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, PauseCircle, SearchX } from 'lucide-react';
import { Container } from '../components/ui/Container.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import { ButtonLink } from '../components/ui/Button.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { ErrorState } from '../components/ui/ErrorState.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { HireSummary } from '../components/hire/HireSummary.jsx';
import { TaskConfigForm } from '../components/hire/TaskConfigForm.jsx';
import { HireConfirmPanel } from '../components/hire/HireConfirmPanel.jsx';
import { HireSuccess } from '../components/hire/HireSuccess.jsx';
import { useApi } from '../hooks/useApi.js';
import { getAgent } from '../services/agents.js';
import { createExecution } from '../services/executions.js';
import { DEFAULT_CHAIN } from '../config.js';
import {
  buildTaskSummary,
  defaultValuesFor,
  toInputPayload,
  validateHireInput,
} from '../lib/hire.js';
import { useWallet } from '../context/walletContext.js';
import { isLocallyExecutable } from '../lib/agentCapability.js';

/**
 * HIRE (spec §39 phase 5): configure a task → review cost and network →
 * confirm → a persisted hire record.
 *
 * What is real here: the wallet connection, the address, the detected chain, and
 * the execution record written to our database. What is simulated: the payment.
 * Nothing on this page signs or broadcasts a transaction — see HireConfirmPanel,
 * which says so to the user as well.
 */
export default function HirePage() {
  const { agentId } = useParams();
  // Keyed on the agent so navigating between hire pages resets the form, the
  // validation errors and any success view — no stale state carried across.
  return <HireFlow key={agentId} agentId={agentId} />;
}

function HireFlow({ agentId }) {
  const { address, chainId, isConnected, isCorrectChain } = useWallet();

  const { data: agent, error, loading, refetch } = useApi(
    (signal) => getAgent(agentId, { signal }),
    [agentId],
  );

  // Form state is derived, not synchronised in an effect: `defaults` come from
  // the agent's category (and the connected address), `edits` are what the user
  // has actually changed, and edits always win. So connecting a wallet mid-form
  // fills the untouched address fields without discarding anything typed.
  const [edits, setEdits] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [execution, setExecution] = useState(null);

  const defaults = useMemo(
    () => (agent ? defaultValuesFor(agent, address) : {}),
    [agent, address],
  );
  const values = useMemo(() => ({ ...defaults, ...edits }), [defaults, edits]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [agentId]);

  const setField = (key, value) => {
    setEdits((prev) => ({ ...prev, [key]: value }));
    // Clear this field's error as soon as the user edits it; re-validated on submit.
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
    setSubmitError(null);
  };

  const taskSummary = useMemo(
    () => (agent ? buildTaskSummary(agent, values) : ''),
    [agent, values],
  );

  const handleSubmit = async () => {
    if (!agent) return;

    const found = validateHireInput(agent, values);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setSubmitError(null);
      // Bring the first offending field into view — on mobile the confirm
      // button and the failing field can be a screen apart.
      const firstKey = Object.keys(found)[0];
      document.getElementById(`hire-${firstKey}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
      return;
    }

    // Belt and braces: the confirm button is already gated on both of these.
    if (!isConnected || !isCorrectChain) return;

    setErrors({});
    setSubmitError(null);
    setSubmitting(true);
    try {
      const created = await createExecution({
        agentId: agent.agentId,
        userAddress: address,
        // Reported so the backend can refuse anything that isn't testnet.
        chainId: chainId ?? DEFAULT_CHAIN.id,
        task: taskSummary,
        input: toInputPayload(agent, values),
      });
      setExecution(created);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setSubmitError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const backLink = (
    <Link
      to={agentId ? `/agents/${agentId}` : '/discover'}
      className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
    >
      <ArrowLeft size={16} aria-hidden="true" />
      Back to agent
    </Link>
  );

  if (loading) {
    return (
      <Container className="py-8 lg:py-12">
        {backLink}
        <HireSkeleton />
      </Container>
    );
  }

  if (error) {
    const notFound = error.status === 404;
    return (
      <Container className="py-8 lg:py-12">
        {backLink}
        <div className="mt-6">
          {notFound ? (
            <EmptyState
              icon={SearchX}
              title="Agent not found"
              description={`We couldn’t find an agent with id “${agentId}”, so there is nothing to hire. Check the link, or browse the marketplace.`}
              action={
                <ButtonLink to="/discover" variant="outline">
                  Browse the marketplace
                </ButtonLink>
              }
            />
          ) : (
            <ErrorState error={error} onRetry={refetch} />
          )}
        </div>
      </Container>
    );
  }

  if (!agent) return null;

  if (!isLocallyExecutable(agent)) {
    return (
      <Container className="py-8 lg:py-12">
        {backLink}
        <div className="mt-6 space-y-5">
          <HireSummary agent={agent} />
          <EmptyState
            icon={SearchX}
            title="Agent execution is not verified"
            description={`${agent.name} is discoverable in AgentHub, but its current capability is ${agent.capability || 'indexed/watch-only'}. AgentCard or catalog metadata does not prove that a requested task can execute and return a result. Browse seeded agents to run a read-only BNB Smart Chain Testnet task.`}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <ButtonLink to={`/agents/${agent.agentId}`} variant="outline">
                  View profile
                </ButtonLink>
                <ButtonLink to="/discover" variant="secondary">
                  Browse seeded agents
                </ButtonLink>
              </div>
            }
          />
        </div>
      </Container>
    );
  }

  // Success replaces the form entirely — there is nothing left to configure.
  if (execution) {
    return (
      <Container className="py-8 lg:py-12">
        {backLink}
        <div className="mx-auto mt-6 max-w-2xl">
          <HireSuccess agent={agent} execution={execution} />
        </div>
      </Container>
    );
  }

  // A paused agent is blocked with the reason, rather than failing on submit.
  if (agent.status === 'paused') {
    return (
      <Container className="py-8 lg:py-12">
        {backLink}
        <div className="mt-6 space-y-5">
          <HireSummary agent={agent} />
          <EmptyState
            icon={PauseCircle}
            title={`${agent.name} is paused`}
            description="This agent isn’t accepting new work right now, so it can’t be hired. Its profile stays available, and you can compare similar agents in the meantime."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <ButtonLink to={`/agents/${agent.agentId}`} variant="outline">
                  View profile
                </ButtonLink>
                <ButtonLink to={`/compare?ids=${agent.agentId}`} variant="secondary">
                  Compare alternatives
                </ButtonLink>
              </div>
            }
          />
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-8 lg:py-12">
      {backLink}

      <PageHeader
        className="mt-6"
        eyebrow="Hire"
        title={`Hire ${agent.name}`}
        description="Tell the agent what to do, review the cost, then confirm. Nothing is charged in this build — the payment step is simulated."
      />

      {/* Mobile-first: one column, in reading order (who → what → confirm).
          From lg the confirm panel becomes a sticky rail beside the form. */}
      <div className="mt-6 grid gap-5 sm:mt-8 sm:gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="space-y-5 sm:space-y-6">
          <HireSummary agent={agent} />
          <TaskConfigForm
            agent={agent}
            values={values}
            errors={errors}
            onChange={setField}
            walletAddress={address}
            disabled={submitting}
          />
          {taskSummary && (
            <Card>
              <CardBody>
                <p className="text-xs font-medium uppercase tracking-wide text-faint">
                  Task summary
                </p>
                <p className="mt-1.5 break-words text-sm leading-relaxed text-muted">
                  {taskSummary}
                </p>
                <p className="mt-2 text-xs text-faint">
                  This is the description stored with your hire.
                </p>
              </CardBody>
            </Card>
          )}
        </div>

        <HireConfirmPanel
          agent={agent}
          submitting={submitting}
          submitError={submitError}
          onSubmit={handleSubmit}
          className="lg:sticky lg:top-20"
        />
      </div>
    </Container>
  );
}

function HireSkeleton() {
  return (
    <div className="mt-6 space-y-6">
      <Skeleton className="h-9 w-56" />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    </div>
  );
}
