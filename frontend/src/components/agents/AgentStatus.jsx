import { Badge } from '../ui/Badge.jsx';

/** Availability badge with a status dot. Falls back gracefully for unknowns. */
const STATUS_MAP = {
  live: { variant: 'ok', label: 'Live', dot: 'bg-ok' },
  beta: { variant: 'info', label: 'Beta', dot: 'bg-info' },
  paused: { variant: 'warn', label: 'Paused', dot: 'bg-warn' },
};

export function AgentStatus({ status, className }) {
  const s = STATUS_MAP[status] || { variant: 'neutral', label: status || 'Unknown', dot: 'bg-faint' };
  return (
    <Badge variant={s.variant} className={className}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </Badge>
  );
}
