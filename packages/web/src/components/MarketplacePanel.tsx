import { useEffect, useMemo, useState } from 'react';
import {
  MARKETPLACE_THEMES,
  vscodeThemeToMonaco,
  type MarketplaceThemeRef,
  type MonacoTheme,
  type SettingsStore,
  type VSCodeColorTheme,
} from '@codeam/ide-core';
import { CUSTOM_THEMES_STORE_KEY } from './SettingsPanel';

interface Props {
  /** Persists installed themes + currently-active theme. Required —
   * a marketplace panel without a SettingsStore can't actually
   * install anything that survives a reload. */
  store: SettingsStore;
  /** Override or extend the curated list. Defaults to
   * `MARKETPLACE_THEMES` from core. */
  themes?: readonly MarketplaceThemeRef[];
  /** Optional title (defaults to "Themes Marketplace"). */
  title?: string;
}

type Filter = 'all' | 'dark' | 'light' | 'installed';

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
  title = 'Themes Marketplace',
}: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [installed, setInstalled] = useState<MonacoTheme[]>([]);
  const [activeTheme, setActiveTheme] = useState<string>('vs-dark');
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
      }
    });
    return () => {
      cancelled = true;
      off();
    };
  }, [store]);

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
      const raw = (await res.json()) as VSCodeColorTheme;
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
      </div>

      <div className="flex-1 overflow-auto px-3 py-2 flex flex-col gap-2">
        {filtered.length === 0 ? (
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
