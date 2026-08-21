import { cn } from '../../lib/cn.js';

export function Card({ as: Tag = 'div', className, interactive = false, ...props }) {
  return (
    <Tag
      className={cn(
        'rounded-xl border border-line bg-panel',
        interactive &&
          'transition-colors duration-150 hover:border-line-strong hover:bg-panel-2',
        className,
      )}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }) {
  return <div className={cn('p-4 sm:p-5', className)} {...props} />;
}
