import { useEffect, useState } from 'react';
import { getHealth } from '../../services/api.js';
import { cn } from '../../lib/cn.js';

/**
 * Small live indicator that pings the backend /api/health endpoint so users
 * (and we, during the demo) can immediately see whether the API is reachable.
 */
export function ApiStatus({ className }) {
  const [state, setState] = useState('checking'); // checking | ready | offline

  useEffect(() => {
    const controller = new AbortController();
    getHealth({ signal: controller.signal })
      .then(() => setState('ready'))
      .catch((err) => {
        if (err.name !== 'AbortError') setState('offline');
      });
    return () => controller.abort();
  }, []);

  const dot = { checking: 'bg-faint animate-pulse', ready: 'bg-ok', offline: 'bg-warn' }[state];
  const label = { checking: 'Connecting…', ready: 'API online', offline: 'API offline' }[state];

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs text-muted', className)}>
      <span className={cn('h-2 w-2 rounded-full', dot)} aria-hidden="true" />
      {label}
    </span>
  );
}
