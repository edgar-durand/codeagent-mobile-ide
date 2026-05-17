/**
 * @codeam/ide-native — public surface.
 *
 * React Native UI components for the @codeam/ide library. Re-exports
 * the core types so consumers only need a single import for both the
 * adapter interface they're going to implement and the UI components
 * they're going to render.
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
export { SettingsPanel } from './components/SettingsPanel';
export { TabsBar } from './components/TabsBar';
export type { EditorTab } from './components/TabsBar';
export { InlineEditor } from './components/InlineEditor';
export { Breadcrumbs } from './components/Breadcrumbs';
export { DiffViewer } from './components/DiffViewer';
export { TerminalPanel } from './components/TerminalPanel';
