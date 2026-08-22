import { Plus, SearchX } from 'lucide-react';
import { Card, CardBody } from '../ui/Card.jsx';
import { Button } from '../ui/Button.jsx';
import { Skeleton } from '../ui/Skeleton.jsx';
import { SectionHeading } from '../ui/PageHeader.jsx';
import { SearchBar } from '../marketplace/SearchBar.jsx';
import { AgentAvatar } from '../agents/AgentAvatar.jsx';
import { AgentTrustScore } from '../agents/AgentTrustScore.jsx';
import { useApi } from '../../hooks/useApi.js';
import { listAgents } from '../../services/agents.js';
import { formatBnb } from '../../lib/format.js';
import { MAX_COMPARE } from '../../lib/compare.js';
import { cn } from '../../lib/cn.js';

const RESULT_LIMIT = 6;

/**
 * In-page search for adding agents to the comparison. Reuses the marketplace
 * SearchBar (already debounced) and the `trust` sort, so an empty query shows
 * the recommended agents — a sensible starting point rather than a blank list.
 *
 * Agents already in the comparison are filtered out; the control locks once
 * MAX_COMPARE agents are selected.
 */
export function AddAgentPicker({ selectedIds = [], query, onQueryChange, onAdd, className }) {
  const atCapacity = selectedIds.length >= MAX_COMPARE;

  const { data, error, loading } = useApi(
    (signal) =>
      listAgents(
        // Over-fetch a little so filtering out selected agents still leaves results.
        { q: query || undefined, sort: 'trust', limit: RESULT_LIMIT + MAX_COMPARE },
        { signal },
      ),
    [query],
  );

  const results = (data?.items || [])
    .filter((a) => !selectedIds.includes(a.agentId))
    .slice(0, RESULT_LIMIT);

  return (
    <Card className={className}>
      <CardBody>
        <SectionHeading
          title="Add an agent"
          description={
            atCapacity
              ? `You can compare up to ${MAX_COMPARE} agents at once. Remove one to add another.`
              : `Search the marketplace and add up to ${MAX_COMPARE} agents to the matrix.`
          }
          className="mb-4"
        />

        {!atCapacity && (
          <>
            <SearchBar
              value={query}
              onChange={onQueryChange}
              placeholder="Search agents, skills, protocols…"
            />

            <div className="mt-3">
              {loading && (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              )}

              {!loading && error && (
                <p className="py-2 text-sm text-muted">
                  Couldn’t load agents right now. {error.message}
                </p>
              )}

              {!loading && !error && results.length === 0 && (
                <p className="flex items-center gap-2 py-2 text-sm text-muted">
                  <SearchX size={15} className="text-faint" aria-hidden="true" />
                  {query ? `No other agents match “${query}”.` : 'No more agents available to add.'}
                </p>
              )}

              {!loading && !error && results.length > 0 && (
                <ul className="space-y-2">
                  {results.map((agent) => (
                    <li key={agent.agentId}>
                      <div
                        className={cn(
                          'flex items-center gap-3 rounded-lg border border-line bg-base p-2.5',
                          'transition-colors hover:border-line-strong',
                        )}
                      >
                        <AgentAvatar
                          name={agent.name}
                          seed={agent.agentId}
                          src={agent.avatar}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-fg">{agent.name}</p>
                          <p className="truncate text-xs text-muted">
                            {formatBnb(agent.pricing?.amount)}
                            {agent.tagline ? ` · ${agent.tagline}` : ''}
                          </p>
                        </div>
                        <AgentTrustScore
                          score={agent.trustScore ?? agent.trust?.overall}
                          className="hidden sm:inline-flex"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onAdd(agent.agentId)}
                          aria-label={`Add ${agent.name} to the comparison`}
                        >
                          <Plus size={15} aria-hidden="true" />
                          Add
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
