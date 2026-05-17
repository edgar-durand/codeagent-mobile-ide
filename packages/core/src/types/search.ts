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
}
