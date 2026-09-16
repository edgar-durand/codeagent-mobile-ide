/**
 * Monaco WebView HTML templates — shared between @codeam/ide-web and
 * @codeam/ide-native. Each function returns a self-contained HTML page
 * string. All are pure — no side effects, no DOM access.
 *
 * The Monaco CDN URL is centralised here so upgrading the Monaco
 * version is a single-line change.
 */

/** jsDelivr permalink — bump this to upgrade Monaco across the library. */
export const MONACO_CDN_BASE = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52/min/vs';

export { buildEditorHtml } from './buildEditorHtml';
export type { BuildEditorHtmlOptions } from './buildEditorHtml';
export { buildDiffHtml } from './buildDiffHtml';
export type { BuildDiffHtmlOptions } from './buildDiffHtml';
export { buildTerminalHtml } from './buildTerminalHtml';
export type { BuildTerminalHtmlOptions } from './buildTerminalHtml';
