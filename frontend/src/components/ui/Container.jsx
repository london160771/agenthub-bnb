import { cn } from '../../lib/cn.js';

/** Centered max-width page container with responsive gutters. */
export function Container({ as: Tag = 'div', className, ...props }) {
  return (
    <Tag className={cn('mx-auto w-full max-w-7xl px-5 sm:px-6 lg:px-8', className)} {...props} />
  );
}
