import { useEffect, useMemo, useRef, useState } from 'react';
import type { SearchHit, SearchOptions, SearchProvider, SearchResult } from '@codeam/ide-core';

interface Props {
  provider: SearchProvider;
  /** Fired when the user taps a result line. The consumer is
   * expected to open the file in the editor and reveal the
   * given line / column. */
  onOpen: (hit: SearchHit) => void;
  /** Initial query, useful for "find references" deep links. */
  initialQuery?: string;
}

interface GroupedHits {
  path: string;
  hits: SearchHit[];
}

function groupByFile(hits: SearchHit[]): GroupedHits[] {
  const map = new Map<string, SearchHit[]>();
  for (const h of hits) {
    const arr = map.get(h.path);
    if (arr) arr.push(h);
    else map.set(h.path, [h]);
  }
  return Array.from(map.entries()).map(([path, hits]) => ({ path, hits }));
}

/**
 * VS Code-style multi-file search panel. The provider executes the
 * query and returns a snapshot of hits; this component groups
 * them by file and lets the user expand/collapse each group. The
 * regex / case / word toggles are passed through to the provider
 * as `SearchOptions`.
 *
 * Streaming was discussed in the Phase 2 spec but the current
 * SearchProvider contract is snapshot-based. When the contract
 * evolves to streaming, this component can switch to an async
 * iterator without changing the public Props shape.
 */
export function SearchPanel({ provider, onOpen, initialQuery }: Props) {
  const [query, setQuery] = useState(initialQuery ?? '');
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery ?? '');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [regex, setRegex] = useState(false);
  const [include, setInclude] = useState('');
  const [exclude, setExclude] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const providerRef = useRef(provider);
  providerRef.current = provider;

  const fetchKey = useMemo(
    () =>
      [
        debouncedQuery,
        caseSensitive ? 'C' : 'c',
        wholeWord ? 'W' : 'w',
        regex ? 'R' : 'r',
        include,
        exclude,
      ].join('|'),
    [debouncedQuery, caseSensitive, wholeWord, regex, include, exclude],
  );
  const [committedKey, setCommittedKey] = useState<string | null>(null);
  const loading = debouncedQuery.length > 0 && committedKey !== fetchKey;

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    if (!debouncedQuery) {
      setResult(null);
      setCommittedKey(fetchKey);
      return;
    }
    let cancelled = false;
    const options: SearchOptions = {
      caseSensitive,
      wholeWord,
      regex,
      include: include
        ? include.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
      exclude: exclude
        ? exclude.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
    };
    providerRef.current
      .search(debouncedQuery, options)
      .then((r) => {
        if (!cancelled) {
          setResult(r);
          setCommittedKey(fetchKey);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResult({ hits: [], truncated: false });
          setCommittedKey(fetchKey);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, caseSensitive, wholeWord, regex, include, exclude, fetchKey]);

  const groups = useMemo(() => groupByFile(result?.hits ?? []), [result]);
  const totalHits = result?.total ?? result?.hits.length ?? 0;
  const fileCount = groups.length;

  const toggle = (path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-gray-200 min-w-0">
      <div className="px-3 py-2 border-b border-gray-800/60">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          Search
        </span>
      </div>

      <div className="px-3 py-3 border-b border-gray-800/60 flex flex-col gap-2">
        <div className="relative">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="w-full bg-gray-900/70 border border-gray-700/60 rounded-md pl-7 pr-2 py-1.5 text-[12px] font-mono text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-violet-500/50"
          />
          <svg
            className="absolute left-2 top-1/2 -translate-y-1/2"
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="#6b7280"
            aria-hidden="true"
          >
            <path d="M10.68 11.74A6 6 0 1 1 11.74 10.68L14.53 13.47l-1.06 1.06zM12 7a5 5 0 1 0-10 0 5 5 0 0 0 10 0z" />
          </svg>
        </div>

        <div className="flex items-center gap-1 text-[11px]">
          <Toggle on={caseSensitive} onChange={setCaseSensitive} label="Match case" hint="Aa" />
          <Toggle on={wholeWord} onChange={setWholeWord} label="Whole word" hint="ab" />
          <Toggle on={regex} onChange={setRegex} label="Regex" hint=".*" />
        </div>

        <details className="text-[11px] text-gray-400">
          <summary className="cursor-pointer hover:text-gray-200">
            files to include / exclude
          </summary>
          <div className="mt-2 flex flex-col gap-1.5">
            <input
              type="text"
              value={include}
              onChange={(e) => setInclude(e.target.value)}
              placeholder="files to include (comma-separated globs)"
              className="w-full bg-gray-900/70 border border-gray-700/60 rounded-md px-2 py-1 text-[11px] font-mono text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-violet-500/50"
            />
            <input
              type="text"
              value={exclude}
              onChange={(e) => setExclude(e.target.value)}
              placeholder="files to exclude"
              className="w-full bg-gray-900/70 border border-gray-700/60 rounded-md px-2 py-1 text-[11px] font-mono text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-violet-500/50"
            />
          </div>
        </details>
      </div>

      <div className="flex-1 overflow-auto">
        {!debouncedQuery ? (
          <div className="text-center text-gray-500 text-[11px] py-8">Type to search…</div>
        ) : loading ? (
          <div className="text-center text-gray-500 text-[11px] py-8">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse mr-1.5" />
            Searching…
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center text-gray-500 text-[11px] py-8">No results.</div>
        ) : (
          <>
            <div className="px-3 py-1.5 text-[11px] text-gray-400 border-b border-gray-800/40">
              {totalHits} result{totalHits === 1 ? '' : 's'} in {fileCount} file
              {fileCount === 1 ? '' : 's'}
              {result?.truncated && <span className="ml-1 text-amber-300">· truncated</span>}
            </div>
            {groups.map((g) => {
              const isCollapsed = collapsed.has(g.path);
              return (
                <div key={g.path}>
                  <button
                    type="button"
                    onClick={() => toggle(g.path)}
                    className="w-full flex items-center gap-1.5 px-3 py-1 hover:bg-gray-800/40 text-left transition-colors"
                  >
                    <span className="text-[10px] text-gray-500 w-3">
                      {isCollapsed ? '▸' : '▾'}
                    </span>
                    <span className="text-[14px]">📄</span>
                    <span className="font-mono text-[12px] text-gray-200 truncate flex-1">
                      {g.path}
                    </span>
                    <span className="text-[10px] text-gray-500">{g.hits.length}</span>
                  </button>
                  {!isCollapsed &&
                    g.hits.map((h, idx) => (
                      <button
                        key={`${h.path}:${h.line}:${h.column}:${idx}`}
                        type="button"
                        onClick={() => onOpen(h)}
                        className="w-full pl-8 pr-3 py-0.5 text-left hover:bg-gray-800/40 transition-colors"
                        title={`${h.path}:${h.line}:${h.column}`}
                      >
                        <span className="font-mono text-[11px] text-gray-300 line-clamp-1">
                          <HighlightedLine
                            text={h.text}
                            column={h.column}
                            length={h.matchLength}
                          />
                        </span>
                      </button>
                    ))}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

function Toggle({
  on,
  onChange,
  label,
  hint,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      aria-label={label}
      title={label}
      className={[
        'w-6 h-6 inline-flex items-center justify-center rounded font-mono text-[10px] transition-colors',
        on
          ? 'bg-violet-500/30 text-violet-100 border border-violet-500/60'
          : 'text-gray-500 hover:bg-gray-800/60 hover:text-gray-300 border border-transparent',
      ].join(' ')}
    >
      {hint}
    </button>
  );
}

function HighlightedLine({
  text,
  column,
  length,
}: {
  text: string;
  column: number;
  length: number;
}) {
  const before = text.slice(0, Math.max(0, column - 1));
  const match = text.slice(Math.max(0, column - 1), Math.max(0, column - 1) + length);
  const after = text.slice(Math.max(0, column - 1) + length);
  return (
    <>
      <span>{before}</span>
      <span className="bg-amber-500/30 text-amber-100 rounded-sm">{match}</span>
      <span>{after}</span>
    </>
  );
}
