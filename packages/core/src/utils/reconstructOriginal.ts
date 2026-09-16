/**
 * Reverse a unified-diff: take the "modified" (working-tree) buffer
 * and the diff that turns ORIGINAL into MODIFIED, return ORIGINAL.
 *
 * We parse only the canonical `@@ -a,b +c,d @@` hunks and the
 * `-` / `+` / ` ` line prefixes. Anything else (no-newline-at-EOF
 * markers, file-mode hunks, binary indicators) is treated as a
 * pass-through. This is good enough for the IDE diff viewer; the
 * downside is that pathological diffs (very large rename
 * sequences, partial hunk corruption) may render imperfectly —
 * acceptable trade-off vs. requiring a `git show HEAD:<path>`
 * round-trip.
 */
export function reconstructOriginal(modified: string, diff: string): string {
  const modifiedLines = modified.split('\n');
  const original: string[] = [];
  let cursor = 0;

  const lines = diff.split('\n');
  let i = 0;
  // Skip header lines until the first hunk.
  while (i < lines.length && !(lines[i] ?? '').startsWith('@@')) i++;

  while (i < lines.length) {
    const header = lines[i] ?? '';
    const match = header.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (!match) {
      i++;
      continue;
    }
    const newStart = parseInt(match[3] ?? '1', 10) - 1;
    // Copy unchanged lines up to the hunk's `+start`.
    while (cursor < newStart && cursor < modifiedLines.length) {
      original.push(modifiedLines[cursor] ?? '');
      cursor++;
    }
    i++;
    while (i < lines.length && !(lines[i] ?? '').startsWith('@@')) {
      const raw = lines[i] ?? '';
      i++;
      if (raw.startsWith('\\')) continue; // \ No newline at end of file
      const prefix = raw[0];
      const body = raw.slice(1);
      if (prefix === ' ') {
        original.push(body);
        cursor++;
      } else if (prefix === '-') {
        original.push(body);
      } else if (prefix === '+') {
        cursor++;
      } else {
        // Unknown — preserve as context.
        original.push(raw);
        cursor++;
      }
    }
  }
  while (cursor < modifiedLines.length) {
    original.push(modifiedLines[cursor] ?? '');
    cursor++;
  }
  return original.join('\n');
}
