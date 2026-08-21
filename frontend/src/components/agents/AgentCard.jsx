import { Link } from 'react-router-dom';
import { Star, ArrowRight } from 'lucide-react';
import { Card } from '../ui/Card.jsx';
import { Badge } from '../ui/Badge.jsx';
import { Skeleton } from '../ui/Skeleton.jsx';
import { SOURCE_LABELS } from '../../config.js';
import { formatBnb } from '../../lib/format.js';
import { AgentAvatar } from './AgentAvatar.jsx';
import { AgentStatus } from './AgentStatus.jsx';
import { AgentTrustScore } from './AgentTrustScore.jsx';
import { AgentMetrics } from './AgentMetrics.jsx';
import { AgentSkills } from './AgentSkills.jsx';

const PRICING_MODEL_LABELS = {
  'per-task': 'per task',
  subscription: 'subscription',
  free: 'free',
};

/**
 * Marketplace agent card. The whole card links to the agent profile. A
 * provenance badge (source) is always shown so seeded/demo data is never
 * presented as verified on-chain fact.
 */
export function AgentCard({ agent }) {
  const {
    agentId,
    name,
    tagline,
    description,
    avatar,
    status,
    source,
    skills = [],
    pricing = {},
    metrics = {},
    trust = {},
    trustScore,
    ratingAvg,
    reviewCount,
  } = agent;

  const provenance = SOURCE_LABELS[source];

  return (
    <Card as={Link} to={`/agents/${agentId}`} interactive className="group flex h-full flex-col p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <AgentAvatar name={name} seed={agentId} src={avatar} size="md" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-fg transition-colors group-hover:text-brand">
            {name}
          </h3>
          {tagline && <p className="truncate text-sm text-muted">{tagline}</p>}
        </div>
        <AgentStatus status={status} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 sm:mt-4">
        <AgentTrustScore score={trustScore ?? trust.overall} confidence={trust.confidence} />
        {ratingAvg != null && (
          <span
            className="inline-flex items-center gap-1 text-xs text-muted"
            title={reviewCount != null ? `${reviewCount} reviews` : 'rating'}
          >
            <Star size={13} className="fill-warn text-warn" aria-hidden="true" />
            <span className="font-medium text-fg">{ratingAvg.toFixed(1)}</span>
            {reviewCount != null && <span className="text-faint">({reviewCount})</span>}
          </span>
        )}
        {provenance && <Badge variant={provenance.variant}>{provenance.label}</Badge>}
      </div>

      {description && (
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted">{description}</p>
      )}

      {skills.length > 0 && <AgentSkills skills={skills} max={3} mobileMax={2} className="mt-3" />}

      <div className="mt-auto pt-3 sm:pt-4">
        <div className="border-t border-line pt-3">
          <AgentMetrics metrics={metrics} />
        </div>
        <div className="mt-3 flex items-end justify-between">
          <div>
            <p className="text-xs text-faint">
              {PRICING_MODEL_LABELS[pricing.model] || pricing.model || 'pricing'}
            </p>
            <p className="font-semibold text-fg">{formatBnb(pricing.amount)}</p>
          </div>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-muted transition-colors group-hover:text-brand">
            View
            <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </div>
      </div>
    </Card>
  );
}

/** Loading placeholder matching the card's shape. */
export function AgentCardSkeleton() {
  return (
    <Card className="flex h-full flex-col p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <Skeleton className="h-11 w-11 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="mt-4 h-7 w-40" />
      <Skeleton className="mt-3 h-3 w-full" />
      <Skeleton className="mt-2 h-3 w-5/6" />
      <div className="mt-3 flex gap-1.5">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-16" />
      </div>
      <div className="mt-auto pt-4">
        <Skeleton className="h-3 w-full" />
        <div className="mt-3 flex items-center justify-between">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-4 w-12" />
        </div>
      </div>
    </Card>
  );
}
