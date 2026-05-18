import { useEffect, useMemo, useState } from 'react';
import {
  buildIconResolver,
  type FileIconResolver,
  type SettingsStore,
  type VSCodeIconTheme,
} from '@codeam/ide-core';
import {
  ACTIVE_ICON_THEME_STORE_KEY,
  type ActiveIconTheme,
} from '../components/MarketplacePanel';

/**
 * Native mirror of the web `useIconResolver`. Subscribes to the
 * SettingsStore's `editor.iconTheme` key and returns a live
 * FileIconResolver wired to the active icon pack. `null` when no
 * icon theme is installed — FileTreeSidebar falls back to its
 * default Ionicons glyph in that case.
 *
 * The resolver memoises on the parsed payload identity so the hot
 * tree-render path doesn't re-build the lookup table per row.
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
        value && typeof value === 'object' && 'id' in value
          ? (value as ActiveIconTheme)
          : null,
      );
    });
    return () => {
      cancelled = true;
      off();
    };
  }, [store]);

  return useMemo(() => {
    if (!active) return null;
    return buildIconResolver(active.theme as VSCodeIconTheme, active.baseUrl);
  }, [active]);
}
