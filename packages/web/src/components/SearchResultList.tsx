import type { SearchHit } from '@codeam/ide-core';

interface GroupedHits {
  path: string;
  hits: SearchHit[];
}

interface SearchResultListProps {
  debouncedQuery: string;
  loading: boolean;
  groups: GroupedHits[];
  totalHits: number;
  fileCount: number;
  truncated: boolean | undefined;
  collapsed: Set<string>;
  onToggle: (path: string) => void;
  onOpen: (hit: SearchHit) => void;
  replaceSupported: boolean;
  replaceOpen: boolean;
  replacing: boolean;
  onReplaceFile: (filePath: string) => void;
}

export function SearchResultList({
  debouncedQuery,
  loading,
  groups,
  totalHits,
  fileCount,
  truncated,
  collapsed,
  onToggle,
  onOpen,
  replaceSupported,
  replaceOpen,
  replacing,
  onReplaceFile,
}: SearchResultListProps) {
  if (!debouncedQuery) {
    return (
      <div className="text-center text-gray-500 text-[11px] py-8">Type to search…</div>
    );
  }

  if (loading) {
    return (
      <div className="text-center text-gray-500 text-[11px] py-8">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse mr-1.5" />
        Searching…
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="text-center text-gray-500 text-[11px] py-8">No results.</div>
    );
  }

  return (
    <>
      <div className="px-3 py-1.5 text-[11px] text-gray-400 border-b border-gray-800/40">
        {totalHits} result{totalHits === 1 ? '' : 's'} in {fileCount} file
        {fileCount === 1 ? '' : 's'}
        {truncated && <span className="ml-1 text-amber-300">· truncated</span>}
      </div>
      {groups.map((g) => {
        const isCollapsed = collapsed.has(g.path);
        return (
          <div key={g.path}>
            <div className="group flex items-center px-3 py-1 hover:bg-gray-800/40 transition-colors">
              <button
                type="button"
                onClick={() => onToggle(g.path)}
                className="flex items-center gap-1.5 text-left flex-1 min-w-0"
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
              {replaceSupported && replaceOpen && (
                <button
                  type="button"
                  disabled={replacing}
                  onClick={() => onReplaceFile(g.path)}
                  className="opacity-0 group-hover:opacity-100 text-[10px] px-1.5 py-0.5 rounded bg-violet-500/30 hover:bg-violet-500/50 text-violet-100 ml-2 transition-opacity"
                  title="Replace in this file"
                >
                  ↦
                </button>
              )}
            </div>
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
