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
