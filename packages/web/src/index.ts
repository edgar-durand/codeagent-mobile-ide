/**
 * @codeam/ide-web — public surface.
 *
 * React (DOM) UI components. Re-exports the core types so consumers only
 * need a single import for both the adapter interface they're going to
 * implement and the UI components they're going to render.
 */
export * from '@codeam/ide-core';

export { FileViewerProvider, useFileViewer } from './components/FileViewerContext';
export type { FileViewerContextValue } from './components/FileViewerContext';
export { FileViewerHost } from './components/FileViewerHost';

export { ActivityBar } from './components/ActivityBar';
export type { ActivityBarItem } from './components/ActivityBar';

export { IDEShell } from './components/IDEShell';

export { FileTreeSidebar } from './components/FileTreeSidebar';
export { SourceControlPanel } from './components/SourceControlPanel';
export { SearchPanel } from './components/SearchPanel';
export { SettingsPanel, CUSTOM_THEMES_STORE_KEY } from './components/SettingsPanel';
export { useMonacoThemes } from './hooks/useMonacoThemes';
export { TerminalPanel } from './components/TerminalPanel';
export { TabsBar } from './components/TabsBar';
export type { EditorTab } from './components/TabsBar';
export { Breadcrumbs } from './components/Breadcrumbs';
export { DiffViewer, reconstructOriginal } from './components/DiffViewer';
export { SplitPane } from './components/SplitPane';
export { ConflictBanner } from './components/ConflictBanner';
export { MarketplacePanel } from './components/MarketplacePanel';
