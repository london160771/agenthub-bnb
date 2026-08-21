import { SlidersHorizontal, RotateCcw } from 'lucide-react';
import { cn } from '../../lib/cn.js';
import { STATUS_OPTIONS, TRUST_OPTIONS, SUCCESS_OPTIONS, PRICE_BUCKETS } from '../../lib/marketplace.js';

function PillGroup({ label, options, value, onSelect }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onSelect(o.value)}
              aria-pressed={active}
              className={cn(
                'rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors',
                active
                  ? 'border-brand/40 bg-brand/10 text-brand'
                  : 'border-line bg-panel text-muted hover:border-line-strong hover:text-fg',
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Marketplace filter controls. `filters` is a plain object of selected values;
 * `onChange` receives a partial patch to merge. All values map to backend query
 * params. Price is denominated in BNB (USD conversion deferred to the wallet phase).
 */
export function FilterPanel({ filters, onChange, onReset, activeCount = 0, className }) {
  return (
    <div className={cn('space-y-5', className)}>
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-fg">
          <SlidersHorizontal size={16} className="text-brand" aria-hidden="true" />
          Filters
          {activeCount > 0 && (
            <span className="rounded-full bg-brand/15 px-1.5 text-xs font-medium text-brand">{activeCount}</span>
          )}
        </span>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-fg"
          >
            <RotateCcw size={13} aria-hidden="true" /> Reset
          </button>
        )}
      </div>

      <PillGroup
        label="Availability"
        options={STATUS_OPTIONS}
        value={filters.status}
        onSelect={(v) => onChange({ status: v })}
      />

      <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
        <input
          type="checkbox"
          checked={!!filters.verified}
          onChange={(e) => onChange({ verified: e.target.checked })}
          className="h-4 w-4 rounded border-line bg-base accent-brand"
        />
        AgentHub-verified only
      </label>

      <PillGroup
        label="Trust score"
        options={TRUST_OPTIONS}
        value={filters.trust}
        onSelect={(v) => onChange({ trust: v })}
      />
      <PillGroup
        label="Success rate"
        options={SUCCESS_OPTIONS}
        value={filters.success}
        onSelect={(v) => onChange({ success: v })}
      />
      <PillGroup
        label="Price (BNB)"
        options={PRICE_BUCKETS}
        value={filters.price}
        onSelect={(v) => onChange({ price: v })}
      />
    </div>
  );
}
