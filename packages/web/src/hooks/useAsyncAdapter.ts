import { useCallback, useRef, useState } from 'react';
import type { AsyncAdapterHandle } from '@codeam/ide-core';

/**
 * Keeps an adapter readable from inside effects without making it a
 * dependency, and supplies the reload counter those effects key off.
 *
 * Pair it with `runCancellable` from `@codeam/ide-core`:
 *
 * ```ts
 * const { adapterRef, reloadCount, reload } = useAsyncAdapter(provider);
 *
 * useEffect(
 *   () =>
 *     runCancellable(async (isCancelled) => {
 *       const payload = await adapterRef.current.status();
 *       if (isCancelled()) return;
 *       setStatus(payload);
 *     }),
 *   [reloadKey, reloadCount],
 * );
 * ```
 *
 * Adapter identity staying stable across renders remains the
 * consumer's contract — this only spares effects from re-running when
 * it doesn't.
 */
export function useAsyncAdapter<T>(adapter: T): AsyncAdapterHandle<T> {
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;

  const [reloadCount, setReloadCount] = useState(0);
  const reload = useCallback(() => setReloadCount((n) => n + 1), []);

  return { adapterRef, reloadCount, reload };
}
