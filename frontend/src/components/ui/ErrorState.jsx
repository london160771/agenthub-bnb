import { AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/cn.js';
import { Button } from './Button.jsx';

/**
 * Standard error panel for failed data loads. Accepts either an Error/ApiError
 * or a plain message, and an optional retry handler.
 */
export function ErrorState({ error, message, onRetry, className }) {
  const text =
    message || error?.message || 'Something went wrong while loading this content.';

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-bad/25 bg-bad/5 px-6 py-14 text-center',
        className,
      )}
    >
      <span className="grid h-12 w-12 place-items-center rounded-full bg-bad/10 text-bad">
        <AlertTriangle size={22} aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-fg">Unable to load</h3>
        <p className="mx-auto max-w-sm text-sm text-muted">{text}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-1">
          <RefreshCw size={15} aria-hidden="true" />
          Try again
        </Button>
      )}
    </div>
  );
}
