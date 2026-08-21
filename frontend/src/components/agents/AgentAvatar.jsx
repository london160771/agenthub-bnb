import { cn } from '../../lib/cn.js';

/**
 * Agent avatar: renders the provided image, or deterministic initials on a
 * colour derived from the agent id/name (so it's stable, never a broken image).
 */
const PALETTE = [
  'bg-brand/15 text-brand',
  'bg-info/15 text-info',
  'bg-ok/15 text-ok',
  'bg-warn/15 text-warn',
  'bg-bad/15 text-bad',
];

function initials(name = '') {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || '?';
}

function hashIndex(str = '', mod = PALETTE.length) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % mod;
}

const SIZES = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 text-2xl',
};

export function AgentAvatar({ name, src, seed, size = 'md', className }) {
  const dim = SIZES[size] || SIZES.md;
  if (src) {
    return (
      <img
        src={src}
        alt={name ? `${name} avatar` : 'Agent avatar'}
        className={cn('shrink-0 rounded-xl object-cover', dim, className)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn('grid shrink-0 place-items-center rounded-xl font-bold', dim, PALETTE[hashIndex(seed || name || '')], className)}
    >
      {initials(name)}
    </span>
  );
}
