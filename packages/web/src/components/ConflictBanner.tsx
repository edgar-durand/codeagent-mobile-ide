import { useMemo } from 'react';
import {
  acceptBoth,
  acceptCurrent,
  acceptIncoming,
  applyConflictResolutionAll,
  detectConflicts,
  type ConflictHunk,
} from '@codeam/ide-core';

interface Props {
  /** Current file buffer. Banner shows itself when this contains
   * merge-conflict markers, hides otherwise. */
  content: string;
  /** Fires with the new file content after the user clicks one of
   * the resolution buttons. Consumer is responsible for piping it
   * back into the editor and (usually) marking the buffer dirty. */
  onResolved: (next: string) => void;
  /**
   * Optional override label for the per-hunk "Accept current"
   * button. Defaults to the hunk's `currentLabel` (whatever git
   * wrote after `<<<<<<<`).
   */
  currentLabel?: (hunk: ConflictHunk) => string;
  /** Same idea for the "Accept incoming" side. */
  incomingLabel?: (hunk: ConflictHunk) => string;
}

/**
 * Banner that surfaces above the editor when the open file has at
 * least one git merge-conflict block. Each detected hunk gets its
 * own row of buttons (Accept Current / Accept Incoming / Accept
 * Both), plus a "Resolve all" pair at the top for one-click
 * acceptance of every hunk on the same side.
 *
 * The banner is purely a controlled component — it never mutates
 * the editor state directly. Consumer wires `onResolved` to push
 * the returned content into the Monaco model + dirty buffer.
 */
export function ConflictBanner({
  content,
  onResolved,
  currentLabel,
  incomingLabel,
}: Props) {
  const hunks = useMemo(() => detectConflicts(content), [content]);
  if (hunks.length === 0) return null;

  const resolveAll = (side: 'current' | 'incoming' | 'both') => {
    onResolved(applyConflictResolutionAll(content, side));
  };

  // Per-hunk handler resolves a specific hunk. Re-runs
  // detectConflicts AFTER applying so the next button click
  // targets the still-existing hunks (indices shift as we
  // resolve).
  const resolveHunk = (hunk: ConflictHunk, side: 'current' | 'incoming' | 'both') => {
    const next =
      side === 'current'
        ? acceptCurrent(content, hunk)
        : side === 'incoming'
          ? acceptIncoming(content, hunk)
          : acceptBoth(content, hunk);
    onResolved(next);
  };

  return (
    <div className="border-b border-amber-500/40 bg-amber-950/60 text-amber-100">
      <div className="px-3 py-2 flex items-center justify-between gap-3 text-[12px]">
        <div className="flex items-center gap-2">
          <span className="text-amber-300">⚠</span>
          <span>
            {hunks.length} merge conflict{hunks.length === 1 ? '' : 's'} in this file
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => resolveAll('current')}
            className="px-2 py-1 rounded text-[11px] bg-amber-700/40 hover:bg-amber-700/60"
          >
            Accept all current
          </button>
          <button
            type="button"
            onClick={() => resolveAll('incoming')}
            className="px-2 py-1 rounded text-[11px] bg-amber-700/40 hover:bg-amber-700/60"
          >
            Accept all incoming
          </button>
        </div>
      </div>
      <div className="px-3 pb-2 flex flex-col gap-1">
        {hunks.map((h, idx) => (
          <div
            key={`${h.startLine}-${h.endLine}-${idx}`}
            className="flex items-center justify-between gap-3 text-[11px] bg-amber-900/30 border border-amber-500/30 rounded px-2 py-1"
          >
            <span className="text-amber-200">
              Line {h.startLine + 1}–{h.endLine + 1}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => resolveHunk(h, 'current')}
                className="px-2 py-0.5 rounded bg-emerald-700/40 hover:bg-emerald-700/60"
              >
                Accept current {currentLabel ? currentLabel(h) : h.currentLabel}
              </button>
              <button
                type="button"
                onClick={() => resolveHunk(h, 'incoming')}
                className="px-2 py-0.5 rounded bg-sky-700/40 hover:bg-sky-700/60"
              >
                Accept incoming {incomingLabel ? incomingLabel(h) : h.incomingLabel}
              </button>
              <button
                type="button"
                onClick={() => resolveHunk(h, 'both')}
                className="px-2 py-0.5 rounded bg-violet-700/40 hover:bg-violet-700/60"
              >
                Accept both
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
