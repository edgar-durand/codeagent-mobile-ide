/**
 * The IDE "file viewer" contract: read / write file contents on whatever
 * backend the consumer wires up — a paired CodeAgent session, a GitHub
 * Codespaces workspace, a local filesystem bridge, an S3 bucket, anything
 * that can answer read/write operations.
 *
 * The adapter pattern means @codeam/ide-web and @codeam/ide-native render
 * the same UI on top of any provider, and consumers can compose multiple
 * adapters per-surface (a chat session uses one fetcher, an IDE page uses
 * another). The interface lives here in @codeam/ide-core so providers can
 * import the contract without dragging a UI framework into their bundle.
 */

export type FileOperation = 'Read' | 'Write';

export interface FileViewerRequest {
  /** Absolute path inside the workspace (e.g. `src/index.ts`). */
  path: string;
  /** Hint to the UI about whether the user intended to read or edit. */
  op: FileOperation;
}

export interface FileReadResult {
  /** UTF-8 contents. Omit when `error` is set. */
  content?: string;
  /** Human-readable failure reason. Omit on success. */
  error?: string;
}

export interface FileWriteResult {
  /** Some backends echo back the bytes-written counter. Optional. */
  bytesWritten?: number;
  /** Human-readable failure reason. Omit on success. */
  error?: string;
}

/**
 * Adapter the FileViewer host calls to talk to its backend. Implementations
 * MUST be stable across renders (typically a module-level singleton or a
 * memoised hook return value) — the host's `useEffect` keys off the adapter
 * identity and re-fetches whenever it changes.
 */
export interface FileFetcher {
  /**
   * Human-readable label for the adapter (e.g. the sessionId). Used by the
   * UI for status badges and debug overlays.
   */
  label: string;
  /**
   * `true` when the backend can persist writes. The UI hides the Save
   * button (and disables the editor's writeable state) when this is `false`.
   */
  canWrite: boolean;
  read(path: string): Promise<FileReadResult>;
  write(path: string, content: string): Promise<FileWriteResult>;
}
