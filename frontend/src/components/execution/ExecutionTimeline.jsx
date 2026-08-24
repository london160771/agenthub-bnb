import { Check, Loader2, X, Circle } from 'lucide-react';
import { cn } from '../../lib/cn.js';

/**
 * The progress timeline from the spec: Agent hired → Task received → Wallet
 * verified → Querying data → Analyzing → Generating result → Complete.
 *
 * Each row's state comes straight from the backend, which marks a step done only
 * when it is actually done. So this component never fakes forward motion — if the
 * agent is genuinely still querying the chain, the earlier steps are ticked and
 * this one spins, because that is what is happening on the server.
 */

const STATE_STYLES = {
  done: { icon: Check, ring: 'border-ok/40 bg-ok/10 text-ok', label: 'text-fg' },
  active: { icon: Loader2, ring: 'border-info/40 bg-info/10 text-info', label: 'text-fg', spin: true },
  failed: { icon: X, ring: 'border-bad/40 bg-bad/10 text-bad', label: 'text-fg' },
  pending: { icon: Circle, ring: 'border-line bg-panel-2 text-faint', label: 'text-muted' },
};

function formatTime(at) {
  if (!at) return null;
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('en-US', { hour12: false });
}

export function ExecutionTimeline({ steps = [] }) {
  return (
    <ol className="space-y-1">
      {steps.map((step, i) => {
        const style = STATE_STYLES[step.state] || STATE_STYLES.pending;
        const Icon = style.icon;
        const isLast = i === steps.length - 1;
        const time = formatTime(step.at);

        return (
          <li key={step.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'grid h-8 w-8 shrink-0 place-items-center rounded-full border',
                  style.ring,
                )}
              >
                <Icon size={15} aria-hidden="true" className={cn(style.spin && 'animate-spin')} />
              </span>
              {/* Connector line between steps; the last step has none. */}
              {!isLast && (
                <span
                  className={cn(
                    'my-0.5 w-px flex-1',
                    step.state === 'done' ? 'bg-ok/30' : 'bg-line',
                  )}
                  aria-hidden="true"
                />
              )}
            </div>

            <div className={cn('flex min-h-8 flex-1 items-center justify-between gap-3 pb-3')}>
              <span className={cn('text-sm font-medium', style.label)}>
                {step.label}
                {step.state === 'active' && <span className="ml-1 text-info">…</span>}
              </span>
              {time && step.state !== 'pending' && (
                <time className="shrink-0 font-mono text-xs text-faint">{time}</time>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
