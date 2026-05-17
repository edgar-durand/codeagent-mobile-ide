/**
 * File-tree adapter contract.
 *
 * The host renders a virtualised tree; the provider supplies the entry list
 * lazily. Implementations may return a flat list (everything under the
 * workspace root) or paginate by directory — the UI handles both.
 */

export interface FileTreeEntry {
  /** Path relative to the workspace root. */
  path: string;
  /** File basename, used by the UI for display. */
  name: string;
  /** Size in bytes. 0 for directories. */
  size: number;
}

export interface FileTreePayload {
  files: FileTreeEntry[];
  /** `true` when the provider truncated the response (large repos). */
  truncated: boolean;
  /** Absolute path of the workspace root, for breadcrumb / status rendering. */
  root: string;
}

export interface FileTreeProvider {
  /**
   * List entries. `query` is an optional substring filter; the provider may
   * apply it server-side or return the full set and let the UI filter
   * client-side. The host handles either case.
   */
  list(query?: string): Promise<FileTreePayload>;
}
