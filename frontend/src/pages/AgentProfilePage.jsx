import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Zap,
  GitCompare,
  Star,
  MessageSquare,
  SearchX,
  BadgeCheck,
  Link2,
} from 'lucide-react';
import { Container } from '../components/ui/Container.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { ButtonLink } from '../components/ui/Button.jsx';
import { SectionHeading } from '../components/ui/PageHeader.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { ErrorState } from '../components/ui/ErrorState.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { AgentAvatar } from '../components/agents/AgentAvatar.jsx';
import { AgentStatus } from '../components/agents/AgentStatus.jsx';
import { AgentTrustScore } from '../components/agents/AgentTrustScore.jsx';
import { AgentMetrics } from '../components/agents/AgentMetrics.jsx';
import { TrustBreakdown } from '../components/agents/TrustBreakdown.jsx';
import { AgentGrid } from '../components/marketplace/AgentGrid.jsx';
import { useApi } from '../hooks/useApi.js';
import { getAgent, listAgents } from '../services/agents.js';
import { SOURCE_LABELS, CATEGORIES } from '../config.js';
import { cn } from '../lib/cn.js';
import { AGENT_CAPABILITIES, capabilityMetaFor, isExecutable, isExternallyExecutable } from '../lib/agentCapability.js';
import {
  formatBnb,
  formatCompactNumber,
  formatPercent,
  formatDuration,
  formatDate,
  relativeTime,
} from '../lib/format.js';

const PRICING_MODEL_LABELS = {
  'per-task': 'Per task',
  subscription: 'Subscription',
  free: 'Free',
};

const categoryLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label || id;
const shortAddress = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');
const isDemoSource = (s) => s === 'seeded' || s === 'demo';

/** A label/value row used across the sidebar info cards. */
function InfoRow({ label, value, mono = false, title }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="shrink-0 text-sm text-muted">{label}</span>
      <span
        className={cn('text-right text-sm text-fg', mono && 'break-all font-mono text-xs')}
        title={title}
      >
        {value}
      </span>
    </div>
  );
}

/** A titled group of chips (skills / protocols / tags). */
function ChipGroup({ label, items = [], variant = 'neutral' }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Badge key={item} variant={variant}>
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}

/** Five stars with a whole-star fill for the aggregate rating. */
function StarRating({ value = 0 }) {
  const filled = Math.round(value);
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          size={15}
          className={i < filled ? 'fill-warn text-warn' : 'text-line-strong'}
        />
      ))}
    </span>
  );
}

function ProfileSkeleton() {
  return (
    <div className="mt-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <Skeleton className="h-20 w-20 rounded-xl" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-80" />
        </div>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-44 w-full rounded-xl" />
          <Skeleton className="h-52 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default function AgentProfilePage() {
  const { agentId } = useParams();

  const { data: agent, error, loading, refetch } = useApi(
    (signal) => getAgent(agentId, { signal }),
    [agentId],
  );

  // Related agents in the same category (fetched once the agent loads).
  const category = agent?.category;
  const { data: relatedData } = useApi(
    async (signal) => {
      if (!category) return { items: [] };
      return listAgents({ category, sort: 'trust', limit: 4 }, { signal });
    },
    [category],
  );
  const related = (relatedData?.items || []).filter((a) => a.agentId !== agentId).slice(0, 3);

  // Reset scroll when navigating between agents (e.g. via related cards).
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [agentId]);

  const backLink = (
    <Link
      to="/discover"
      className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
    >
      <ArrowLeft size={16} aria-hidden="true" />
      Back to Discover
    </Link>
  );

  if (loading) {
    return (
      <Container className="py-8 lg:py-12">
        {backLink}
        <ProfileSkeleton />
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
              description={`We couldn’t find an agent with id “${agentId}”. It may have been removed or the link is incorrect.`}
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

  const {
    name,
    tagline,
    description,
    avatar,
    status,
    source,
    category: agentCategory,
    subcategory,
    verified,
    skills = [],
    protocols = [],
    tags = [],
    pricing = {},
    metrics = {},
    trust = {},
    trustScore,
    ratingAvg,
    reviewCount = 0,
    erc8004Id,
    ownerAddress,
    endpoint,
    lastActiveAt,
    capability,
  } = agent;

  const provenance = SOURCE_LABELS[source];
  const demo = isDemoSource(source);
  const canHire = isExecutable(agent);
  const isExternalExecutable = isExternallyExecutable(agent);
  const isCatalogVerified = capability === AGENT_CAPABILITIES.INDEXED_CATALOG_VERIFIED;
  const capabilityMeta = capabilityMetaFor(agent);

  return (
    <Container className="py-8 lg:py-12">
      {backLink}

      {/* Hero */}
      <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-start">
        <AgentAvatar name={name} seed={agentId} src={avatar} size="xl" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <AgentStatus status={status} />
            {provenance && <Badge variant={provenance.variant}>{provenance.label}</Badge>}
            <Badge variant="neutral">{categoryLabel(agentCategory)}</Badge>
            {verified && (
              <Badge variant="ok">
                <BadgeCheck size={13} aria-hidden="true" />
                AgentHub-verified
              </Badge>
            )}
          </div>

          <h1 className="mt-3 text-2xl font-bold tracking-tight text-fg sm:text-3xl">{name}</h1>
          {tagline && <p className="mt-1 text-muted">{tagline}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <AgentTrustScore score={trustScore ?? trust.overall} confidence={trust.confidence} />
            {ratingAvg != null && (
              <span className="inline-flex items-center gap-1.5 text-sm text-muted">
                <StarRating value={ratingAvg} />
                <span className="font-medium text-fg">{ratingAvg.toFixed(1)}</span>
                <span className="text-faint">({reviewCount})</span>
              </span>
            )}
            <AgentMetrics metrics={metrics} />
          </div>
        </div>

        <div className="flex w-full shrink-0 gap-2 sm:w-auto sm:flex-col lg:flex-row">
          {!canHire ? (
            <span className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-info/30 bg-info/10 px-4 py-2.5 text-sm font-medium text-info sm:flex-none">
              {capabilityMeta.label}
            </span>
          ) : (
            <ButtonLink to={`/hire/${agentId}`} variant="primary" className="flex-1 sm:flex-none">
              <Zap size={16} aria-hidden="true" />
              Hire
            </ButtonLink>
          )}
          <ButtonLink
            to={`/compare?ids=${agentId}`}
            variant="secondary"
            className="flex-1 sm:flex-none"
          >
            <GitCompare size={16} aria-hidden="true" />
            Compare
          </ButtonLink>
        </div>
      </div>

      {/* Body */}
      <div className="mt-6 grid gap-5 sm:mt-8 sm:gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div className="space-y-4 sm:space-y-6">
          {description && (
            <Card>
              <CardBody>
                <SectionHeading title="About" className="mb-3" />
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted">{description}</p>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardBody>
              <SectionHeading
                title="Trust breakdown"
                description="How AgentHub scored this agent, factor by factor."
              />
              <TrustBreakdown trust={trust} />
            </CardBody>
          </Card>

          {(skills.length > 0 || protocols.length > 0 || tags.length > 0 || subcategory) && (
            <Card>
              <CardBody>
                <SectionHeading title="Capabilities" className="mb-4" />
                <div className="space-y-4">
                  <ChipGroup label="Skills" items={skills} variant="brand" />
                  <ChipGroup label="Protocols" items={protocols} />
                  <ChipGroup label="Tags" items={tags} />
                  {subcategory && <InfoRow label="Subcategory" value={subcategory} />}
                </div>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardBody>
              <SectionHeading
                title="Reviews"
                description={
                  reviewCount > 0
                    ? `${reviewCount} rating${reviewCount === 1 ? '' : 's'}${demo ? ' (illustrative demo data)' : ''}`
                    : undefined
                }
              />
              {ratingAvg != null && (
                <div className="mb-5 flex items-center gap-4">
                  <span className="font-mono text-4xl font-bold text-fg">{ratingAvg.toFixed(1)}</span>
                  <div>
                    <StarRating value={ratingAvg} />
                    <p className="mt-1 text-xs text-faint">
                      {reviewCount} rating{reviewCount === 1 ? '' : 's'}
                      {demo && ' · demo data'}
                    </p>
                  </div>
                </div>
              )}
              <EmptyState
                icon={MessageSquare}
                title="No verified reviews yet"
                description="Reviews on AgentHub are gated on completed executions — each one links to the execution it came from, so ratings can’t be faked. Individual reviews appear here once this agent completes hires."
              />
            </CardBody>
          </Card>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4 sm:space-y-6">
          <Card>
            <CardBody>
              <SectionHeading title="Pricing" className="mb-3" />
              <p className="font-mono text-2xl font-bold text-fg">{formatBnb(pricing.amount)}</p>
              <p className="text-xs text-faint">
                {PRICING_MODEL_LABELS[pricing.model] || pricing.model || '—'}
              </p>
              <div className="mt-3 border-t border-line pt-2">
                <InfoRow label="Currency" value={pricing.currency || 'BNB'} />
                <InfoRow
                  label="Avg cost / run"
                  value={metrics.avgCost != null ? formatBnb(metrics.avgCost) : '—'}
                />
              </div>
              {!canHire ? (
                <div className="mt-4 rounded-lg border border-info/20 bg-info/5 p-3 text-xs leading-relaxed text-muted">
                  {isCatalogVerified
                    ? 'Mainnet agent · catalog verified. AgentCard and A2A service metadata are available; no paid skill execution has been verified.'
                    : 'Indexed agent from 8004scan. Discoverable here, but watch-only because AgentHub has not verified task execution.'}
                </div>
              ) : null}
              {canHire ? (
                <ButtonLink to={`/hire/${agentId}`} variant="primary" className="mt-4 w-full">
                  <Zap size={16} aria-hidden="true" />
                  {isExternalExecutable ? 'Use this agent' : 'Hire this agent'}
                </ButtonLink>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <SectionHeading title="Performance" className="mb-2" />
              <InfoRow label="Executions" value={formatCompactNumber(metrics.executions)} />
              <InfoRow label="Success rate" value={formatPercent(metrics.successRate)} />
              <InfoRow label="Avg response" value={formatDuration(metrics.avgResponseTime)} />
              <InfoRow label="Active since" value={formatDate(metrics.activeSince)} />
              <InfoRow label="Last active" value={lastActiveAt ? relativeTime(lastActiveAt) : '—'} />
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <SectionHeading title="Identity & provenance" className="mb-2" />
              <InfoRow
                label="Data source"
                value={provenance ? <Badge variant={provenance.variant}>{provenance.label}</Badge> : source}
              />
              <InfoRow label="Chain" value="BNB Smart Chain" />
              <InfoRow label="ERC-8004 ID" value={erc8004Id ? `#${erc8004Id}` : 'Not registered'} />
              <InfoRow
                label="Owner"
                value={ownerAddress ? shortAddress(ownerAddress) : 'Not linked'}
                mono={!!ownerAddress}
                title={ownerAddress || undefined}
              />
              <InfoRow
                label="Endpoint"
                value={
                  endpoint ? (
                    <span className="inline-flex items-center gap-1">
                      <Link2 size={12} aria-hidden="true" />
                      {endpoint}
                    </span>
                  ) : (
                    '—'
                  )
                }
                mono={!!endpoint}
                title={endpoint || undefined}
              />
              {demo && (
                <p className="mt-3 text-xs leading-relaxed text-muted">
                  This is a curated demo listing. Its metrics and rating are illustrative, and it has
                  no verified on-chain identity yet.
                </p>
              )}
            </CardBody>
          </Card>
        </aside>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-8 sm:mt-10">
          <SectionHeading title={`More ${categoryLabel(agentCategory)} agents`} />
          <AgentGrid agents={related} />
        </section>
      )}
    </Container>
  );
}
