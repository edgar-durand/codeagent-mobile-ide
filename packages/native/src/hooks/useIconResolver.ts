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
 * Native mirror of the web `useIconResolver`. Subscribes to the
 * active icon-theme pointer (`{ id, url }`) in the SettingsStore,
 * re-fetches the upstream theme JSON whenever the pointer changes,
 * and returns a memoised `FileIconResolver`. Returns `null` while
 * loading or when no theme is installed — FileTreeSidebar treats
 * that as "fall back to default Ionicons glyphs".
 *
 * Why fetch-on-mount instead of persisting the full JSON:
 * Material Icon Theme alone is ~300 KB. AsyncStorage in RN has
 * per-row caps that vary by platform (Android default 6 MB total,
 * iOS encrypted store ~unlimited but slow). Storing only the URL
 * keeps the persisted record at a few hundred bytes; the theme
 * JSON is fetched on demand and served from the WebView's cache
 * after the first hit.
 */
export function useIconResolver(store: SettingsStore | null): FileIconResolver | null {
  const [active, setActive] = useState<ActiveIconTheme | null>(null);
  const [resolver, setResolver] = useState<FileIconResolver | null>(null);

  useEffect(() => {
    if (!store) return;
    let cancelled = false;
    void store.get(ACTIVE_ICON_THEME_STORE_KEY).then((v) => {
      if (cancelled) return;
      setActive(
        v && typeof v === 'object' && 'id' in v && 'url' in v
          ? (v as ActiveIconTheme)
          : null,
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
        try {
          const theme = parseJsonc<VSCodeIconTheme>(text);
          setResolver(buildIconResolver(theme, deriveIconThemeBaseUrl(active.url)));
        } catch (err) {
          // Theme JSON downloaded but parse / resolver build failed.
          // Loud here so users hit by malformed themes can see why
          // their tree went blank instead of guessing it's a network
          // issue.
          console.warn(
            `[useIconResolver] failed to build resolver from ${active.url}:`,
            err,
          );
          setResolver(null);
        }
      })
      .catch((err) => {
        // Loud over silent — fetch failures (CORS, 404, DNS) used to
        // leave the tree blank with no breadcrumb. The user-visible
        // symptom is "icons disappeared after reinstall"; the
        // underlying cause is almost always a stale URL pointer or
        // a marketplace mirror returning HTML.
        if (!cancelled) {
          console.warn(`[useIconResolver] fetch ${active.url} failed:`, err);
          setResolver(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

  return resolver;
}
