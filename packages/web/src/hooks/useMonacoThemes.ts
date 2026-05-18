import { useEffect } from 'react';
import {
  BUNDLED_CUSTOM_THEMES,
  type MonacoTheme,
  type SettingsStore,
} from '@codeam/ide-core';
import { CUSTOM_THEMES_STORE_KEY } from '../components/SettingsPanel';

/**
 * Minimal `monaco` surface this hook needs. Avoids depending on
 * `monaco-editor` as a peer dep — the consumer passes whatever
 * Monaco instance `@monaco-editor/react`'s `onMount` handed them.
 *
 * `themeData` is typed as `unknown` for the call site. Function
 * parameters are contravariant, so a real Monaco namespace whose
 * `defineTheme` declares the stricter `IStandaloneThemeData` is
 * STILL assignable to this interface — we just promise to pass it
 * a value Monaco can handle. The runtime payload is the
 * `MonacoTheme` shape from core, which IS structurally a valid
 * `IStandaloneThemeData`.
 *
 * The earlier shape (typed-rules-and-colors literal) flipped the
 * variance the wrong way: Monaco's mutable `rules: ITokenThemeRule[]`
 * couldn't widen into our `readonly unknown[]`, breaking the
 * landing's `tsc -b` step.
 */
interface MonacoLike {
  editor: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    defineTheme: (themeName: string, themeData: any) => void;
    setTheme: (themeName: string) => void;
  };
}

interface Options {
  /**
   * Monaco namespace (typically `monaco` from
   * `@monaco-editor/react`'s `onMount(editor, monaco)`). `null` until
   * Monaco has mounted — the hook no-ops while waiting.
   */
  monaco: MonacoLike | null;
  /**
   * Settings store. The hook pulls user-imported themes from this
   * store under the `editor.customThemes` key (written by
   * `SettingsPanel`'s marketplace-import flow) and registers them
   * alongside the bundled themes.
   */
  store?: SettingsStore | null;
  /**
   * Theme name to apply after registration. Pass the current
   * `editor.theme` setting — the hook re-applies when this changes,
   * so flipping the setting updates the live editor without a
   * reload.
   */
  themeName?: string;
  /**
   * Extra custom themes provided by the consumer (in addition to
   * the bundled `github-dark` / `github-light` and anything in the
   * store). Use for app-specific palettes that ship with the host.
   */
  extras?: readonly MonacoTheme[];
}

/**
 * Register every Monaco theme (bundled + user-imported via
 * `SettingsPanel` + consumer extras) and apply the active one.
 *
 * Wire it inside the `onMount` callback of your `<Editor />`:
 *
 * ```tsx
 * const [monaco, setMonaco] = useState(null);
 * useMonacoThemes({ monaco, store, themeName: settings.theme });
 * return <Editor onMount={(_e, m) => setMonaco(m)} ... />;
 * ```
 *
 * The bundled themes register once (idempotent on Monaco's side);
 * `themeName` is re-applied whenever it changes, so the user's
 * theme picker reacts in real time.
 */
export function useMonacoThemes({ monaco, store, themeName, extras }: Options): void {
  useEffect(() => {
    if (!monaco) return;
    for (const t of BUNDLED_CUSTOM_THEMES) {
      monaco.editor.defineTheme(t.name, {
        base: t.base,
        inherit: t.inherit,
        rules: t.rules,
        colors: t.colors,
      });
    }
    if (extras) {
      for (const t of extras) {
        monaco.editor.defineTheme(t.name, {
          base: t.base,
          inherit: t.inherit,
          rules: t.rules,
          colors: t.colors,
        });
      }
    }
  }, [monaco, extras]);

  // Pull user-imported themes from the store and register them too.
  // Re-runs when the store fires a `customThemes` change so freshly
  // imported themes light up without a reload.
  useEffect(() => {
    if (!monaco || !store) return;
    let cancelled = false;
    const register = (raw: unknown) => {
      if (!Array.isArray(raw) || cancelled) return;
      for (const t of raw as MonacoTheme[]) {
        if (!t || typeof t.name !== 'string') continue;
        monaco.editor.defineTheme(t.name, {
          base: t.base,
          inherit: t.inherit,
          rules: t.rules,
          colors: t.colors,
        });
      }
    };
    void store.get(CUSTOM_THEMES_STORE_KEY).then(register);
    const off = store.watch((key, value) => {
      if (key === CUSTOM_THEMES_STORE_KEY) register(value);
    });
    return () => {
      cancelled = true;
      off();
    };
  }, [monaco, store]);

  // Apply the active theme. Runs after the defineTheme effects
  // settle (React processes effects in declaration order), so
  // setTheme is always called against a definition that exists.
  useEffect(() => {
    if (!monaco || !themeName) return;
    monaco.editor.setTheme(themeName);
  }, [monaco, themeName]);
}
