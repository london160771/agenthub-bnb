import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn.js';

const VARIANTS = {
  primary: 'bg-brand text-black hover:bg-brand-2 shadow-sm shadow-brand/20',
  secondary: 'bg-panel-2 text-fg border border-line hover:border-line-strong',
  outline: 'border border-line-strong text-fg hover:bg-panel-2',
  ghost: 'text-muted hover:text-fg hover:bg-panel-2',
  danger: 'bg-bad/15 text-bad border border-bad/30 hover:bg-bad/25',
};

const SIZES = {
  sm: 'h-9 px-3 text-sm rounded-lg',
  md: 'h-11 px-4 text-sm rounded-lg',
  lg: 'h-12 px-6 text-base rounded-xl',
  icon: 'h-10 w-10 rounded-lg',
};

function classesFor({ variant = 'primary', size = 'md', className }) {
  return cn(
    'inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap transition-colors duration-150',
    'focus-visible:outline-2 focus-visible:outline-brand',
    'disabled:opacity-50 disabled:pointer-events-none',
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export function Button({ variant, size, className, type = 'button', ...props }) {
  return <button type={type} className={classesFor({ variant, size, className })} {...props} />;
}

/** A router Link styled as a button — for navigation-as-action (Hire, View...). */
export function ButtonLink({ variant, size, className, ...props }) {
  return <Link className={classesFor({ variant, size, className })} {...props} />;
}
