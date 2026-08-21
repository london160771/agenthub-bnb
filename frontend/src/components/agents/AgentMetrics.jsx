import { Activity, CheckCircle2, Timer } from 'lucide-react';
import { formatCompactNumber, formatPercent, formatDuration } from '../../lib/format.js';

function Stat({ icon: Icon, value, label }) {
  return (
    <div className="flex items-center gap-1.5" title={label}>
      <Icon size={14} className="text-faint" aria-hidden="true" />
      <span className="font-medium text-fg">{value}</span>
    </div>
  );
}

/** Inline row of headline agent metrics. Nulls render as "—". */
export function AgentMetrics({ metrics = {}, className }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted ${className || ''}`}>
      <Stat icon={CheckCircle2} value={formatPercent(metrics.successRate)} label="Success rate" />
      <Stat icon={Activity} value={formatCompactNumber(metrics.executions)} label="Executions" />
      <Stat icon={Timer} value={formatDuration(metrics.avgResponseTime)} label="Avg response time" />
    </div>
  );
}
