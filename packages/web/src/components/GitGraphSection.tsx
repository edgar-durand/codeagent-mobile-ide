import type { GitLogEntry } from '@codeam/ide-core';
import { RefreshIcon, MoreIcon, IconButton } from './InlineIcons';

function timeAgo(ts: number): string {
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo`;
  return `${Math.floor(mo / 12)}y`;
}

interface GitGraphSectionProps {
  log: GitLogEntry[] | null;
  graphOpen: boolean;
  onToggleGraph: () => void;
  onReload: () => void;
}

export function GitGraphSection({ log, graphOpen, onToggleGraph, onReload }: GitGraphSectionProps) {
  return (
    <div className="mt-2 px-3 border-t border-gray-800/60 pt-2 flex-1 min-h-0 flex flex-col">
      <div className="flex items-center justify-between py-1">
        <button
          type="button"
          onClick={onToggleGraph}
          className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold text-gray-100 hover:text-white transition-colors"
        >
          <span className="w-3 text-gray-400 leading-none">{graphOpen ? '▾' : '▸'}</span>
          <span>Graph</span>
        </button>
        <div className="flex items-center gap-2 text-gray-500">
          <IconButton title="Refresh" ariaLabel="Refresh graph" onClick={onReload}>
            <RefreshIcon />
          </IconButton>
          <IconButton title="More Actions..." ariaLabel="More graph actions...">
            <MoreIcon />
          </IconButton>
        </div>
      </div>
      {graphOpen ? (
        <div className="flex-1 overflow-auto pb-2">
          {log === null ? (
            <div className="text-center text-gray-500 text-[11px] py-4">Loading log…</div>
          ) : log.length === 0 ? (
            <div className="text-center text-gray-500 text-[11px] py-4">No commits.</div>
          ) : (
            log.map((c, i) => (
              <div
                key={c.sha}
                className="flex items-center gap-2 py-0.5 group cursor-default"
                title={`${c.sha.slice(0, 7)} · ${c.author} · ${new Date(c.timestamp).toLocaleString()}`}
              >
                <span className="w-3 flex flex-col items-center text-blue-400 leading-none">
                  <span className="text-[12px]">{i === 0 ? '○' : '●'}</span>
                </span>
                <span
                  className={[
                    'font-mono text-[12px] truncate flex-1',
                    i === 0 ? 'text-white font-semibold' : 'text-gray-300',
                  ].join(' ')}
                >
                  {c.subject}
                </span>
                {c.refs && c.refs.length > 0
                  ? c.refs.map((ref) => (
                      <span
                        key={ref}
                        className="text-[9px] font-mono bg-violet-500/20 text-violet-200 px-1.5 py-0 rounded leading-4 border border-violet-500/30"
                      >
                        {ref}
                      </span>
                    ))
                  : null}
                <span className="text-[10px] text-gray-500 shrink-0">{timeAgo(c.timestamp)}</span>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
