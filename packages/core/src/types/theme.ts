/**
 * Monaco theme contract — matches the shape `monaco.editor.defineTheme`
 * accepts, with the bare minimum the IDE library needs to register
 * and apply a custom palette. Consumers can ship arbitrarily many
 * extra themes alongside the bundled ones.
 *
 * The format is INTENTIONALLY identical to Monaco's so a Monaco
 * theme JSON (e.g. `monaco-themes` package output) can be imported
 * as-is, no transform required.
 */
export interface MonacoTheme {
  /**
   * Theme name as displayed in the picker AND as the key
   * `monaco.editor.setTheme` accepts. Must be unique across the
   * registered set.
   */
  name: string;
  /**
   * `vs` (light), `vs-dark` (dark), `hc-black` (high-contrast dark),
   * or `hc-light` (high-contrast light). Determines the fallback
   * palette used for tokens the theme doesn't define.
   */
  base: 'vs' | 'vs-dark' | 'hc-black' | 'hc-light';
  /** Inherit unset values from `base`. Almost always `true`. */
  inherit: boolean;
  /**
   * Token rules — same shape as `monaco.editor.IThemeRule`. Color
   * strings are 6-hex without leading `#`.
   */
  rules: ThemeRule[];
  /**
   * Editor colors keyed by Monaco's color id (see
   * https://code.visualstudio.com/api/references/theme-color). VS
   * Code marketplace themes typically populate this richly; Monaco
   * applies whatever it recognises and ignores the rest.
   */
  colors: Record<string, string>;
}

export interface ThemeRule {
  /** Monaco/TextMate scope, e.g. `comment`, `keyword.control`. */
  token: string;
  foreground?: string;
  background?: string;
  fontStyle?: string;
}

/**
 * Shape of a theme JSON file downloaded from the VS Code marketplace.
 * Themes ship inside a `.vsix` extension; the theme JSON itself lives
 * at `<extension>/themes/<name>.json`. The user-facing
 * "import theme" flow accepts THIS shape, not the .vsix archive.
 *
 * Reference: https://code.visualstudio.com/api/extension-guides/color-theme
 */
export interface VSCodeColorTheme {
  name?: string;
  type?: 'dark' | 'light' | 'hc' | 'hcLight';
  colors?: Record<string, string>;
  tokenColors?: VSCodeTokenColor[];
  /**
   * Some themes use semantic highlighting; we ignore it for now
   * (Monaco's semantic highlighting is opt-in and rarely needed
   * for embedded use cases).
   */
  semanticHighlighting?: boolean;
  semanticTokenColors?: Record<string, unknown>;
  /**
   * `include` lets a marketplace theme reference a sibling JSON
   * file. We don't recursively resolve includes — the importer
   * should flatten before passing in.
   */
  include?: string;
}

export interface VSCodeTokenColor {
  /**
   * Scope can be a single string OR an array of strings. Each entry
   * becomes a Monaco rule sharing the same `settings`.
   */
  scope?: string | string[];
  settings: {
    foreground?: string;
    background?: string;
    fontStyle?: string;
  };
}

/**
 * Strip a leading `#` from a hex color. Monaco wants `RRGGBB` /
 * `RRGGBBAA` without the hash; VS Code themes use `#RRGGBB`.
 * Returns `undefined` for non-string / empty values so the caller
 * can omit the field rather than emit `''`.
 */
/**
 * Strip both styles of comment (line and block) and trailing
 * commas before `}` / `]` from a JSONC source string so the result
 * can be passed to `JSON.parse`. VS Code theme JSON files use the
 * JSONC dialect even though they're served with a `.json`
 * extension — this is what lets a marketplace theme's published
 * file start with a comment block describing the palette.
 *
 * Aware of:
 *   - strings: a "// not a comment" or a "block-style" run is left
 *     alone so it can appear verbatim inside theme `name` fields.
 *   - escaped quotes inside strings (so a "\"" doesn't exit early).
 *   - bare LF line endings (CRLF works too — only the `\n` matters
 *     for terminating a line comment).
 *
 * NOT aware of:
 *   - Unicode line separators U+2028 / U+2029 — bare `\n` is
 *     close enough for hand-written theme files.
 *   - Single-quoted strings (JSONC, like JSON, disallows them).
 *
 * The parser is intentionally tiny + state-machine driven so it
 * runs in a single pass with no allocations beyond the output
 * builder.
 */
export function stripJsoncCommentsAndTrailingCommas(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  let inString = false;
  while (i < n) {
    const ch = src[i];
    const next = i + 1 < n ? src[i + 1] : '';
    if (inString) {
      out += ch;
      if (ch === '\\' && i + 1 < n) {
        // Preserve the escaped char verbatim — important for `\"`
        // so we don't accidentally exit the string state.
        out += src[i + 1];
        i += 2;
        continue;
      }
      if (ch === '"') inString = false;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '/') {
      // Line comment — skip to newline (or EOF). Don't append.
      i += 2;
      while (i < n && src[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      // Block comment — skip to closing `*/` (or EOF).
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
      if (i < n) i += 2; // consume the `*/`
      continue;
    }
    out += ch;
    i += 1;
  }
  // Second pass: drop trailing commas. Match `,\s*[}\]]` and remove
  // the comma. Cheap enough that we don't bother inlining it into
  // the main scanner.
  return out.replace(/,(\s*[}\]])/g, '$1');
}

/**
 * Parse a JSONC source string and return the resulting value. Thin
 * wrapper over the strip helper + `JSON.parse`. Useful when the
 * caller has the raw bytes and doesn't need the intermediate
 * cleaned string for any other purpose.
 */
export function parseJsonc<T = unknown>(src: string): T {
  return JSON.parse(stripJsoncCommentsAndTrailingCommas(src)) as T;
}

function stripHash(c: string | undefined): string | undefined {
  if (!c) return undefined;
  return c.startsWith('#') ? c.slice(1) : c;
}

function mapType(t: VSCodeColorTheme['type']): MonacoTheme['base'] {
  switch (t) {
    case 'light':
      return 'vs';
    case 'hc':
      return 'hc-black';
    case 'hcLight':
      return 'hc-light';
    case 'dark':
    default:
      return 'vs-dark';
  }
}

/**
 * Convert a VS Code marketplace `*-color-theme.json` into a Monaco
 * theme. Lossy on:
 *   - semantic highlighting (dropped)
 *   - `include` chains (caller must flatten first)
 *
 * The output is ready to pass to `monaco.editor.defineTheme(name, theme)`.
 *
 * @param raw The parsed JSON object.
 * @param fallbackName Used when the theme JSON omits a `name`
 *   (uncommon but allowed by the marketplace schema).
 */
export function vscodeThemeToMonaco(
  raw: VSCodeColorTheme,
  fallbackName: string,
): MonacoTheme {
  const rules: ThemeRule[] = [];
  for (const tc of raw.tokenColors ?? []) {
    const scopes = Array.isArray(tc.scope)
      ? tc.scope
      : typeof tc.scope === 'string'
        ? tc.scope.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
    if (scopes.length === 0) {
      // Some themes use a tokenColor with no `scope` as a default —
      // Monaco represents that as an empty-token rule.
      const fg = stripHash(tc.settings.foreground);
      const bg = stripHash(tc.settings.background);
      if (!fg && !bg && !tc.settings.fontStyle) continue;
      rules.push({
        token: '',
        ...(fg ? { foreground: fg } : {}),
        ...(bg ? { background: bg } : {}),
        ...(tc.settings.fontStyle ? { fontStyle: tc.settings.fontStyle } : {}),
      });
      continue;
    }
    for (const scope of scopes) {
      const fg = stripHash(tc.settings.foreground);
      const bg = stripHash(tc.settings.background);
      rules.push({
        token: scope,
        ...(fg ? { foreground: fg } : {}),
        ...(bg ? { background: bg } : {}),
        ...(tc.settings.fontStyle ? { fontStyle: tc.settings.fontStyle } : {}),
      });
    }
  }

  return {
    name: raw.name ?? fallbackName,
    base: mapType(raw.type),
    inherit: true,
    rules,
    colors: raw.colors ?? {},
  };
}
