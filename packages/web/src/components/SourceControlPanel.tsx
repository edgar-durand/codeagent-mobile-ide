import { useEffect, useRef, useState, type ReactNode } from 'react';
import type {
  GitLogEntry,
  GitProvider,
  GitStatusEntry,
  GitStatusPayload,
} from '@codeam/ide-core';

interface Props {
  provider: GitProvider;
  onSelect?: (entry: GitStatusEntry) => void;
  /** Header label (e.g. project name). Defaults to "Source Control". */
  title?: string;
  /** Bump to force a status refetch. */
  reloadKey?: string | number;
}

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

/**
 * VS Code-style Source Control panel. Mirrors the VS Code 1.95
 * layout: SOURCE CONTROL header with overflow menu, CHANGES
 * section with collapse chevron + commit-all / refresh / more
 * action icons, single-line commit input, split-button Commit,
 * and a GRAPH section below showing recent commits when the
 * `GitProvider.log` method is defined.
 *
 * Push / pull live in the consumer's status bar — VS Code parity.
 * The overflow `…` buttons are visual-only stubs for the v0.3.x
 * line; clicking them is a no-op until the host wires a menu
 * runtime (Phase 3 extension API).
 */
export function SourceControlPanel({ provider, onSelect, title, reloadKey }: Props) {
  const [status, setStatus] = useState<GitStatusPayload | null>(null);
  const [log, setLog] = useState<GitLogEntry[] | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);
  const [busy, setBusy] = useState<'commit' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [changesOpen, setChangesOpen] = useState(true);
  const [graphOpen, setGraphOpen] = useState(true);
  const providerRef = useRef(provider);
  providerRef.current = provider;
  const supportsLog = typeof provider.log === 'function';

  useEffect(() => {
    let cancelled = false;
    providerRef.current
      .status()
      .then((payload) => {
        if (!cancelled) setStatus(payload);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      });
    if (providerRef.current.log) {
      providerRef.current
        .log(30)
        .then((entries) => {
          if (!cancelled) setLog(entries);
        })
        .catch(() => {
          if (!cancelled) setLog([]);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [reloadKey, reloadCounter]);

  const reload = () => setReloadCounter((c) => c + 1);
  const flash = (kind: 'ok' | 'err', text: string) => {
    if (kind === 'ok') {
      setOk(text);
      setError(null);
      setTimeout(() => setOk(null), 2500);
    } else {
      setError(text);
      setOk(null);
    }
  };

  const onCommit = async () => {
    if (!message.trim()) {
      flash('err', 'Commit message is required.');
      return;
    }
    setBusy('commit');
    try {
      const r = await providerRef.current.commit({ message: message.trim(), all: true });
      if ('error' in r) {
        flash('err', r.error);
      } else {
        flash('ok', `Committed ${r.sha.slice(0, 7)}`);
        setMessage('');
        reload();
      }
    } finally {
      setBusy(null);
    }
  };

  const entries = status?.entries ?? [];
  const canCommit = entries.length > 0 && message.trim().length > 0 && busy === null;
  const branchLabel = status?.branch ?? 'main';

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-gray-200 min-w-0">
      {/* Panel title */}
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          {title ?? 'Source Control'}
        </span>
        <button
          type="button"
          aria-label="Views and More Actions..."
          title="Views and More Actions..."
          className="text-gray-500 hover:text-gray-200 transition-colors leading-none px-1"
        >
          ⋯
        </button>
      </div>

      {/* CHANGES header */}
      <div className="px-3">
        <div className="flex items-center justify-between py-1">
          <button
            type="button"
            onClick={() => setChangesOpen((o) => !o)}
            className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold text-gray-100 hover:text-white transition-colors"
          >
            <span className="w-3 text-gray-400 leading-none">{changesOpen ? '▾' : '▸'}</span>
            <span>Changes</span>
            {entries.length > 0 ? (
              <span className="text-[10px] bg-gray-700/80 text-gray-100 rounded-full px-1.5 py-0 leading-4 font-bold ml-1">
                {entries.length}
              </span>
            ) : null}
          </button>
          <div className="flex items-center gap-1 text-gray-500">
            <IconButton
              title="Commit"
              ariaLabel="Commit"
              disabled={!canCommit}
              onClick={() => void onCommit()}
            >
              <CheckIcon />
            </IconButton>
            <IconButton title="Refresh" ariaLabel="Refresh" onClick={reload}>
              <RefreshIcon />
            </IconButton>
            <IconButton title="More Actions..." ariaLabel="More Actions...">
              <MoreIcon />
            </IconButton>
          </div>
        </div>
      </div>

      {/* Commit composer */}
      {changesOpen ? (
        <div className="px-3 pt-2 flex flex-col gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={`Message (⌘Enter to commit on "${branchLabel}")`}
            className="w-full bg-gray-900/70 border border-violet-500/40 rounded px-2 py-1.5 text-[12px] font-mono text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-violet-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canCommit) {
                e.preventDefault();
                void onCommit();
              }
            }}
          />
          {/* Split-button: main Commit on the left + dropdown caret on the right */}
          <div className="flex w-full rounded overflow-hidden border border-violet-500/40">
            <button
              type="button"
              onClick={onCommit}
              disabled={!canCommit}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-violet-600/85 hover:bg-violet-600 text-white text-[12px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <CheckIcon />
              {busy === 'commit' ? 'Committing…' : 'Commit'}
            </button>
            <button
              type="button"
              aria-label="More commit actions…"
              title="More commit actions…"
              className="px-2 py-1.5 bg-violet-600/85 hover:bg-violet-600 text-white border-l border-violet-500/40 disabled:opacity-40"
              disabled={!canCommit}
            >
              ▾
            </button>
          </div>
          {error || ok ? (
            <div
              className={[
                'text-[11px] font-mono px-2 py-1 rounded',
                error
                  ? 'bg-rose-500/10 text-rose-200 border border-rose-500/30'
                  : 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/30',
              ].join(' ')}
            >
              {error ?? ok}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* File list */}
      {changesOpen ? (
        <div className="mt-2">
          {status === null ? (
            <div className="text-center text-gray-500 text-[11px] py-6">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse mr-1.5" />
              Loading status…
            </div>
          ) : status.error ? (
            <div className="text-center text-rose-300 text-[12px] py-6 px-4">{status.error}</div>
          ) : entries.length === 0 ? null : (
            entries.map((e) => {
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
            })
          )}
        </div>
      ) : null}

      {/* GRAPH section — only when provider supports log() */}
      {supportsLog ? (
        <div className="mt-2 px-3 border-t border-gray-800/60 pt-2 flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between py-1">
            <button
              type="button"
              onClick={() => setGraphOpen((o) => !o)}
              className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold text-gray-100 hover:text-white transition-colors"
            >
              <span className="w-3 text-gray-400 leading-none">{graphOpen ? '▾' : '▸'}</span>
              <span>Graph</span>
            </button>
            <div className="flex items-center gap-2 text-gray-500">
              <IconButton title="Refresh" ariaLabel="Refresh graph" onClick={reload}>
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
      ) : (
        <div className="flex-1" />
      )}
    </div>
  );
}

// ── Inline icon helpers ──────────────────────────────────────────
function IconButton({
  children,
  onClick,
  disabled,
  title,
  ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title: string;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className="w-6 h-6 inline-flex items-center justify-center rounded hover:bg-gray-800/60 hover:text-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 1 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M2.85 7.5a5.15 5.15 0 0 1 8.78-3.65l1.13-1.13.71.71-2.13 2.13-2.13-2.13.71-.71 1 1A4.15 4.15 0 1 0 11.86 9h1.02A5.15 5.15 0 1 1 2.85 7.5z" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <circle cx="3" cy="8" r="1.25" />
      <circle cx="8" cy="8" r="1.25" />
      <circle cx="13" cy="8" r="1.25" />
    </svg>
  );
}
