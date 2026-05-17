import { useEffect, useRef, useState } from 'react';
import type {
  GitProvider,
  GitStatusEntry,
  GitStatusPayload,
} from '@codeam/ide-core';

interface Props {
  provider: GitProvider;
  /** Fired when the user clicks a changed-file row. The consumer
   * is expected to open the file in the viewer (or in a diff view
   * if that's supported in the host shell). */
  onSelect?: (entry: GitStatusEntry) => void;
  /** Repository nickname rendered as the panel's H1 (e.g. project
   * name). Defaults to "Source Control". */
  title?: string;
  /** Bump to force a status refetch (e.g. after an external commit). */
  reloadKey?: string | number;
}

function chipFor(entry: GitStatusEntry): { label: string; cls: string } {
  if (entry.conflict)
    return { label: 'C', cls: 'bg-rose-500/20 text-rose-200 border-rose-500/40' };
  if (entry.code === '??')
    return { label: 'U', cls: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40' };
  const x = entry.code[0];
  const y = entry.code[1];
  if (y === 'M' || x === 'M')
    return { label: 'M', cls: 'bg-amber-500/20 text-amber-200 border-amber-500/40' };
  if (y === 'D' || x === 'D')
    return { label: 'D', cls: 'bg-rose-500/20 text-rose-200 border-rose-500/40' };
  if (y === 'A' || x === 'A')
    return { label: 'A', cls: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40' };
  if (y === 'R' || x === 'R')
    return { label: 'R', cls: 'bg-sky-500/20 text-sky-200 border-sky-500/40' };
  return { label: entry.code, cls: 'bg-gray-700/50 text-gray-200 border-gray-600/40' };
}

/**
 * VS Code-style source control panel. Single column: branch
 * header at top, commit message + Commit button, sync/pull/push
 * row, then the list of changed files. Tabs ("Changes" / "Graph")
 * are placed for visual parity with VS Code but Graph is a Phase
 * 3+ feature — for now the tab is rendered disabled.
 */
export function SourceControlPanel({ provider, onSelect, title, reloadKey }: Props) {
  const [status, setStatus] = useState<GitStatusPayload | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);
  const [busy, setBusy] = useState<'commit' | 'push' | 'fetch' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const providerRef = useRef(provider);
  providerRef.current = provider;

  // Refresh status on mount, on external reloadKey change, and
  // after every successful local mutation (commit / push / fetch).
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

  const onPush = async () => {
    setBusy('push');
    try {
      const r = await providerRef.current.push();
      if ('error' in r) flash('err', r.error);
      else {
        flash('ok', 'Pushed.');
        reload();
      }
    } finally {
      setBusy(null);
    }
  };

  const onFetch = async () => {
    setBusy('fetch');
    try {
      const r = await providerRef.current.fetch();
      if ('error' in r) flash('err', r.error);
      else {
        flash('ok', 'Synced.');
        reload();
      }
    } finally {
      setBusy(null);
    }
  };

  const entries = status?.entries ?? [];
  const canCommit = entries.length > 0 && message.trim().length > 0 && busy === null;

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-gray-200 min-w-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800/60">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          {title ?? 'Source Control'}
        </span>
        <button
          type="button"
          onClick={reload}
          className="text-gray-500 hover:text-gray-200 transition-colors"
          aria-label="Refresh"
          title="Refresh"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M2.85 7.5a5.15 5.15 0 0 1 8.78-3.65l1.13-1.13.71.71-2.13 2.13-2.13-2.13.71-.71 1 1A4.15 4.15 0 1 0 11.86 9h1.02A5.15 5.15 0 1 1 2.85 7.5z" />
          </svg>
        </button>
      </div>

      <div className="px-3 py-3 border-b border-gray-800/60 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-[12px]">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="#a78bfa" aria-hidden="true">
            <path d="M11.93 8.5a4 4 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4 4 0 0 1 7.86 0h3.32a.75.75 0 0 1 0 1.5h-3.32ZM8 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
          </svg>
          <span className="font-mono text-violet-300 font-semibold truncate">
            {status?.branch ?? '(detached)'}
          </span>
          {status?.upstream ? (
            <span className="font-mono text-[10px] text-gray-500 truncate">
              → {status.upstream}
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded border border-amber-500/40 bg-amber-500/15 text-amber-200 text-[10px] uppercase tracking-wider font-bold">
              Local only
            </span>
          )}
          {status && (status.ahead > 0 || status.behind > 0) ? (
            <div className="flex items-center gap-2 text-[11px] font-mono ml-auto">
              {status.ahead > 0 && <span className="text-emerald-400">↑{status.ahead}</span>}
              {status.behind > 0 && <span className="text-amber-400">↓{status.behind}</span>}
            </div>
          ) : null}
          {status?.hasMergeInProgress ? (
            <span className="ml-auto text-[10px] uppercase tracking-wider font-bold border border-rose-500/40 bg-rose-500/15 text-rose-200 px-1.5 py-0.5 rounded">
              Merging
            </span>
          ) : null}
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Message (press Enter to commit)"
          rows={2}
          className="w-full bg-gray-900/70 border border-gray-700/60 rounded-md px-2 py-1.5 text-[12px] font-mono text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-violet-500/50 resize-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && canCommit) {
              e.preventDefault();
              void onCommit();
            }
          }}
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCommit}
            disabled={!canCommit}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 text-white text-[12px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M6.22 5.22a.75.75 0 0 1 1.06 0L11 8.94l-3.72 3.72a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06z" />
            </svg>
            {busy === 'commit' ? 'Committing…' : 'Commit'}
          </button>
          <button
            type="button"
            onClick={onFetch}
            disabled={busy !== null}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-700 text-gray-300 hover:text-gray-100 hover:border-gray-600 text-[12px] font-semibold disabled:opacity-50"
            title="Sync (fetch)"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M2.85 7.5a5.15 5.15 0 0 1 8.78-3.65l1.13-1.13.71.71-2.13 2.13-2.13-2.13.71-.71 1 1A4.15 4.15 0 1 0 11.86 9h1.02A5.15 5.15 0 1 1 2.85 7.5z" />
            </svg>
            {busy === 'fetch' ? 'Syncing…' : 'Sync Changes'}
          </button>
          <button
            type="button"
            onClick={onPush}
            disabled={busy !== null || status?.ahead === 0}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-700 text-gray-300 hover:text-gray-100 hover:border-gray-600 text-[12px] font-semibold disabled:opacity-50"
            title="Push"
          >
            ↑ {busy === 'push' ? 'Pushing…' : 'Push'}
          </button>
        </div>

        {(error || ok) ? (
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

      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-800/60 text-[10px] uppercase tracking-wider font-bold text-gray-500">
        <span>Changes</span>
        <span className="bg-gray-800 text-gray-300 rounded-full px-1.5 py-0.5">
          {entries.length}
        </span>
      </div>

      <div className="flex-1 overflow-auto">
        {status === null ? (
          <div className="text-center text-gray-500 text-[11px] py-8">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse mr-1.5" />
            Loading status…
          </div>
        ) : status.error ? (
          <div className="text-center text-rose-300 text-[12px] py-8 px-4">{status.error}</div>
        ) : entries.length === 0 ? (
          <div className="text-center text-gray-500 text-[11px] py-8">
            Working tree is clean. ✨
          </div>
        ) : (
          entries.map((e) => {
            const chip = chipFor(e);
            return (
              <button
                key={e.path + e.code}
                type="button"
                onClick={() => onSelect?.(e)}
                className="group w-full flex items-center gap-2 px-3 py-1 hover:bg-gray-800/40 text-left transition-colors"
              >
                <span className="text-[14px]">📄</span>
                <span className="font-mono text-[12px] text-gray-200 truncate flex-1">
                  {e.path}
                </span>
                <span
                  className={`text-[10px] uppercase tracking-wider font-bold border rounded px-1 py-0.5 ${chip.cls}`}
                >
                  {chip.label}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
