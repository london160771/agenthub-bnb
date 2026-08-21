import { ShieldCheck, Info } from 'lucide-react';
import { cn } from '../../lib/cn.js';
import { trustTone, confidenceLabel } from '../../lib/format.js';
import { TRUST_FACTORS, TRUST_DISCLAIMER } from '../../lib/trust.js';

/**
 * Explainable AgentHub trust breakdown: an overall score plus a per-factor
 * bar chart (Identity / Performance / Activity / Reliability / Reviews) with
 * each factor's weight. Factors without underlying data render as "No data"
 * — never invented — matching how the backend renormalises the score.
 */

const OVERALL_TONE = {
  ok: 'border-ok/30 bg-ok/10 text-ok',
  warn: 'border-warn/30 bg-warn/10 text-warn',
  bad: 'border-bad/30 bg-bad/10 text-bad',
  neutral: 'border-line bg-panel-2 text-faint',
};

const BAR_TONE = {
  ok: 'bg-ok',
  warn: 'bg-warn',
  bad: 'bg-bad',
  neutral: 'bg-faint',
};

function FactorRow({ label, weight, value, blurb }) {
  const hasData = value != null;
  const tone = trustTone(value);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-fg">{label}</span>
        <span className="text-xs text-faint">{Math.round(weight * 100)}% weight</span>
      </div>
      <div className="mt-1.5 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-panel-2" role="presentation">
          {hasData && (
            <div
              className={cn('h-full rounded-full', BAR_TONE[tone.variant])}
              style={{ width: `${value}%` }}
            />
          )}
        </div>
        <span
          className={cn('w-16 shrink-0 text-right font-mono text-sm', hasData ? 'text-fg' : 'text-faint')}
        >
          {hasData ? value : 'No data'}
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted">{blurb}</p>
    </div>
  );
}

export function TrustBreakdown({ trust = {}, className }) {
  const overall = trust.overall ?? null;
  const tone = trustTone(overall);

  return (
    <div className={className}>
      <div className="flex items-center gap-4">
        <span
          className={cn(
            'grid h-16 w-16 shrink-0 place-items-center rounded-xl border',
            OVERALL_TONE[tone.variant],
          )}
        >
          <ShieldCheck size={26} aria-hidden="true" />
        </span>
        <div>
          <p className="font-mono text-3xl font-bold leading-none text-fg">
            {overall ?? '—'}
            <span className="text-base font-normal text-faint"> / 100</span>
          </p>
          <p className="mt-1 text-sm text-muted">
            <span className="font-medium text-fg">{tone.word}</span> · {confidenceLabel(trust.confidence)}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3.5 sm:mt-6 sm:space-y-4">
        {TRUST_FACTORS.map((f) => (
          <FactorRow key={f.key} label={f.label} weight={f.weight} value={trust[f.key] ?? null} blurb={f.blurb} />
        ))}
      </div>

      <p className="mt-5 flex items-start gap-2 rounded-lg border border-line bg-panel-2 p-3 text-xs leading-relaxed text-muted sm:mt-6">
        <Info size={14} className="mt-0.5 shrink-0 text-faint" aria-hidden="true" />
        {TRUST_DISCLAIMER}
      </p>
    </div>
  );
}
