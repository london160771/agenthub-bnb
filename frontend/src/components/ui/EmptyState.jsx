import { Inbox } from 'lucide-react';
import { cn } from '../../lib/cn.js';

/**
 * Neutral empty state for lists/searches that returned no results.
 * Pass an `action` node (e.g. a Button) to guide the user forward.
 */
export function EmptyState({ icon: Icon = Inbox, title = 'Nothing here yet', description, action, className }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line px-6 py-16 text-center',
        className,
      )}
    >
      <span className="grid h-12 w-12 place-items-center rounded-full bg-panel-2 text-faint">
        <Icon size={22} aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-fg">{title}</h3>
        {description && <p className="mx-auto max-w-sm text-sm text-muted">{description}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
