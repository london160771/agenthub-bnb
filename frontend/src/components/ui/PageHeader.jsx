import { cn } from '../../lib/cn.js';

/** Consistent page/section heading with optional eyebrow + description + actions. */
export function PageHeader({ eyebrow, title, description, actions, className }) {
  return (
    <header className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0 space-y-2">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">{eyebrow}</p>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-fg sm:text-3xl">{title}</h1>
        {/* A description can contain a 42-character wallet address, which is one
            unbreakable word — it must be allowed to break or it sets a min width
            wider than a phone. */}
        {description && (
          <p className="max-w-2xl break-words text-sm text-muted sm:text-base">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Smaller in-page section heading. */
export function SectionHeading({ title, description, actions, className }) {
  return (
    <div className={cn('mb-5 flex items-end justify-between gap-4', className)}>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-fg">{title}</h2>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
