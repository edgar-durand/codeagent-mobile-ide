import { useEffect, useMemo, useState } from 'react';
import {
  buildIconResolver,
  type FileIconResolver,
  type SettingsStore,
  type VSCodeIconTheme,
} from '@codeam/ide-core';
import { ACTIVE_ICON_THEME_STORE_KEY, type ActiveIconTheme } from '../components/MarketplacePanel';

/**
 * Subscribe to the SettingsStore's `editor.iconTheme` key and
 * return a live `FileIconResolver` reflecting the currently-
 * active icon pack. `null` when no icon theme is installed —
 * consumers (the FileTreeSidebar) treat that as "fall back to
 * the default emoji glyphs".
 *
 * The resolver is memoised on the parsed payload identity so
 * FileTreeSidebar's renders don't re-run `iconResolver.forFile`
 * lookups in the hot path; only changing the active theme (or
 * uninstalling it) bumps the resolver reference.
 *
 * `MarketplacePanel.installIconTheme` writes the full parsed
 * theme JSON + asset baseUrl under one key, so this hook never
 * needs to fetch the network — at most it does a single
 * `store.get` on mount.
 */
export function useIconResolver(store: SettingsStore | null): FileIconResolver | null {
  const [active, setActive] = useState<ActiveIconTheme | null>(null);
  useEffect(() => {
    if (!store) return;
    let cancelled = false;
    void store.get(ACTIVE_ICON_THEME_STORE_KEY).then((v) => {
      if (cancelled) return;
      if (v && typeof v === 'object' && 'id' in v) {
        setActive(v as ActiveIconTheme);
      } else {
        setActive(null);
      }
    });
    const off = store.watch((key, value) => {
      if (key !== ACTIVE_ICON_THEME_STORE_KEY) return;
      setActive(
        value && typeof value === 'object' && 'id' in value ? (value as ActiveIconTheme) : null,
      );
    });
    return () => {
      cancelled = true;
      off();
    };
  }, [store]);

  return useMemo(() => {
    if (!active) return null;
    // `buildIconResolver` resolves relative `iconPath` entries
    // against the supplied `baseUrl`. For Material Icon Theme on
    // jsDelivr, baseUrl ends with the JSON's folder so paths like
    // `./../icons/git.svg` walk up one level into the package's
    // icons directory.
    return buildIconResolver(active.theme as VSCodeIconTheme, active.baseUrl);
  }, [active]);
}
