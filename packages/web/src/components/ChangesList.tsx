import type { GitStatusEntry } from '@codeam/ide-core';

function chipFor(entry: GitStatusEntry): { label: string; color: string } {
  if (entry.conflict) return { label: 'C', color: '#fb7185' };
  if (entry.code === '??') return { label: 'U', color: '#34d399' };
  const x = entry.code[0];
  const y = entry.code[1];
  if (y === 'M' || x === 'M') return { label: 'M', color: '#fbbf24' };
  if (y === 'D' || x === 'D') return { label: 'D', color: '#fb7185' };
  if (y === 'A' || x === 'A') return { label: 'A', color: '#34d399' };
  if (y === 'R' || x === 'R') return { label: 'R', color: '#60a5fa' };
  return { label: entry.code, color: '#9ca3af' };
}

interface ChangesListProps {
  status: { entries: GitStatusEntry[]; error?: string } | null | { error: string };
  statusEntries: GitStatusEntry[];
  onSelect?: (entry: GitStatusEntry) => void;
}

export function ChangesList({ status, statusEntries, onSelect }: ChangesListProps) {
  if (status === null) {
    return (
      <div className="text-center text-gray-500 text-[11px] py-6">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse mr-1.5" />
        Loading status…
      </div>
    );
  }

  if ('error' in status && status.error) {
    return <div className="text-center text-rose-300 text-[12px] py-6 px-4">{status.error}</div>;
  }

  if (statusEntries.length === 0) return null;

  return (
    <>
      {statusEntries.map((e) => {
        const chip = chipFor(e);
        return (
          <button
            key={e.path + e.code}
            type="button"
            onClick={() => onSelect?.(e)}
            className="w-full flex items-center gap-2 px-3 py-1 hover:bg-gray-800/40 text-left transition-colors"
            title={`${e.path} (${chip.label})`}
          >
            <span className="font-mono text-[12px] text-gray-200 truncate flex-1">
              {e.path.split('/').pop()}
            </span>
            <span className="text-[10px] text-gray-500 truncate max-w-[40%]">
              {e.path.replace(/\/[^/]+$/, '')}
            </span>
            <span
              className="text-[10px] font-bold w-3 text-center shrink-0"
              style={{ color: chip.color }}
            >
              {chip.label}
            </span>
          </button>
        );
      })}
    </>
  );
}
