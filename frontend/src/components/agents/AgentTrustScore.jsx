import { ShieldCheck } from 'lucide-react';
import { cn } from '../../lib/cn.js';
import { trustTone, confidenceLabel } from '../../lib/format.js';

/**
 * Compact AgentHub trust score chip. This is AgentHub's OWN explainable score
 * (Identity/Performance/Activity/Reliability/Reviews), not an official BNB
 * endorsement. A null score renders as "—/Unrated" — never invented.
 */
const TONE = {
  ok: 'border-ok/30 text-ok',
  warn: 'border-warn/30 text-warn',
  bad: 'border-bad/30 text-bad',
  neutral: 'border-line text-faint',
};

export function AgentTrustScore({ score, confidence, className }) {
  const tone = trustTone(score);
  const conf = confidence != null ? ` · ${confidenceLabel(confidence)}` : '';
  return (
    <div
      className={cn('inline-flex items-center gap-2 rounded-lg border px-2.5 py-1', TONE[tone.variant], className)}
      title={`AgentHub trust score${conf}`}
    >
      <ShieldCheck size={15} aria-hidden="true" />
      <span className="font-mono text-sm font-semibold leading-none">{score == null ? '—' : score}</span>
      <span className="text-[11px] font-medium leading-none opacity-80">{tone.word}</span>
    </div>
  );
}
