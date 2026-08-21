import { ArrowUpDown, ChevronDown } from 'lucide-react';
import { Select } from '../ui/Input.jsx';
import { SORT_OPTIONS } from '../../lib/marketplace.js';

/** Sort control mapped to the backend sort keys. */
export function SortDropdown({ value, onChange, className }) {
  return (
    <div className={`relative ${className || ''}`}>
      <ArrowUpDown
        size={15}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
        aria-hidden="true"
      />
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Sort agents"
        className="pl-9"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-faint"
        aria-hidden="true"
      />
    </div>
  );
}
