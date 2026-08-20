import { cn } from '../../lib/cn.js';

const fieldBase =
  'w-full rounded-lg border border-line bg-base text-sm text-fg placeholder:text-faint ' +
  'transition-colors focus:border-brand/60 focus:outline-none disabled:opacity-50';

export function Input({ className, ...props }) {
  return <input className={cn(fieldBase, 'h-11 px-3.5', className)} {...props} />;
}

export function Textarea({ className, ...props }) {
  return <textarea className={cn(fieldBase, 'min-h-28 px-3.5 py-3 leading-relaxed', className)} {...props} />;
}

export function Select({ className, children, ...props }) {
  return (
    <select className={cn(fieldBase, 'h-11 px-3.5 pr-9 appearance-none cursor-pointer', className)} {...props}>
      {children}
    </select>
  );
}

export function Label({ className, ...props }) {
  return (
    <label
      className={cn('block text-xs font-medium text-muted mb-1.5', className)}
      {...props}
    />
  );
}
