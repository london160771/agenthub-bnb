import { cn } from '../../lib/cn.js';
import { CATEGORIES } from '../../config.js';

/**
 * Category tabs (All + the six spec categories) with live counts from the
 * /agents/facets endpoint. `value` of null means "All".
 */
export function CategoryTabs({ value, onChange, facets, className }) {
  const counts = {};
  let total = 0;
  if (facets) {
    total = facets.total ?? 0;
    for (const c of facets.categories || []) counts[c.category] = c.count;
  }

  const tabs = [
    { id: null, label: 'All', count: facets ? total : null },
    ...CATEGORIES.map((c) => ({
      id: c.id,
      label: c.label,
      count: facets ? counts[c.id] || 0 : null,
    })),
  ];

  return (
    <div className={cn('flex gap-2 overflow-x-auto pb-1', className)}>
      {tabs.map((tab) => {
        const active = (value || null) === tab.id;
        return (
          <button
            key={tab.id ?? 'all'}
            type="button"
            onClick={() => onChange(tab.id)}
            aria-pressed={active}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'border-brand/40 bg-brand/10 text-brand'
                : 'border-line bg-panel text-muted hover:border-line-strong hover:text-fg',
            )}
          >
            {tab.label}
            {tab.count != null && (
              <span className={cn('text-xs', active ? 'text-brand/70' : 'text-faint')}>{tab.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
