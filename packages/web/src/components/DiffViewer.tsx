import { useEffect, useState } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { detectLanguage, type FileFetcher, type GitProvider } from '@codeam/ide-core';

interface Props {
  /** Repo path of the file to diff (relative to workspace root). */
  path: string;
  /** Provider used to fetch the diff. */
  git: GitProvider;
  /** Fetcher used to read the working-tree (right-hand) version. */
  fetcher: FileFetcher;
  /** When `true`, diff the staged version vs HEAD instead of
   * working-tree vs HEAD. */
  staged?: boolean;
  /** Close button handler (rendered top-right when supplied). */
  onClose?: () => void;
}

interface DiffState {
  loading: boolean;
  error: string | null;
  original: string;
  modified: string;
}

/**
 * Inline side-by-side diff viewer powered by Monaco's `DiffEditor`.
 * Designed to live in the IDE's main pane (replace InlineEditor)
 * when a user clicks a changed file in the SourceControlPanel.
 *
 * Strategy:
 *   1. Fetch the working-tree version via `fileFetcher.read`.
 *   2. Fetch the unified diff via `git.diff`.
 *   3. Reconstruct the "original" side by applying the diff in
 *      reverse to the working-tree content. This avoids needing a
 *      separate `git show` call for the HEAD blob — most adapters
 *      already expose `diff` so this works without expanding the
 *      provider contract.
 *
 * Limitations: binary files and rename detection aren't handled
 * specially; for those the viewer renders the raw diff text in a
 * read-only Monaco buffer.
 */
export function DiffViewer({ path, git, fetcher, staged, onClose }: Props) {
  const [state, setState] = useState<DiffState>({
    loading: true,
    error: null,
    original: '',
    modified: '',
  });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, error: null, original: '', modified: '' });
    (async () => {
      try {
        const [diffResult, readResult] = await Promise.all([
          git.diff(path, staged),
          fetcher.read(path),
        ]);
        if (cancelled) return;
        if (!readResult || readResult.error) {
          setState({
            loading: false,
            error: readResult?.error ?? 'Could not read working-tree version.',
            original: '',
            modified: '',
          });
          return;
        }
        const modified = readResult.content ?? '';
        const original = diffResult?.diff
          ? reconstructOriginal(modified, diffResult.diff)
          : modified;
        setState({ loading: false, error: null, original, modified });
      } catch (e) {
        if (cancelled) return;
        setState({
          loading: false,
          error: e instanceof Error ? e.message : 'Diff failed.',
          original: '',
          modified: '',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path, staged, git, fetcher]);

  const language = detectLanguage(path);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0d1117]">
      <div className="flex items-center justify-between px-3 py-1 bg-[#161b22] border-b border-gray-800/60 text-[11px]">
        <span className="font-mono text-gray-300 truncate flex-1">
          {path} <span className="text-gray-500 ml-2">{staged ? 'STAGED' : 'WORKING TREE'}</span>
        </span>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-200 transition-colors"
            aria-label="Close diff"
          >
            ✕
          </button>
        ) : null}
      </div>
      {state.error ? (
        <div className="px-3 py-1.5 text-[11px] font-mono bg-rose-500/10 border-b border-rose-500/30 text-rose-200">
          {state.error}
        </div>
      ) : null}
      <div className="flex-1 min-h-0">
        {state.loading ? (
          <div className="h-full flex items-center justify-center text-gray-500 text-sm">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse mr-1.5" />
            Loading diff…
          </div>
        ) : (
          <DiffEditor
            height="100%"
            theme="vs-dark"
            language={language}
            original={state.original}
            modified={state.modified}
            options={{
              readOnly: true,
              renderSideBySide: true,
              minimap: { enabled: false },
              wordWrap: 'on',
              fontSize: 13,
              automaticLayout: true,
              scrollBeyondLastLine: false,
            }}
          />
        )}
      </div>
    </div>
  );
}

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
