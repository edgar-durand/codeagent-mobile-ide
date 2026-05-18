/**
 * Git merge-conflict parser + resolver. Detects the standard 3-way
 * merge marker block:
 *
 *   <<<<<<< HEAD
 *   our content
 *   =======
 *   their content
 *   >>>>>>> branch-name
 *
 * The resolver functions ([`acceptCurrent`](./conflicts.ts) /
 * `acceptIncoming` / `acceptBoth`) return the file content with the
 * specified hunk removed and the chosen side(s) substituted in
 * place. Original line endings (`\r\n` vs `\n`) are preserved.
 *
 * Out of scope: diff3-style merges with an additional `|||||||`
 * base section. Those are uncommon in interactive UIs and the
 * library skips them rather than mis-parse — `detectConflicts`
 * just won't return a hunk for diff3 blocks.
 */

const START_RE = /^<{7}( .*)?$/;
const MID_RE = /^={7}$/;
const END_RE = /^>{7}( .*)?$/;
// diff3 base separator — used to filter the block out so we don't
// accidentally treat a base-vs-current section as the conflict body.
const BASE_RE = /^\|{7}( .*)?$/;

export interface ConflictHunk {
  /** Zero-based line index of the `<<<<<<<` marker. */
  startLine: number;
  /** Zero-based line index of the `=======` separator. */
  midLine: number;
  /** Zero-based line index of the `>>>>>>>` marker. */
  endLine: number;
  /**
   * Optional label after `<<<<<<<` (e.g. `HEAD`, `ours`,
   * `feature/foo`). UI can surface this on the Accept Current button
   * so the user knows which side is which.
   */
  currentLabel: string;
  /** Optional label after `>>>>>>>` (e.g. `branch-name`). */
  incomingLabel: string;
  /** Lines between `<<<<<<<` and `=======` (the "ours" body). */
  currentLines: string[];
  /** Lines between `=======` and `>>>>>>>` (the "theirs" body). */
  incomingLines: string[];
}

/**
 * Scan content for merge-conflict blocks. Returns an empty array
 * when the file has none — caller should not render the resolution
 * toolbar in that case.
 *
 * Linear scan; safe for files up to a few MB. For very large files
 * this is still cheap because the regexes are anchored to start-of-
 * line and bail immediately on non-matching prefixes.
 */
export function detectConflicts(content: string): ConflictHunk[] {
  const lines = content.split('\n');
  const hunks: ConflictHunk[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    const startMatch = line.match(START_RE);
    if (!startMatch) {
      i += 1;
      continue;
    }

    // Look ahead for `=======` and `>>>>>>>`. If we don't find a
    // matching pair before the next `<<<<<<<`, this isn't a real
    // conflict block — skip and resume the outer scan.
    let mid = -1;
    let end = -1;
    let saw3WayBase = false;
    for (let j = i + 1; j < lines.length; j += 1) {
      const ln = lines[j] ?? '';
      if (START_RE.test(ln)) {
        // Nested or back-to-back conflicts: bail out of this scan
        // and let the outer loop pick up the new start marker.
        break;
      }
      if (BASE_RE.test(ln)) {
        // diff3 base — supported by skipping the block entirely
        // (the resolver wouldn't know which 2 of 3 sides to keep
        // without UI affordances we don't expose yet).
        saw3WayBase = true;
      }
      if (mid === -1 && MID_RE.test(ln)) {
        mid = j;
        continue;
      }
      if (mid !== -1 && END_RE.test(ln)) {
        end = j;
        break;
      }
    }

    if (mid === -1 || end === -1 || saw3WayBase) {
      // Unterminated / diff3 block — skip and continue.
      i += 1;
      continue;
    }

    const startMarker = lines[i] ?? '';
    const endMarker = lines[end] ?? '';
    hunks.push({
      startLine: i,
      midLine: mid,
      endLine: end,
      currentLabel: startMarker.slice(7).trim(),
      incomingLabel: endMarker.slice(7).trim(),
      currentLines: lines.slice(i + 1, mid),
      incomingLines: lines.slice(mid + 1, end),
    });
    i = end + 1;
  }

  return hunks;
}

/**
 * Replace the hunk with whichever side(s) the caller chose. The
 * three exports are thin wrappers over `applyConflictResolution`
 * with a fixed `side` argument so caller sites read clearly.
 *
 * All three return the FULL new file content — the caller passes
 * it back into the editor / writes it to disk. Hunk line indices
 * shift after each resolution, so when resolving multiple hunks
 * the caller should re-detect after each one.
 */
export function acceptCurrent(content: string, hunk: ConflictHunk): string {
  return applyConflictResolution(content, hunk, 'current');
}

export function acceptIncoming(content: string, hunk: ConflictHunk): string {
  return applyConflictResolution(content, hunk, 'incoming');
}

export function acceptBoth(content: string, hunk: ConflictHunk): string {
  return applyConflictResolution(content, hunk, 'both');
}

export function applyConflictResolution(
  content: string,
  hunk: ConflictHunk,
  side: 'current' | 'incoming' | 'both',
): string {
  const lines = content.split('\n');
  const replacement =
    side === 'current'
      ? hunk.currentLines
      : side === 'incoming'
        ? hunk.incomingLines
        : [...hunk.currentLines, ...hunk.incomingLines];

  const before = lines.slice(0, hunk.startLine);
  const after = lines.slice(hunk.endLine + 1);
  return [...before, ...replacement, ...after].join('\n');
}

/**
 * Resolve EVERY hunk in one pass using the same side for all. Used
 * by the "Accept all current" / "Accept all incoming" actions a UI
 * may expose for one-click conflict resolution.
 *
 * Works back-to-front so earlier indices stay valid throughout —
 * resolving hunks in order would shift the indices of later hunks
 * each time.
 */
export function applyConflictResolutionAll(
  content: string,
  side: 'current' | 'incoming' | 'both',
): string {
  let next = content;
  const hunks = detectConflicts(next);
  for (let i = hunks.length - 1; i >= 0; i -= 1) {
    const h = hunks[i];
    if (!h) continue;
    next = applyConflictResolution(next, h, side);
  }
  return next;
}

/**
 * Quick predicate the editor uses to decide whether to render the
 * conflict toolbar. Cheaper than calling `detectConflicts` when the
 * caller only needs a yes/no.
 */
export function hasConflictMarkers(content: string): boolean {
  // Cheap substring filter first, then verify with the line-anchored
  // regex on the lines that contain the substring — covers the
  // ~99.9% case where the file simply has no conflicts.
  if (!content.includes('<<<<<<<')) return false;
  const lines = content.split('\n');
  return lines.some((l) => START_RE.test(l));
}
