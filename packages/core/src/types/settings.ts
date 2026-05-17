/**
 * Settings store adapter contract.
 *
 * The IDE doesn't pick where settings live — the consumer wires up
 * an implementation that talks to whatever persistence layer makes
 * sense for their host (localStorage for a web SPA, AsyncStorage on
 * RN, an in-app Zustand store, a sync'd cloud profile). The library
 * reads + writes through this contract and never touches the
 * underlying storage directly.
 *
 * Watch-style change notification lets settings updates from one
 * surface (the settings panel, another window, a sync push) flow
 * back into every consuming component without manual re-renders.
 */

export interface SettingsStore {
  /** Resolve to the stored value, or `undefined` if unset. */
  get(key: string): Promise<unknown>;
  /** Persist a value. Resolves once the value is durable; may also
   * fire watchers synchronously before resolving. */
  set(key: string, value: unknown): Promise<void>;
  /** Subscribe to changes for any key. Returns an `unsubscribe`
   * function. The callback fires for every successful `set` and
   * SHOULD also fire when the store reacts to external mutations
   * (e.g. cross-tab `storage` events on web). */
  watch(callback: (key: string, value: unknown) => void): () => void;
}

/** Editor settings the library recognises out-of-the-box. Consumers
 * may extend the namespace with their own keys; the library will
 * round-trip unknown keys without touching them. */
export interface EditorSettingsSnapshot {
  theme: string;
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  lineNumbers: boolean;
}

export const DEFAULT_EDITOR_SETTINGS: EditorSettingsSnapshot = {
  theme: 'vs-dark',
  fontSize: 13,
  tabSize: 2,
  wordWrap: true,
  minimap: false,
  lineNumbers: true,
};
