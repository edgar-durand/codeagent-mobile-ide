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

/**
 * Curated list of popular VS Code marketplace themes the
 * SettingsPanel surfaces in a "Popular themes" row. Each entry
 * points at the theme's official JSON inside the theme author's
 * own public GitHub repo (raw.githubusercontent.com served with
 * permissive CORS) so the panel can fetch + register on a single
 * click — no .vsix dance, no copy-paste.
 *
 * Inclusion criteria:
 * - MIT (or comparably permissive) license on the upstream repo.
 * - JSON theme file directly fetchable, no preprocessor (YAML →
 *   JSON build step) needed.
 * - Active maintenance — at least one update in the past year.
 *
 * Adding a theme: just push another `{ name, url }` entry. The
 * UI doesn't bundle theme JSON; everything fetches at runtime,
 * so the library tarball stays small.
 */
export interface MarketplaceThemeRef {
  /** Display name shown in the picker. */
  name: string;
  /** Direct URL to the *-color-theme.json. CORS must permit
   * cross-origin fetch from a browser (raw.githubusercontent.com
   * does; some CDNs don't). */
  url: string;
  /** Optional homepage / repo URL for credit / "view source". */
  homepage?: string;
}

export const MARKETPLACE_THEMES: readonly MarketplaceThemeRef[] = [
  {
    name: 'One Dark Pro',
    url: 'https://raw.githubusercontent.com/Binaryify/OneDark-Pro/master/themes/OneDark-Pro.json',
    homepage: 'https://github.com/Binaryify/OneDark-Pro',
  },
  {
    name: 'Night Owl',
    url: 'https://raw.githubusercontent.com/sdras/night-owl-vscode-theme/master/themes/Night%20Owl-color-theme.json',
    homepage: 'https://github.com/sdras/night-owl-vscode-theme',
  },
  {
    name: 'Cobalt2',
    url: 'https://raw.githubusercontent.com/wesbos/cobalt2-vscode/master/theme/cobalt2.json',
    homepage: 'https://github.com/wesbos/cobalt2-vscode',
  },
  {
    name: 'SynthWave \'84',
    url: 'https://raw.githubusercontent.com/robb0wen/synthwave-vscode/master/themes/synthwave-color-theme.json',
    homepage: 'https://github.com/robb0wen/synthwave-vscode',
  },
  {
    name: 'Tokyo Night',
    url: 'https://raw.githubusercontent.com/enkia/tokyo-night-vscode-theme/master/themes/tokyo-night-color-theme.json',
    homepage: 'https://github.com/enkia/tokyo-night-vscode-theme',
  },
  {
    name: 'Andromeda',
    url: 'https://raw.githubusercontent.com/EliverLara/Andromeda/master/themes/andromeda-color-theme.json',
    homepage: 'https://github.com/EliverLara/Andromeda',
  },
];
