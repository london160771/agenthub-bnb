import { ArrowUpRight, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '../ui/Badge.jsx';
import { Card } from '../ui/Card.jsx';
import { formatDateTime, relativeTime } from '../../lib/format.js';
import { formatMs } from '../../lib/execution.js';

export function ExecutionHistoryList({ items = [] }) {
  return (
    <div className="space-y-3">
      {items.map((execution) => {
        const paid = execution.payment?.status === 'confirmed' || execution.payment?.amount > 0;
        const agentName = execution.agent?.name || execution.agentId;
        return (
          <Card key={execution.executionId} className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/execution/${execution.executionId}`} className="font-semibold text-fg hover:text-brand">
                    {agentName}
                  </Link>
                  <Badge variant="ok">Completed</Badge>
                  <Badge variant={paid ? 'brand' : 'neutral'}>{paid ? 'Paid' : 'Free'}</Badge>
                </div>
                <p className="mt-1.5 break-words text-sm text-muted">{execution.task}</p>
              </div>
              <Link
                to={`/execution/${execution.executionId}`}
                className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand hover:text-brand-2"
              >
                View result <ArrowUpRight size={14} aria-hidden="true" />
              </Link>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-muted">
              <span title={formatDateTime(execution.completedAt || execution.createdAt)}>
                {relativeTime(execution.completedAt || execution.createdAt)}
              </span>
              <span className="inline-flex items-center gap-1"><Clock3 size={13} aria-hidden="true" /> {formatMs(execution.durationMs)}</span>
              {paid && execution.payment?.amount != null && <span>{execution.payment.amount} {execution.payment.token || execution.currency || ''}</span>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
