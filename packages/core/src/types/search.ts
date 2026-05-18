/**
 * Multi-file search adapter contract.
 *
 * Mirrors VS Code's search panel: a query string plus per-search options,
 * and a stream of hits grouped by file. Implementations typically pipe
 * the query through `git grep` or `ripgrep` on the backend and return the
 * structured hits — the UI does syntax highlighting client-side.
 */

export interface SearchOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regex?: boolean;
  /** Glob patterns to include (e.g. `["src/**", "*.ts"]`). */
  include?: string[];
  /** Glob patterns to exclude (e.g. `["node_modules/**"]`). */
  exclude?: string[];
  /** Max hits to return; the provider may further cap. */
  maxResults?: number;
}

export interface SearchHit {
  /** Path relative to the workspace root. */
  path: string;
  /** 1-based line number. */
  line: number;
  /** 1-based column number (start of match). */
  column: number;
  /** Full line text for context display. */
  text: string;
  /** Length of the match within `text`, starting at `column - 1`. */
  matchLength: number;
}

export interface SearchResult {
  hits: SearchHit[];
  /** Total hit count if the provider knows it (may exceed `hits.length`). */
  total?: number;
  truncated: boolean;
}

export interface SearchProvider {
  search(query: string, options?: SearchOptions): Promise<SearchResult>;
  /**
   * Optional. When implemented, the SearchPanel renders a replace
   * input + per-hit / Replace-All affordances. Implementations
   * should perform the substitution server-side (single
   * transactional pass per file, never per-hit) and return the
   * count of replaced occurrences.
   *
   * Providers that don't support replace simply omit this method —
   * the UI hides the replace surface automatically.
   */
  replace?(
    query: string,
    replacement: string,
    options?: SearchOptions,
    /** When provided, restricts the replacement to a specific
     * subset of hits — used by the "Replace in this file" action.
     * Empty / omitted ⇒ replace across the entire search scope. */
    targets?: Array<{ path: string; line?: number; column?: number }>,
  ): Promise<{ filesChanged: number; replaced: number }>;
}
