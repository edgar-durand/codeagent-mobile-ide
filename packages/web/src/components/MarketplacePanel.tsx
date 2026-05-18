import { useEffect, useMemo, useState } from 'react';
import {
  ICON_THEMES,
  MARKETPLACE_THEMES,
  parseJsonc,
  vscodeThemeToMonaco,
  type MarketplaceIconThemeRef,
  type MarketplaceThemeRef,
  type MonacoTheme,
  type SettingsStore,
  type VSCodeColorTheme,
  type VSCodeIconTheme,
} from '@codeam/ide-core';
import { CUSTOM_THEMES_STORE_KEY } from './SettingsPanel';

/**
 * Storage key for the active file-icon theme. Holds either `null`
 * (no icon theme — FileTreeSidebar falls back to the default
 * emoji glyphs) or just `{ id, url }` — a POINTER to the theme,
 * not the theme JSON itself.
 *
 * Earlier versions stored the parsed VS Code icon-theme JSON
 * inline. Real-world themes are huge (Material Icon Theme is
 * 307 KB), and combined with other zustand-persisted state the
 * 5 MB localStorage quota tripped on some users; `setItem` then
 * silently threw QuotaExceededError and the theme didn't survive
 * a reload. Storing the URL only keeps the persisted record at
 * a few hundred bytes; `useIconResolver` re-fetches the JSON on
 * mount, served from the browser cache for any sensible CDN.
 */
export const ACTIVE_ICON_THEME_STORE_KEY = 'editor.iconTheme';

export interface ActiveIconTheme {
  /** Display name (the marketplace entry's `name`). */
  id: string;
  /** Direct URL to the upstream `*-icon-theme.json`. */
  url: string;
}

/**
 * Strip the JSON's filename to derive the base URL that relative
 * `iconPath` entries resolve against. VS Code icon themes place
 * `./icons/foo.svg` references RELATIVE to the JSON's own folder.
 * Exported so `useIconResolver` can re-derive it from a stored URL
 * pointer without persisting baseUrl separately.
 */
export function deriveIconThemeBaseUrl(jsonUrl: string): string {
  return jsonUrl.replace(/[^/]+$/, '');
}

interface Props {
  /** Persists installed themes + currently-active theme. Required —
   * a marketplace panel without a SettingsStore can't actually
   * install anything that survives a reload. */
  store: SettingsStore;
  /** Override or extend the curated list. Defaults to
   * `MARKETPLACE_THEMES` from core. */
  themes?: readonly MarketplaceThemeRef[];
  /** Override the file-icon-themes list. Defaults to `ICON_THEMES`. */
  iconThemes?: readonly MarketplaceIconThemeRef[];
  /** Optional title (defaults to "Marketplace"). */
  title?: string;
}

type Filter = 'all' | 'dark' | 'light' | 'installed';
type Tab = 'colors' | 'icons';

/**
 * VS Code-style themes marketplace browser. Renders each curated
 * theme as a card with a 3-swatch color preview, name, publisher,
 * description, and an Install / Active button. Includes a search
 * box + a filter strip (All / Dark / Light / Installed) at the
 * top, mirroring the Extensions panel layout.
 *
 * Install fetches the theme JSON directly from the curated URL,
 * converts it via `vscodeThemeToMonaco`, persists it under
 * `editor.customThemes` in the SettingsStore, and flips
 * `editor.theme` to make it active. The InlineEditor's
 * `useMonacoThemes` picks up the new theme automatically — no
 * page reload, no consumer wiring.
 */
export function MarketplacePanel({
  store,
  themes = MARKETPLACE_THEMES,
  iconThemes = ICON_THEMES,
  title = 'Marketplace',
}: Props) {
  const [tab, setTab] = useState<Tab>('colors');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [installed, setInstalled] = useState<MonacoTheme[]>([]);
  const [activeTheme, setActiveTheme] = useState<string>('vs-dark');
  const [activeIconTheme, setActiveIconTheme] = useState<ActiveIconTheme | null>(null);
  const [busyName, setBusyName] = useState<string | null>(null);
  const [errorByName, setErrorByName] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    void store.get(CUSTOM_THEMES_STORE_KEY).then((v) => {
      if (cancelled) return;
      if (Array.isArray(v)) setInstalled(v as MonacoTheme[]);
    });
    void store.get('editor').then((v) => {
      if (cancelled) return;
      if (v && typeof v === 'object' && 'theme' in v && typeof v.theme === 'string') {
        setActiveTheme(v.theme);
      }
    });
    void store.get(ACTIVE_ICON_THEME_STORE_KEY).then((v) => {
      if (cancelled) return;
      if (v && typeof v === 'object' && 'id' in v) setActiveIconTheme(v as ActiveIconTheme);
    });
    const off = store.watch((key, value) => {
      if (key === CUSTOM_THEMES_STORE_KEY && Array.isArray(value)) {
        setInstalled(value as MonacoTheme[]);
      } else if (
        key === 'editor' &&
        value &&
        typeof value === 'object' &&
        'theme' in value &&
        typeof value.theme === 'string'
      ) {
        setActiveTheme(value.theme);
      } else if (key === ACTIVE_ICON_THEME_STORE_KEY) {
        setActiveIconTheme(
          value && typeof value === 'object' && 'id' in value
            ? (value as ActiveIconTheme)
            : null,
        );
      }
    });
    return () => {
      cancelled = true;
      off();
    };
  }, [store]);

  const installIconTheme = async (ref: MarketplaceIconThemeRef) => {
    setBusyName(ref.name);
    setErrorByName((prev) => {
      const next = { ...prev };
      delete next[ref.name];
      return next;
    });
    try {
      // Validate by fetching + parsing once at install time so we
      // surface bad URLs / malformed JSON to the user immediately
      // instead of silently failing later when the icon tree
      // tries to render. We then DISCARD the parsed theme — only
      // the URL is persisted. See ACTIVE_ICON_THEME_STORE_KEY for
      // the rationale (localStorage quota).
      const res = await fetch(ref.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      parseJsonc<VSCodeIconTheme>(text);
      const payload: ActiveIconTheme = { id: ref.name, url: ref.url };
      await store.set(ACTIVE_ICON_THEME_STORE_KEY, payload);
    } catch (e) {
      setErrorByName((prev) => ({
        ...prev,
        [ref.name]: e instanceof Error ? e.message : 'Install failed',
      }));
    } finally {
      setBusyName(null);
    }
  };

  const uninstallIconTheme = async () => {
    await store.set(ACTIVE_ICON_THEME_STORE_KEY, null);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return themes.filter((t) => {
      if (filter === 'dark' && t.kind !== 'dark') return false;
      if (filter === 'light' && t.kind !== 'light') return false;
      if (filter === 'installed' && !installed.some((i) => i.name === t.name)) return false;
      if (q.length > 0) {
        const hay = `${t.name} ${t.publisher} ${t.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [themes, query, filter, installed]);

  const install = async (ref: MarketplaceThemeRef) => {
    setBusyName(ref.name);
    setErrorByName((prev) => {
      const next = { ...prev };
      delete next[ref.name];
      return next;
    });
    try {
      const res = await fetch(ref.url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      // VS Code marketplace themes ship as JSONC — `//` comments
      // and trailing commas are valid. `res.json()` rejects both,
      // so we read raw text and parse through the JSONC-tolerant
      // helper. Without this, microsoft/vscode's first-party
      // themes (Monokai, Monokai Dimmed, …) all fail to install.
      const text = await res.text();
      const raw = parseJsonc<VSCodeColorTheme>(text);
      // Force the display name to the marketplace label so cards,
      // picker entries, and active-state checks all line up on a
      // single key.
      const monacoTheme = vscodeThemeToMonaco({ ...raw, name: ref.name }, ref.name);
      const nextInstalled = [
        ...installed.filter((t) => t.name !== monacoTheme.name),
        monacoTheme,
      ];
      await store.set(CUSTOM_THEMES_STORE_KEY, nextInstalled);
      // Activate the freshly-installed theme. Read the existing
      // editor settings so we don't wipe font size / wrap / etc.
      const current = (await store.get('editor')) ?? {};
      await store.set('editor', { ...current, theme: ref.name });
    } catch (e) {
      setErrorByName((prev) => ({
        ...prev,
        [ref.name]: e instanceof Error ? e.message : 'Install failed',
      }));
    } finally {
      setBusyName(null);
    }
  };

  const apply = async (ref: MarketplaceThemeRef) => {
    const current = (await store.get('editor')) ?? {};
    await store.set('editor', { ...current, theme: ref.name });
  };

  const uninstall = async (ref: MarketplaceThemeRef) => {
    const next = installed.filter((t) => t.name !== ref.name);
    await store.set(CUSTOM_THEMES_STORE_KEY, next);
    if (activeTheme === ref.name) {
      const current = (await store.get('editor')) ?? {};
      await store.set('editor', { ...current, theme: 'vs-dark' });
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-gray-200 min-w-0">
      <div className="px-3 py-2 border-b border-gray-800/60 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          {title}
        </span>
      </div>

      {/* Tab strip — colors / icons. Both show the same search +
          card grid layout, but each draws from its own catalogue
          and install-state store key. */}
      <div className="px-3 pt-2 border-b border-gray-800/60 flex items-center gap-1">
        {(['colors', 'icons'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={[
              'px-2 py-1 text-[11px] capitalize transition-colors border-b-2 -mb-px',
              tab === t
                ? 'text-violet-100 border-violet-400'
                : 'text-gray-400 hover:text-gray-200 border-transparent',
            ].join(' ')}
          >
            {t === 'colors' ? 'Color themes' : 'File icons'}
          </button>
        ))}
      </div>

      <div className="px-3 py-3 border-b border-gray-800/60 flex flex-col gap-2">
        <div className="flex items-center gap-1.5 bg-gray-900/70 border border-gray-700/60 rounded-md px-2 py-1.5 focus-within:border-violet-500/50">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="#6b7280" aria-hidden="true">
            <path d="M10.68 11.74A6 6 0 1 1 11.74 10.68L14.53 13.47l-1.06 1.06zM12 7a5 5 0 1 0-10 0 5 5 0 0 0 10 0z" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search themes…"
            className="flex-1 min-w-0 bg-transparent text-[12px] text-gray-200 placeholder:text-gray-500 focus:outline-none"
          />
        </div>
        {tab === 'colors' && (
          <div className="flex items-center gap-1 text-[11px]">
            {(['all', 'dark', 'light', 'installed'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={[
                  'px-2 py-0.5 rounded transition-colors capitalize',
                  filter === f
                    ? 'bg-violet-500/30 text-violet-100 border border-violet-500/60'
                    : 'text-gray-400 hover:bg-gray-800/60 hover:text-gray-200 border border-transparent',
                ].join(' ')}
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto px-3 py-2 flex flex-col gap-2">
        {tab === 'icons' ? (
          iconThemes.length === 0 ? (
            <div className="text-center text-gray-500 text-[12px] py-12">
              No icon themes available.
            </div>
          ) : (
            iconThemes
              .filter((r) => {
                const q = query.trim().toLowerCase();
                if (!q) return true;
                return `${r.name} ${r.publisher} ${r.description}`.toLowerCase().includes(q);
              })
              .map((ref) => {
                const isActive = activeIconTheme?.id === ref.name;
                const isBusy = busyName === ref.name;
                const err = errorByName[ref.name];
                return (
                  <article
                    key={ref.name}
                    className={[
                      'flex items-stretch gap-3 p-2 rounded-md border transition-colors',
                      isActive
                        ? 'border-violet-500/60 bg-violet-500/10'
                        : 'border-gray-700/40 bg-gray-900/40 hover:bg-gray-900/70',
                    ].join(' ')}
                  >
                    <div
                      className="w-12 h-16 rounded-sm bg-gray-800/60 flex flex-col items-center justify-center gap-1 shrink-0"
                      aria-hidden
                    >
                      {ref.preview.map((p, idx) => (
                        <span key={idx} className="text-[16px] leading-none">
                          {p.emoji}
                        </span>
                      ))}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[13px] font-semibold text-gray-100 truncate">
                          {ref.name}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-gray-500">
                          icons
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400">{ref.publisher}</span>
                      <p className="text-[11px] text-gray-300 mt-1 line-clamp-2">
                        {ref.description}
                      </p>
                      {err && <span className="text-[10px] text-rose-300 mt-1">{err}</span>}
                      <div className="mt-auto pt-2 flex items-center gap-2">
                        {isActive ? (
                          <>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-violet-500/30 text-violet-100">
                              ● Active
                            </span>
                            <button
                              type="button"
                              onClick={() => void uninstallIconTheme()}
                              className="text-[11px] px-2 py-0.5 rounded text-rose-300 hover:bg-rose-500/10"
                            >
                              Uninstall
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void installIconTheme(ref)}
                            className="text-[11px] px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white"
                          >
                            {isBusy ? 'Installing…' : 'Install'}
                          </button>
                        )}
                        {ref.homepage && (
                          <a
                            href={ref.homepage}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-[10px] text-gray-500 hover:text-gray-300 ml-auto"
                          >
                            Source ↗
                          </a>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })
          )
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-500 text-[12px] py-12">
            No themes match your filters.
          </div>
        ) : (
          filtered.map((ref) => {
            const isInstalled = installed.some((t) => t.name === ref.name);
            const isActive = activeTheme === ref.name;
            const isBusy = busyName === ref.name;
            const err = errorByName[ref.name];
            return (
              <article
                key={ref.name}
                className={[
                  'flex items-stretch gap-3 p-2 rounded-md border transition-colors',
                  isActive
                    ? 'border-violet-500/60 bg-violet-500/10'
                    : 'border-gray-700/40 bg-gray-900/40 hover:bg-gray-900/70',
                ].join(' ')}
              >
                {/* Color swatch — three vertical stripes from the
                    theme's bg / fg / accent. Cheap visual preview
                    without fetching the full JSON. */}
                <div
                  className="w-12 h-16 rounded-sm overflow-hidden flex flex-col shrink-0"
                  style={{ backgroundColor: ref.swatch.bg }}
                  aria-hidden
                >
                  <div className="flex-1" style={{ backgroundColor: ref.swatch.fg }} />
                  <div className="flex-1" style={{ backgroundColor: ref.swatch.bg }} />
                  <div className="flex-1" style={{ backgroundColor: ref.swatch.accent }} />
                </div>
                <div className="flex-1 min-w-0 flex flex-col">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-semibold text-gray-100 truncate">
                      {ref.name}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-gray-500">
                      {ref.kind}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-400">{ref.publisher}</span>
                  <p className="text-[11px] text-gray-300 mt-1 line-clamp-2">
                    {ref.description}
                  </p>
                  {err && <span className="text-[10px] text-rose-300 mt-1">{err}</span>}
                  <div className="mt-auto pt-2 flex items-center gap-2">
                    {isActive ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-violet-500/30 text-violet-100">
                        ● Active
                      </span>
                    ) : isInstalled ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void apply(ref)}
                          className="text-[11px] px-2 py-0.5 rounded bg-violet-600 hover:bg-violet-500 text-white"
                        >
                          Apply
                        </button>
                        <button
                          type="button"
                          onClick={() => void uninstall(ref)}
                          className="text-[11px] px-2 py-0.5 rounded text-rose-300 hover:bg-rose-500/10"
                        >
                          Uninstall
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void install(ref)}
                        className="text-[11px] px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white"
                      >
                        {isBusy ? 'Installing…' : 'Install'}
                      </button>
                    )}
                    {ref.homepage && (
                      <a
                        href={ref.homepage}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-[10px] text-gray-500 hover:text-gray-300 ml-auto"
                      >
                        Source ↗
                      </a>
                    )}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
