import type { GitStatusEntry } from '@codeam/ide-core';
import { CheckIcon } from './InlineIcons';

/**
 * Conventional Commits prefix presets. Order is rough frequency-of-use;
 * most-used types first so the strip degrades gracefully on narrow
 * viewports.
 */
const CC_PREFIXES: Array<{ type: string; emoji?: string }> = [
  { type: 'feat', emoji: '✨' },
  { type: 'fix', emoji: '🐛' },
  { type: 'chore' },
  { type: 'docs', emoji: '📝' },
  { type: 'refactor' },
  { type: 'test' },
  { type: 'perf', emoji: '⚡️' },
  { type: 'build' },
  { type: 'ci' },
  { type: 'style' },
  { type: 'revert' },
];

function applyCommitPrefix(current: string, type: string, emoji?: string): string {
  const trimmed = current.trimStart();
  const ccRe = /^[a-z]+(\([^)]+\))?!?:\s*(?:[\u{1F300}-\u{1FAFF}]\s*)?/u;
  const rest = trimmed.replace(ccRe, '');
  const prefix = emoji ? `${type}: ${emoji} ` : `${type}: `;
  return prefix + rest;
}

interface CommitComposerProps {
  branchLabel: string;
  busy: 'commit' | 'push' | 'pull' | null;
  canCommit: boolean;
  error: string | null;
  ok: string | null;
  message: string;
  entries: GitStatusEntry[];
  onMessageChange: (value: string) => void;
  onCommit: () => void;
}

export function CommitComposer({
  branchLabel,
  busy,
  canCommit,
  error,
  ok,
  message,
  entries: _entries,
  onMessageChange,
  onCommit,
}: CommitComposerProps) {
  return (
    <div className="px-3 pt-2 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1">
        {CC_PREFIXES.map((p) => (
          <button
            key={p.type}
            type="button"
            onClick={() => onMessageChange(applyCommitPrefix(message, p.type, p.emoji))}
            title={`${p.type}${p.emoji ? ' ' + p.emoji : ''}`}
            className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-gray-700/60 text-gray-300 hover:bg-violet-500/20 hover:border-violet-500/60 hover:text-violet-100 transition-colors"
          >
            {p.emoji ? <span className="mr-0.5">{p.emoji}</span> : null}
            {p.type}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={message}
        onChange={(e) => onMessageChange(e.target.value)}
        placeholder={`Message (⌘Enter to commit on "${branchLabel}")`}
        className="w-full bg-gray-900/70 border border-violet-500/40 rounded px-2 py-1.5 text-[12px] font-mono text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-violet-500"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canCommit) {
            e.preventDefault();
            void onCommit();
          }
        }}
      />
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
  );
}
