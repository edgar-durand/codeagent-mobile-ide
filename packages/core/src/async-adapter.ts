/**
 * Shared pieces of the "fetch through an adapter inside an effect"
 * pattern that every data-fetching IDE component repeats.
 *
 * Split by dependency direction: the cancellation helper is pure JS
 * and lives here, while the React half (`useAsyncAdapter`) lives in
 * `@codeam/ide-web` and `@codeam/ide-native` so this package stays
 * UI-framework-agnostic.
 */

/**
 * Reports whether the effect run that owns it has been torn down.
 * Check it after every `await` before touching state.
 */
export type CancellationCheck = () => boolean;

/** Effect body that can bail out once its run is superseded. */
export type CancellableEffect = (isCancelled: CancellationCheck) => void | Promise<void>;

/**
 * Runs `effect` and returns the teardown that cancels it — i.e. the
 * exact shape `useEffect` wants, replacing the hand-rolled
 * `let cancelled = false; … return () => { cancelled = true; };`
 * around every async fetch.
 *
 * ```ts
 * useEffect(
 *   () =>
 *     runCancellable(async (isCancelled) => {
 *       const payload = await adapterRef.current.list();
 *       if (isCancelled()) return;
 *       setFiles(payload.files);
 *     }),
 *   [reloadCount],
 * );
 * ```
 *
 * Cancelling doesn't abort in-flight work — it only stops the effect
 * from writing to a component that has moved on. Adapters that can
 * truly abort should also be handed an `AbortSignal`.
 */
export function runCancellable(effect: CancellableEffect): () => void {
  let cancelled = false;
  const isCancelled: CancellationCheck = () => cancelled;
  try {
    const result = effect(isCancelled);
    if (result) {
      // Effects are expected to handle their own failures and render an
      // error state. Anything that escapes would otherwise surface as a
      // bare unhandled rejection (a redbox on RN) with no clue which
      // component it came from, so name the source here.
      void result.catch((error: unknown) => {
        console.error('[runCancellable] uncaught error in async effect:', error);
      });
    }
  } catch (error) {
    console.error('[runCancellable] uncaught error in async effect:', error);
  }
  return () => {
    cancelled = true;
  };
}

/**
 * What `useAsyncAdapter` returns on both UI surfaces. Declared here so
 * the web and native hooks can't drift apart.
 */
export interface AsyncAdapterHandle<T> {
  /**
   * Always holds the latest adapter. Read it as `adapterRef.current`
   * inside effects so swapping adapters doesn't have to re-trigger
   * every effect that touches one.
   */
  adapterRef: { readonly current: T };
  /** Bumped by `reload`; put it in the deps of effects that should re-run. */
  reloadCount: number;
  /** Re-runs the effects keyed off `reloadCount` — retry after an error, refresh after a write. */
  reload: () => void;
}
