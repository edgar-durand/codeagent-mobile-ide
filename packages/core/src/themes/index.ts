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
  /** Publisher / author shown as the subtitle in the marketplace
   * browser card. */
  publisher: string;
  /** One-line description shown below the name. */
  description: string;
  /** Direct URL to the *-color-theme.json. CORS must permit
   * cross-origin fetch from a browser (raw.githubusercontent.com
   * does; some CDNs don't). */
  url: string;
  /** Optional homepage / repo URL for "view source". */
  homepage?: string;
  /**
   * `'dark' | 'light'` classification for the category filter.
   * Themes with high-contrast variants use `'dark'` unless they're
   * primarily light-on-dark.
   */
  kind: 'dark' | 'light';
  /**
   * Three-color swatch the marketplace card renders without
   * fetching the full theme. Order: background, foreground,
   * accent — picked from a representative slice of each theme's
   * palette so users get a visual preview at-a-glance.
   */
  swatch: { bg: string; fg: string; accent: string };
}

/**
 * Curated marketplace themes. Every URL is verified to return 200
 * with CORS-friendly headers at publish time. Items split into two
 * groups:
 *   - First-party (`microsoft/vscode` repo) — these are the themes
 *     that ship inside VS Code itself, surfaced as if they were
 *     marketplace entries so users get the familiar names.
 *   - Third-party — popular community themes, hosted in the
 *     theme author's own GitHub repo.
 *
 * Adding a theme: verify the URL returns JSON with `colors` +
 * `tokenColors`, then push an entry below. The library never
 * bundles the theme JSON itself — everything fetches at runtime.
 */
export const MARKETPLACE_THEMES: readonly MarketplaceThemeRef[] = [
  // First-party (microsoft/vscode built-ins)
  {
    name: 'Monokai',
    publisher: 'Microsoft',
    description: 'The classic Monokai theme.',
    url: 'https://raw.githubusercontent.com/microsoft/vscode/main/extensions/theme-monokai/themes/monokai-color-theme.json',
    homepage: 'https://github.com/microsoft/vscode/tree/main/extensions/theme-monokai',
    kind: 'dark',
    swatch: { bg: '#272822', fg: '#f8f8f2', accent: '#a6e22e' },
  },
  {
    name: 'Monokai Dimmed',
    publisher: 'Microsoft',
    description: 'A muted-palette take on Monokai.',
    url: 'https://raw.githubusercontent.com/microsoft/vscode/main/extensions/theme-monokai-dimmed/themes/dimmed-monokai-color-theme.json',
    homepage: 'https://github.com/microsoft/vscode/tree/main/extensions/theme-monokai-dimmed',
    kind: 'dark',
    swatch: { bg: '#1e1e1e', fg: '#c5c8c6', accent: '#9872a2' },
  },
  {
    name: 'Solarized Dark',
    publisher: 'Microsoft',
    description: 'Precision colors for machines and people.',
    url: 'https://raw.githubusercontent.com/microsoft/vscode/main/extensions/theme-solarized-dark/themes/solarized-dark-color-theme.json',
    homepage: 'https://ethanschoonover.com/solarized/',
    kind: 'dark',
    swatch: { bg: '#002b36', fg: '#93a1a1', accent: '#268bd2' },
  },
  {
    name: 'Solarized Light',
    publisher: 'Microsoft',
    description: 'The light variant of Ethan Schoonover\'s Solarized.',
    url: 'https://raw.githubusercontent.com/microsoft/vscode/main/extensions/theme-solarized-light/themes/solarized-light-color-theme.json',
    homepage: 'https://ethanschoonover.com/solarized/',
    kind: 'light',
    swatch: { bg: '#fdf6e3', fg: '#586e75', accent: '#268bd2' },
  },
  {
    name: 'Tomorrow Night Blue',
    publisher: 'Microsoft',
    description: 'A blue-tinted dark theme from the Tomorrow family.',
    url: 'https://raw.githubusercontent.com/microsoft/vscode/main/extensions/theme-tomorrow-night-blue/themes/tomorrow-night-blue-color-theme.json',
    homepage: 'https://github.com/microsoft/vscode/tree/main/extensions/theme-tomorrow-night-blue',
    kind: 'dark',
    swatch: { bg: '#002451', fg: '#ffffff', accent: '#ffc58f' },
  },
  {
    name: 'Abyss',
    publisher: 'Microsoft',
    description: 'A deep-blue dark theme.',
    url: 'https://raw.githubusercontent.com/microsoft/vscode/main/extensions/theme-abyss/themes/abyss-color-theme.json',
    homepage: 'https://github.com/microsoft/vscode/tree/main/extensions/theme-abyss',
    kind: 'dark',
    swatch: { bg: '#000c18', fg: '#6688cc', accent: '#225588' },
  },
  {
    name: 'Kimbie Dark',
    publisher: 'Microsoft',
    description: 'Warm earth tones, easy on the eyes.',
    url: 'https://raw.githubusercontent.com/microsoft/vscode/main/extensions/theme-kimbie-dark/themes/kimbie-dark-color-theme.json',
    homepage: 'https://github.com/microsoft/vscode/tree/main/extensions/theme-kimbie-dark',
    kind: 'dark',
    swatch: { bg: '#221a0f', fg: '#d3af86', accent: '#f06431' },
  },
  {
    name: 'Quiet Light',
    publisher: 'Microsoft',
    description: 'Soft pastels on a warm white background.',
    url: 'https://raw.githubusercontent.com/microsoft/vscode/main/extensions/theme-quietlight/themes/quietlight-color-theme.json',
    homepage: 'https://github.com/microsoft/vscode/tree/main/extensions/theme-quietlight',
    kind: 'light',
    swatch: { bg: '#f5f5f5', fg: '#333333', accent: '#7a3e9d' },
  },
  {
    name: 'Red',
    publisher: 'Microsoft',
    description: 'Bold reds on a dark canvas.',
    url: 'https://raw.githubusercontent.com/microsoft/vscode/main/extensions/theme-red/themes/Red-color-theme.json',
    homepage: 'https://github.com/microsoft/vscode/tree/main/extensions/theme-red',
    kind: 'dark',
    swatch: { bg: '#390000', fg: '#f8f8f8', accent: '#fb9a4b' },
  },
  // Third-party community themes (popular)
  {
    name: 'One Dark Pro',
    publisher: 'Binaryify',
    description: 'Atom\'s iconic One Dark theme — VS Code edition.',
    url: 'https://raw.githubusercontent.com/Binaryify/OneDark-Pro/master/themes/OneDark-Pro.json',
    homepage: 'https://github.com/Binaryify/OneDark-Pro',
    kind: 'dark',
    swatch: { bg: '#282c34', fg: '#abb2bf', accent: '#61afef' },
  },
  {
    name: 'Night Owl',
    publisher: 'Sarah Drasner',
    description: 'A theme for night owls (and those who want to look like one).',
    url: 'https://raw.githubusercontent.com/sdras/night-owl-vscode-theme/master/themes/Night%20Owl-color-theme.json',
    homepage: 'https://github.com/sdras/night-owl-vscode-theme',
    kind: 'dark',
    swatch: { bg: '#011627', fg: '#d6deeb', accent: '#82aaff' },
  },
  {
    name: 'Cobalt2',
    publisher: 'Wes Bos',
    description: 'A high-contrast dark theme — bold yellows and blues.',
    url: 'https://raw.githubusercontent.com/wesbos/cobalt2-vscode/master/theme/cobalt2.json',
    homepage: 'https://github.com/wesbos/cobalt2-vscode',
    kind: 'dark',
    swatch: { bg: '#193549', fg: '#ffffff', accent: '#ffc600' },
  },
  {
    name: 'SynthWave \'84',
    publisher: 'Robb Owen',
    description: 'A neon-glow dark theme inspired by 80s sci-fi.',
    url: 'https://raw.githubusercontent.com/robb0wen/synthwave-vscode/master/themes/synthwave-color-theme.json',
    homepage: 'https://github.com/robb0wen/synthwave-vscode',
    kind: 'dark',
    swatch: { bg: '#241b2f', fg: '#ffffff', accent: '#ff7edb' },
  },
  {
    name: 'Tokyo Night',
    publisher: 'enkia',
    description: 'Tokyo at night, captured in a dark theme.',
    url: 'https://raw.githubusercontent.com/enkia/tokyo-night-vscode-theme/master/themes/tokyo-night-color-theme.json',
    homepage: 'https://github.com/enkia/tokyo-night-vscode-theme',
    kind: 'dark',
    swatch: { bg: '#1a1b26', fg: '#a9b1d6', accent: '#7aa2f7' },
  },
  {
    name: 'Shades of Purple',
    publisher: 'Ahmad Awais',
    description: 'A professional dark theme with shades of purple.',
    url: 'https://raw.githubusercontent.com/AhmadAwais/shades-of-purple-vscode/master/themes/shades-of-purple-color-theme.json',
    homepage: 'https://github.com/AhmadAwais/shades-of-purple-vscode',
    kind: 'dark',
    swatch: { bg: '#2d2b55', fg: '#ffffff', accent: '#fad000' },
  },
];
