import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../../lib/cn.js';

/**
 * Debounced search input. Controlled by the URL-driven `value`; emits `onChange`
 * ~300ms after typing stops so we don't refetch on every keystroke. Stays in
 * sync when `value` changes externally (category link, reset).
 */
export function SearchBar({ value = '', onChange, placeholder = 'Search agents, skills, protocols…', className }) {
  const [text, setText] = useState(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    // Mirror external value changes into the local input.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setText(value);
  }, [value]);

  useEffect(() => {
    if (text === value) return undefined;
    const id = setTimeout(() => onChangeRef.current?.(text), 300);
    return () => clearTimeout(id);
  }, [text, value]);

  return (
    <div className={cn('relative', className)}>
      <Search
        size={17}
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
        aria-hidden="true"
      />
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label="Search agents"
        className="h-11 w-full rounded-lg border border-line bg-base pl-10 pr-10 text-sm text-fg placeholder:text-faint transition-colors focus:border-brand/60 focus:outline-none"
      />
      {text && (
        <button
          type="button"
          onClick={() => setText('')}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-faint hover:bg-panel-2 hover:text-fg"
        >
          <X size={15} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
