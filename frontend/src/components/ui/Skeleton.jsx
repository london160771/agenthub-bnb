import { cn } from '../../lib/cn.js';

/** A pulsing placeholder block for skeleton loading states. */
export function Skeleton({ className }) {
  return <div className={cn('animate-pulse rounded-md bg-panel-2', className)} />;
}
