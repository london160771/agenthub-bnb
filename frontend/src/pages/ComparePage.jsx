import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GitCompare, Info, ArrowLeftRight, SearchX, X } from 'lucide-react';
import { Container } from '../components/ui/Container.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Button, ButtonLink } from '../components/ui/Button.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { ErrorState } from '../components/ui/ErrorState.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { ComparisonMatrix } from '../components/compare/ComparisonMatrix.jsx';
import { AddAgentPicker } from '../components/compare/AddAgentPicker.jsx';
import { useApi } from '../hooks/useApi.js';
import { getAgent } from '../services/agents.js';
import { TRUST_DISCLAIMER } from '../lib/trust.js';
import { MAX_COMPARE, MIN_COMPARE, parseIds, withId, withoutId } from '../lib/compare.js';

function MatrixSkeleton() {
  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-line bg-panel">
      <div className="flex gap-4 border-b border-line p-4">
        <Skeleton className="h-32 w-32 shrink-0 sm:w-40" />
        <Skeleton className="h-32 w-56 shrink-0" />
        <Skeleton className="hidden h-32 w-56 shrink-0 sm:block" />
      </div>
      <div className="space-y-3 p-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    </div>
  );
}

export default function ComparePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');

  // The URL is the source of truth, so a comparison is shareable and the
  // back/forward buttons behave.
  const ids = parseIds(searchParams);
  const idsKey = ids.join(',');

  /**
   * No batch endpoint exists, so fetch each agent individually and catch per id
   * — one bad id in a shared link degrades to a note instead of blanking the
   * whole page.
   */
  const { data, loading, refetch } = useApi(
    (signal) =>
      Promise.all(
        ids.map((id) =>
          getAgent(id, { signal })
            .then((agent) => ({ id, agent }))
            .catch((err) => ({ id, err })),
        ),
      ),
    [idsKey],
  );

  const results = data || [];
  const found = results.filter((r) => r.agent).map((r) => r.agent);
  const failed = results.filter((r) => r.err);

  const updateIds = useCallback(
    (nextIds) => {
      const next = new URLSearchParams(searchParams);
      if (nextIds.length === 0) next.delete('ids');
      else next.set('ids', nextIds.join(','));
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const handleAdd = useCallback(
    (id) => {
      updateIds(withId(ids, id));
      setQuery('');
    },
    [ids, updateIds],
  );

  const handleRemove = useCallback((id) => updateIds(withoutId(ids, id)), [ids, updateIds]);

  const header = (
    <PageHeader
      eyebrow="Compare"
      title="Compare agents"
      description={`Put up to ${MAX_COMPARE} agents side by side across trust, pricing, performance, identity and capabilities. Best value in each measurable row is highlighted.`}
      actions={
        <>
          {ids.length > 0 && (
            <Button variant="ghost" onClick={() => updateIds([])}>
              <X size={16} aria-hidden="true" />
              Clear
            </Button>
          )}
          <ButtonLink to="/discover" variant="outline">
            Browse marketplace
          </ButtonLink>
        </>
      }
    />
  );

  const picker = (
    <AddAgentPicker
      selectedIds={ids}
      query={query}
      onQueryChange={setQuery}
      onAdd={handleAdd}
      className="mt-6"
    />
  );

  const disclaimer = (
    <p className="mt-4 flex items-start gap-2 rounded-lg border border-line bg-panel-2 p-3 text-xs leading-relaxed text-muted">
      <Info size={14} className="mt-0.5 shrink-0 text-faint" aria-hidden="true" />
      {TRUST_DISCLAIMER} “Best in row” marks the best value among the agents shown on that single
      metric — it is not a recommendation.
    </p>
  );

  // --- Loading -------------------------------------------------------------
  if (loading) {
    return (
      <Container className="py-8 lg:py-12">
        {header}
        <MatrixSkeleton />
      </Container>
    );
  }

  // --- Every requested agent failed to load --------------------------------
  if (ids.length > 0 && found.length === 0) {
    const allNotFound = failed.every((f) => f.err?.status === 404);
    return (
      <Container className="py-8 lg:py-12">
        {header}
        <div className="mt-6">
          {allNotFound ? (
            <EmptyState
              icon={SearchX}
              title="Those agents couldn’t be found"
              description={`We couldn’t find ${failed.length === 1 ? 'an agent' : 'agents'} for: ${failed
                .map((f) => f.id)
                .join(', ')}. The link may be out of date.`}
              action={
                <Button variant="outline" onClick={() => updateIds([])}>
                  Start a new comparison
                </Button>
              }
            />
          ) : (
            <ErrorState error={failed[0]?.err} onRetry={refetch} />
          )}
        </div>
        {picker}
      </Container>
    );
  }

  // --- Not enough agents selected yet --------------------------------------
  if (found.length < MIN_COMPARE) {
    return (
      <Container className="py-8 lg:py-12">
        {header}
        <div className="mt-6">
          <EmptyState
            icon={GitCompare}
            title={
              found.length === 0
                ? 'Nothing to compare yet'
                : `Add one more agent to compare with ${found[0].name}`
            }
            description={
              found.length === 0
                ? `Add at least ${MIN_COMPARE} agents below — or hit “Compare” on any agent’s profile — to see them side by side.`
                : 'A comparison needs at least two agents. Search below to add another.'
            }
          />
        </div>
        {found.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted">Selected:</span>
            {found.map((agent) => (
              <span
                key={agent.agentId}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel py-1 pl-3 pr-1.5 text-sm text-fg"
              >
                {agent.name}
                <button
                  type="button"
                  onClick={() => handleRemove(agent.agentId)}
                  aria-label={`Remove ${agent.name} from the comparison`}
                  className="grid h-5 w-5 place-items-center rounded-full text-faint transition-colors hover:bg-panel-2 hover:text-fg"
                >
                  <X size={13} aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        )}
        {picker}
      </Container>
    );
  }

  // --- The matrix ----------------------------------------------------------
  return (
    <Container className="py-8 lg:py-12">
      {header}

      <p className="mt-6 flex items-center gap-1.5 text-xs text-faint sm:hidden">
        <ArrowLeftRight size={13} aria-hidden="true" />
        Swipe the table sideways to see every agent
      </p>

      <ComparisonMatrix agents={found} onRemove={handleRemove} className="mt-2 sm:mt-6" />

      {failed.length > 0 && (
        <p className="mt-3 text-xs text-muted">
          Couldn’t load {failed.length === 1 ? 'one agent' : `${failed.length} agents`} from this
          link: {failed.map((f) => f.id).join(', ')}.
        </p>
      )}

      {disclaimer}

      {/* Always rendered: at MAX_COMPARE it explains why you can't add more. */}
      {picker}
    </Container>
  );
}
