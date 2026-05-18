import { githubDarkTheme } from './github-dark';
import { githubLightTheme } from './github-light';
import type { MonacoTheme } from '../types/theme';

/**
 * Themes the library ships out-of-the-box. The first four (`vs-dark`,
 * `vs`, `hc-black`, `hc-light`) are built into Monaco itself — we
 * surface them as IDs only; no JSON to register. The GitHub variants
 * are custom palettes registered on InlineEditor mount.
 */
export const BUILTIN_MONACO_THEMES: readonly string[] = [
  'vs-dark',
  'vs',
  'hc-black',
  'hc-light',
];

/**
 * Custom themes bundled with `@codeam/ide-core`. The InlineEditor
 * iterates this list on mount and calls `monaco.editor.defineTheme`
 * for each before it picks up `settings.theme`. Order in this array
 * is the order shown in the picker.
 */
export const BUNDLED_CUSTOM_THEMES: readonly MonacoTheme[] = [
  githubDarkTheme,
  githubLightTheme,
];

/**
 * Default theme metadata for the picker UI. `id` is what gets stored
 * in `SettingsStore` as `editor.theme`; `label` is the human label.
 * Consumers can override by passing their own list to SettingsPanel.
 */
export const DEFAULT_THEME_CHOICES: readonly { id: string; label: string }[] = [
  { id: 'vs-dark', label: 'Dark (Visual Studio)' },
  { id: 'vs', label: 'Light (Visual Studio)' },
  { id: 'github-dark', label: 'GitHub Dark' },
  { id: 'github-light', label: 'GitHub Light' },
  { id: 'hc-black', label: 'High Contrast Dark' },
  { id: 'hc-light', label: 'High Contrast Light' },
];

export { githubDarkTheme, githubLightTheme };
