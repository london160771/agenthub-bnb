import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Small data-fetching hook that standardises the loading / error / success
 * lifecycle every page in the spec requires. Handles abort on unmount and
 * exposes `refetch`.
 *
 * @param {(signal: AbortSignal) => Promise<any>} fetcher
 * @param {Array} deps  Re-run the fetcher when these change.
 * @param {{ immediate?: boolean }} options
 */
export function useApi(fetcher, deps = [], { immediate = true } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(immediate);

  // Keep a reference to the latest fetcher without re-triggering the effect;
  // updated after commit so we never mutate a ref during render.
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const run = useCallback(async (signal) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current(signal);
      if (!signal || !signal.aborted) {
        setData(result);
        setLoading(false);
      }
      return result;
    } catch (err) {
      if (err.name !== 'AbortError' && (!signal || !signal.aborted)) {
        setError(err);
        setLoading(false);
      }
      return undefined;
    }
  }, []);

  useEffect(() => {
    if (!immediate) return undefined;
    const controller = new AbortController();
    // Fetch-on-mount legitimately drives state from an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    run(controller.signal);
    return () => controller.abort();
    // `deps` is supplied by the caller by design; `run` is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const refetch = useCallback(() => run(), [run]);

  return { data, error, loading, refetch, setData };
}
