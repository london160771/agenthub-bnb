import { cn } from '../../lib/cn.js';

export function Spinner({ className, label = 'Loading' }) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        'inline-block h-5 w-5 animate-spin rounded-full border-2 border-line border-t-brand',
        className,
      )}
    />
  );
}

/** Full-section loading indicator with an optional message. */
export function LoadingState({ message = 'Loading…', className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-16 text-muted', className)}>
      <Spinner className="h-6 w-6" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
