import { Link } from 'react-router-dom';
import { Star, X } from 'lucide-react';
import { Badge } from '../ui/Badge.jsx';
import { Button, ButtonLink } from '../ui/Button.jsx';
import { AgentAvatar } from '../agents/AgentAvatar.jsx';
import { AgentStatus } from '../agents/AgentStatus.jsx';
import { AgentTrustScore } from '../agents/AgentTrustScore.jsx';
import { SOURCE_LABELS } from '../../config.js';
import { cn } from '../../lib/cn.js';
import { trustTone } from '../../lib/format.js';
import { COMPARE_SECTIONS, computeBestByRow } from '../../lib/compare.js';

/**
 * Side-by-side comparison matrix for 2–4 agents.
 *
 * Same layout at every breakpoint: fixed-width agent columns inside a
 * horizontally scrolling container, with the attribute-label column pinned
 * (`sticky left-0`) so you never lose track of which row you're reading.
 *
 * Best-in-row highlighting comes from `computeBestByRow`, which only ranks
 * numeric rows that have data on at least two agents — so a highlight always
 * means "measurably best on this metric", never a guess.
 */

// Matches TrustBreakdown's bar palette so the two views feel like one system.
const BAR_TONE = {
  ok: 'bg-ok',
  warn: 'bg-warn',
  bad: 'bg-bad',
  neutral: 'bg-faint',
};

const LABEL_CELL = 'sticky left-0 z-10 w-32 shrink-0 px-4 sm:w-40';
// Fixed 14rem floor so columns never squeeze, but `grow` lets them share the
// spare width on desktop instead of leaving dead space beside the last agent.
const AGENT_CELL = 'w-56 shrink-0 grow border-l border-line px-4';

/** One agent's column header: identity, provenance, trust and the hire CTA. */
function AgentColumnHeader({ agent, onRemove }) {
  const { agentId, name, tagline, avatar, status, source, trustScore, trust = {} } = agent;
  const provenance = SOURCE_LABELS[source];

  return (
    <div className={cn(AGENT_CELL, 'py-4')}>
      <div className="flex items-start justify-between gap-2">
        <AgentAvatar name={name} seed={agentId} src={avatar} size="md" />
        {onRemove && (
          <Button
            variant="ghost"
            size="icon"
            className="-mr-2 -mt-1 h-8 w-8"
            onClick={() => onRemove(agentId)}
            aria-label={`Remove ${name} from the comparison`}
            title="Remove from comparison"
          >
            <X size={15} aria-hidden="true" />
          </Button>
        )}
      </div>

      <Link
        to={`/agents/${agentId}`}
        className="mt-2.5 block truncate font-semibold text-fg transition-colors hover:text-brand"
        title={name}
      >
        {name}
      </Link>
      {tagline && (
        <p className="truncate text-xs text-muted" title={tagline}>
          {tagline}
        </p>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <AgentStatus status={status} />
        {provenance && <Badge variant={provenance.variant}>{provenance.label}</Badge>}
      </div>

      <AgentTrustScore
        score={trustScore ?? trust.overall}
        confidence={trust.confidence}
        className="mt-2.5"
      />

      <ButtonLink to={`/hire/${agentId}`} variant="primary" size="sm" className="mt-3 w-full">
        Hire
      </ButtonLink>
    </div>
  );
}

/** A single agent's value for a single attribute row. */
function ValueCell({ agent, row, isBest }) {
  const value = row.get(agent);

  if (row.kind === 'chips') {
    const items = Array.isArray(value) ? value : [];
    return (
      <div className={cn(AGENT_CELL, 'py-2.5')}>
        {items.length === 0 ? (
          <span className="text-sm text-faint">—</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {items.map((item) => (
              <Badge key={item} variant={row.variant || 'neutral'}>
                {item}
              </Badge>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (row.kind === 'source') {
    const provenance = SOURCE_LABELS[value];
    return (
      <div className={cn(AGENT_CELL, 'py-2.5')}>
        {provenance ? (
          <Badge variant={provenance.variant}>{provenance.label}</Badge>
        ) : (
          <span className="text-sm text-faint">{value || '—'}</span>
        )}
      </div>
    );
  }

  const hasData = value != null;
  const text = row.format ? row.format(value, agent) : String(value ?? '—');
  const tone = trustTone(value);

  return (
    <div className={cn(AGENT_CELL, 'py-2.5')}>
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            'text-sm',
            row.mono && 'break-all font-mono text-xs',
            !hasData && 'text-faint',
            hasData && (isBest ? 'font-semibold text-ok' : 'text-fg'),
          )}
          title={row.mono && hasData ? String(value) : undefined}
        >
          {text}
        </span>
        {isBest && (
          <Star
            size={13}
            className="shrink-0 fill-warn text-warn"
            aria-label="Best in this row"
            title="Best in this row"
          />
        )}
      </div>

      {/* 0–100 factors get a bar so relative standing is readable at a glance. */}
      {row.kind === 'score' && (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-panel-2" role="presentation">
          {hasData && (
            <div
              className={cn('h-full rounded-full', BAR_TONE[tone.variant])}
              style={{ width: `${Math.max(0, Math.min(100, Number(value)))}%` }}
            />
          )}
        </div>
      )}
    </div>
  );
}

export function ComparisonMatrix({ agents = [], onRemove, className }) {
  if (agents.length === 0) return null;

  return (
    <div className={cn('overflow-x-auto rounded-xl border border-line bg-panel', className)}>
      {/* `w-max` sizes to the widest row so section bands span the full matrix;
          `min-w-full` keeps it flush with the container on wide screens. */}
      <div className="w-max min-w-full">
        {/* Header */}
        <div className="flex border-b border-line">
          <div className={cn(LABEL_CELL, 'bg-panel py-4')}>
            <span className="text-xs font-semibold uppercase tracking-wide text-faint">
              {agents.length} agents
            </span>
          </div>
          {agents.map((agent) => (
            <AgentColumnHeader key={agent.agentId} agent={agent} onRemove={onRemove} />
          ))}
        </div>

        {/* Sections */}
        {COMPARE_SECTIONS.map((section) => (
          <div key={section.key}>
            <div className="flex w-full border-b border-line bg-panel-2">
              <div className={cn(LABEL_CELL, 'bg-panel-2 py-2')}>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {section.title}
                </span>
              </div>
            </div>

            {section.rows.map((row) => {
              const best = computeBestByRow(agents, row);
              return (
                <div
                  key={row.key}
                  className="group/row flex border-b border-line last:border-b-0 hover:bg-panel-2"
                >
                  <div
                    className={cn(
                      LABEL_CELL,
                      'flex items-center bg-panel py-2.5 group-hover/row:bg-panel-2',
                    )}
                  >
                    <span className="text-xs font-medium text-muted sm:text-sm">{row.label}</span>
                  </div>
                  {agents.map((agent) => (
                    <ValueCell
                      key={agent.agentId}
                      agent={agent}
                      row={row}
                      isBest={best.has(agent.agentId)}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
