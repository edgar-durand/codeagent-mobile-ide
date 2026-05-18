import { useEffect, useState } from 'react';
import {
  buildIconResolver,
  parseJsonc,
  type FileIconResolver,
  type SettingsStore,
  type VSCodeIconTheme,
} from '@codeam/ide-core';
import {
  ACTIVE_ICON_THEME_STORE_KEY,
  deriveIconThemeBaseUrl,
  type ActiveIconTheme,
} from '../components/MarketplacePanel';

/**
 * Subscribe to the active file-icon theme pointer in the
 * SettingsStore and return a live `FileIconResolver`. Re-fetches
 * the theme JSON from the persisted URL on every active-theme
 * change; for any sensible CDN (jsDelivr, raw.githubusercontent
 * .com) the browser serves it from cache within ~10 ms after the
 * first hit.
 *
 * Why fetch-on-mount instead of persisting the full JSON:
 * Material Icon Theme alone is 307 KB; with zustand's persisted
 * chat history + other settings we routinely cross the 5 MB
 * localStorage quota. `setItem` then throws QuotaExceededError,
 * the store swallows it, and the theme silently fails to persist
 * — so the user sees icons disappear on reload until they re-
 * install. Storing only the URL pointer keeps the persisted
 * record under a kilobyte.
 *
 * Returns `null` while loading (or when no theme is installed).
 * Consumers should treat that as "fall back to default emoji
 * glyphs" — the same UX as no theme installed.
 */
export function useIconResolver(store: SettingsStore | null): FileIconResolver | null {
  const [active, setActive] = useState<ActiveIconTheme | null>(null);
  const [resolver, setResolver] = useState<FileIconResolver | null>(null);

  // Track the active theme pointer.
  useEffect(() => {
    if (!store) return;
    let cancelled = false;
    void store.get(ACTIVE_ICON_THEME_STORE_KEY).then((v) => {
      if (cancelled) return;
      setActive(
        v && typeof v === 'object' && 'id' in v && 'url' in v ? (v as ActiveIconTheme) : null,
      );
    });
    const off = store.watch((key, value) => {
      if (key !== ACTIVE_ICON_THEME_STORE_KEY) return;
      setActive(
        value && typeof value === 'object' && 'id' in value && 'url' in value
          ? (value as ActiveIconTheme)
          : null,
      );
    });
    return () => {
      cancelled = true;
      off();
    };
  }, [store]);

  // Fetch + parse the theme JSON whenever the pointer changes.
  useEffect(() => {
    if (!active) {
      setResolver(null);
      return;
    }
    let cancelled = false;
    void fetch(active.url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        if (cancelled) return;
        const theme = parseJsonc<VSCodeIconTheme>(text);
        setResolver(buildIconResolver(theme, deriveIconThemeBaseUrl(active.url)));
      })
      .catch(() => {
        // Silent — return null resolver so the tree falls back
        // to default glyphs. The marketplace panel will surface
        // any error on re-install.
        if (!cancelled) setResolver(null);
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

  return resolver;
}
