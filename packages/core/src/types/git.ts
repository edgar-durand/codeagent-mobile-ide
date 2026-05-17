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

export interface GitProvider {
  status(): Promise<GitStatusPayload>;
  diff(path: string, staged?: boolean): Promise<GitDiffResult | null>;
  stage(paths: string[]): Promise<void>;
  unstage(paths: string[]): Promise<void>;
  commit(options: GitCommitOptions): Promise<{ sha: string } | { error: string }>;
  push(): Promise<{ ok: true } | { error: string }>;
  fetch(): Promise<{ ok: true } | { error: string }>;
}
