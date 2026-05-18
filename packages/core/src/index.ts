/**
 * @codeam/ide-core — public surface.
 *
 * The pieces in this package are deliberately UI-framework-agnostic so a
 * backend implementing the adapter contract can ship without pulling React
 * (or any platform runtime) as a transitive dependency.
 */

export type {
  FileFetcher,
  FileReadResult,
  FileWriteResult,
  FileOperation,
  FileViewerRequest,
} from './types/file-viewer';

export type {
  GitProvider,
  GitStatusEntry,
  GitStatusPayload,
  GitDiffResult,
  GitCommitOptions,
  GitLogEntry,
} from './types/git';

export type {
  FileTreeEntry,
  FileTreePayload,
  FileTreeProvider,
} from './types/file-tree';

export type {
  SearchProvider,
  SearchHit,
  SearchOptions,
  SearchResult,
} from './types/search';

export type {
  TerminalProvider,
  TerminalSession,
  TerminalEvent,
} from './types/terminal';

export type {
  SettingsStore,
  EditorSettingsSnapshot,
} from './types/settings';
export { DEFAULT_EDITOR_SETTINGS } from './types/settings';

export type { IdeAdapters } from './types/adapters';

export { detectLanguage, LANGUAGE_BY_EXTENSION } from './language-detection';

export type {
  MonacoTheme,
  ThemeRule,
  VSCodeColorTheme,
  VSCodeTokenColor,
} from './types/theme';
export { vscodeThemeToMonaco } from './types/theme';

export {
  BUILTIN_MONACO_THEMES,
  BUNDLED_CUSTOM_THEMES,
  DEFAULT_THEME_CHOICES,
  githubDarkTheme,
  githubLightTheme,
} from './themes';

export type { ConflictHunk } from './utils/conflicts';
export {
  acceptBoth,
  acceptCurrent,
  acceptIncoming,
  applyConflictResolution,
  applyConflictResolutionAll,
  detectConflicts,
  hasConflictMarkers,
} from './utils/conflicts';
