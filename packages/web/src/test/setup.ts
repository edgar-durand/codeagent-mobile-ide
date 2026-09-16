/**
 * Vitest setup for @codeam/ide-web component specs.
 *
 * `@monaco-editor/react` fetches the editor from a CDN on first render, which
 * jsdom can't do and no spec needs — every component that embeds it is stubbed
 * down to a marker element. Everything else renders for real.
 */
import { vi } from 'vitest';
import { createElement } from 'react';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@monaco-editor/react', () => ({
  default: () => createElement('div', { 'data-testid': 'monaco-editor' }),
  DiffEditor: () => createElement('div', { 'data-testid': 'monaco-diff-editor' }),
  useMonaco: () => null,
}));
