/* eslint-disable react-hooks/set-state-in-effect -- initial URL query fetch is intentional */
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, Sparkles, ArrowRight, Shield, Coins, Activity as ActivityIcon, Info } from 'lucide-react';
import { Container } from '../components/ui/Container.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import { Button, ButtonLink } from '../components/ui/Button.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { ErrorState } from '../components/ui/ErrorState.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { AgentAvatar } from '../components/agents/AgentAvatar.jsx';
import { AgentStatus } from '../components/agents/AgentStatus.jsx';
import { SOURCE_LABELS } from '../config.js';
import { searchFinder } from '../services/finder.js';
import { formatBnb } from '../lib/format.js';

const EXAMPLES = [
  'I need an agent that monitors my Venus lending position and warns me before liquidation.',
  'Find me a yield optimizer for stablecoins on BSC.',
  'I want a grid trading bot for BNB/USDT via PancakeSwap',
  'Show me portfolio rebalancing agents',
];

function MatchBadge({ pct }) {
  const variant = pct >= 80 ? 'ok' : pct >= 60 ? 'info' : pct >= 40 ? 'warn' : 'neutral';
  return <Badge variant={variant}>{pct}% match</Badge>;
}

function RecommendationCard({ item }) {
  const { agent, match } = item;
  const sourceMeta = SOURCE_LABELS[agent.source] || SOURCE_LABELS.seeded;
  const isIndexed = agent.source === 'indexed';
  const canHireLocal = !isIndexed; // indexed agents are discoverable only in MVP

  return (
    <Card className="flex flex-col p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <AgentAvatar name={agent.name} seed={agent.agentId} src={agent.avatar} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold text-fg">{agent.name}</h3>
            <MatchBadge pct={match.pct} />
          </div>
          <p className="truncate text-sm text-muted">{agent.tagline || agent.description?.slice(0, 120)}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant={sourceMeta.variant} title={sourceMeta.label}>{sourceMeta.label}</Badge>
            <Badge variant="neutral">{agent.category}</Badge>
            <AgentStatus status={agent.status} />
            {agent.erc8004Id && <span className="font-mono text-xs text-faint">{agent.erc8004Id}</span>}
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-line bg-panel-2 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">Why it matches</p>
        <ul className="mt-1.5 space-y-1">
          {match.reasons.slice(0, 3).map((r, i) => (
            <li key={i} className="flex gap-1.5 text-xs leading-relaxed text-muted">
              <span className="text-brand">·</span>{r}
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-faint">
          <span className="inline-flex items-center gap-1"><Shield size={12} /> Trust {agent.trustScore ?? agent.trust?.overall ?? '—'}</span>
          <span className="inline-flex items-center gap-1"><ActivityIcon size={12} /> {agent.metrics?.successRate ?? '—'}% success</span>
          <span className="inline-flex items-center gap-1"><Coins size={12} /> {formatBnb(agent.pricing?.amount)}</span>
        </div>
      </div>

      {isIndexed && (
        <div className="mt-3 flex gap-2 rounded-lg border border-info/20 bg-info/5 p-2.5">
          <Info size={14} className="mt-0.5 shrink-0 text-info" />
          <p className="text-xs leading-relaxed text-muted">
            Registry agent — discoverable via 8004scan on BSC (chain 56). Not executable through the local testnet executor in this MVP. View profile for registry details.
          </p>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <ButtonLink to={`/agents/${agent.agentId}`} variant="outline" size="sm" className="flex-1">
          View agent
        </ButtonLink>
        {canHireLocal ? (
          <ButtonLink to={`/hire/${agent.agentId}`} size="sm" className="flex-1">
            Hire <ArrowRight size={14} />
          </ButtonLink>
        ) : (
          <Button disabled size="sm" className="flex-1" title="Indexed agents are discoverable only — execution is local to seeded agents">
            Hire — registry only
          </Button>
        )}
      </div>
    </Card>
  );
}

export default function FindPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialQ = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQ);
  const [submitted, setSubmitted] = useState(initialQ);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const doSearch = async (q) => {
    const trimmed = String(q || '').trim();
    if (!trimmed) return;
    setError(null);
    setLoading(true);
    try {
      const res = await searchFinder(trimmed, { limit: 12 });
      setData(res);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialQ) doSearch(initialQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = (e) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSubmitted(q);
    navigate(`/find?q=${encodeURIComponent(q)}`, { replace: false });
    doSearch(q);
  };

  const intentLabel = data?.intent?.category ? `Intent: ${data.intent.category}` : 'Intent: —';
  const intentSource = data?.intent?.source ? `(${data.intent.source}${data.intent.aiConfigured ? ', AI configured' : ', keyword fallback'})` : '';

  return (
    <Container className="py-8 lg:py-12">
      <PageHeader
        eyebrow="AI Finder"
        title="Find an Agent"
        description="Describe your task in plain language. AgentHub classifies the intent and ranks agents with a deterministic score — AI helps when configured, otherwise a keyword fallback is used."
      />

      <Card className="mt-6">
        <CardBody>
          <form onSubmit={onSubmit} className="space-y-3">
            <label htmlFor="finder-input" className="text-sm font-medium text-fg">What do you need an agent to do?</label>
            <textarea
              id="finder-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="I need an agent that monitors my Venus lending position and warns me before liquidation."
              rows={3}
              className="w-full rounded-xl border border-line bg-base px-4 py-3 text-sm text-fg placeholder:text-faint focus:border-brand/60 focus:outline-none"
              maxLength={500}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={!query.trim() || loading}>
                <Search size={16} /> {loading ? 'Searching…' : 'Find agents'}
              </Button>
              <span className="text-xs text-faint">Deterministic 40/20/15/10/10/5 scoring — explainable, not arbitrary.</span>
            </div>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => { setQuery(ex); setSubmitted(ex); navigate(`/find?q=${encodeURIComponent(ex)}`); doSearch(ex); }}
                className="rounded-full border border-line bg-panel px-3 py-1.5 text-left text-xs text-muted hover:border-brand/40 hover:text-fg"
              >
                {ex}
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      {submitted && (
        <div className="mt-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge variant="brand"><Sparkles size={12} /> Finder</Badge>
            <span className="text-sm text-muted">{intentLabel} <span className="text-faint">{intentSource}</span></span>
            {data && <span className="text-sm text-faint">· {data.total} results for “{submitted}”</span>}
          </div>

          {error && <ErrorState error={error} onRetry={() => doSearch(submitted)} />}

          {!error && loading && (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="p-5"><Skeleton className="h-20 w-full" /></Card>
              ))}
            </div>
          )}

          {!error && !loading && data && data.results.length === 0 && (
            <EmptyState
              icon={Search}
              title="No agents matched"
              description="Try a broader query or clear filters. All 6 categories are searchable — e.g. 'Venus health factor', 'yield', 'grid trading'."
            />
          )}

          {!error && !loading && data && data.results.length > 0 && (
            <>
              <div className="mb-3 flex items-center gap-2 text-xs text-faint">
                <Info size={12} /> Top match highlighted — scores are deterministic and explainable. Indexed agents show “Indexed” provenance and are not hireable via local executor.
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {data.results.map((item) => (
                  <RecommendationCard key={item.agent.agentId} item={item} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {!submitted && !loading && (
        <Card className="mt-6 border-dashed">
          <CardBody>
            <p className="text-sm text-muted">Enter a task above to see ranked agents. The catalogue includes <span className="font-medium text-fg">seeded demo agents</span> and, when ingested, <span className="font-medium text-fg">live BSC registry agents (indexed)</span> — each clearly labelled.</p>
            <div className="mt-3 flex gap-2">
              <ButtonLink variant="outline" to="/discover">Browse marketplace</ButtonLink>
            </div>
          </CardBody>
        </Card>
      )}
    </Container>
  );
}
