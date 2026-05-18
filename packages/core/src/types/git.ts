/**
 * Source control adapter contract.
 *
 * Each method maps to the equivalent VS Code source-control view operation
 * (status, diff, stage, commit, push). Implementations talk to whatever the
 * consumer's backend exposes: a Git CLI proxy, a libgit2 binding, GitHub
 * via REST, etc. Mocked in tests by providing a fake GitProvider that
 * returns canned payloads.
 */

export interface GitStatusEntry {
  /** Short status code: 'M' (modified), 'A' (added), 'D' (deleted), '?' (untracked), etc. */
  code: string;
  /** Path relative to the repo root. */
  path: string;
  /** Original path when the change is a rename. */
  oldPath?: string;
  staged: boolean;
  conflict: boolean;
}

export interface GitStatusPayload {
  branch: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
  entries: GitStatusEntry[];
  hasMergeInProgress: boolean;
  error?: string;
}

export interface GitDiffResult {
  diff: string;
  truncated: boolean;
}

export interface GitCommitOptions {
  message: string;
  amend?: boolean;
  /** Stage all unstaged changes before committing. */
  all?: boolean;
}

export interface GitLogEntry {
  /** Full commit SHA. */
  sha: string;
  /** First line of the commit message. */
  subject: string;
  /** Author display name. */
  author: string;
  /** Commit timestamp (epoch ms). */
  timestamp: number;
  /** Branch / tag refs that point at this commit (e.g. ["main",
   * "origin/main"]). Empty when none. */
  refs?: string[];
}

export interface GitProvider {
  status(): Promise<GitStatusPayload>;
  diff(path: string, staged?: boolean): Promise<GitDiffResult | null>;
  stage(paths: string[]): Promise<void>;
  unstage(paths: string[]): Promise<void>;
  commit(options: GitCommitOptions): Promise<{ sha: string } | { error: string }>;
  push(): Promise<{ ok: true } | { error: string }>;
  fetch(): Promise<{ ok: true } | { error: string }>;
  /**
   * Optional `pull` (fetch + fast-forward / merge). Providers that
   * model pull as a separate operation can implement it; the
   * SourceControlPanel falls back to `fetch()` followed by a UI
   * hint when this is omitted.
   */
  pull?(): Promise<{ ok: true } | { error: string }>;
  /** Optional commit-log accessor. When defined, the Source Control
   * panel renders a Graph section underneath the commit composer. */
  log?(limit?: number): Promise<GitLogEntry[]>;
}
