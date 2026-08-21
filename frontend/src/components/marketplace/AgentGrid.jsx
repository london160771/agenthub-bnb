import { AgentCard, AgentCardSkeleton } from '../agents/AgentCard.jsx';

/** Responsive grid of agent cards, with a skeleton loading state. */
export function AgentGrid({ agents = [], loading = false, skeletonCount = 6 }) {
  const cols = 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3';

  if (loading) {
    return (
      <div className={cols}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <AgentCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className={cols}>
      {agents.map((agent) => (
        <AgentCard key={agent.agentId} agent={agent} />
      ))}
    </div>
  );
}
