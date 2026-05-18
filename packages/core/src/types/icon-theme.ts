/**
 * File-icon resolver — used by FileTreeSidebar (and any future
 * "Open recent" UI) to pick which icon to render next to a path.
 *
 * The contract is intentionally tiny: the consumer hands in a
 * resolver and the UI calls it once per visible row. Resolution
 * happens in render, so impl MUST be O(1) per call (cache any
 * derived state inside the resolver factory).
 */
export interface FileIconResolver {
  /**
   * Icon for a regular file. `filename` is the BASENAME only
   * (`package.json`, not `apps/api/package.json`).
   */
  forFile(filename: string, languageId?: string | null): FileIconRef;
  /**
   * Icon for a folder. `expanded` lets the resolver swap to the
   * "open folder" variant some themes ship.
   */
  forFolder(folderName: string, expanded: boolean): FileIconRef;
}

/**
 * Discriminated icon reference. Different renderers across web /
 * native consume different forms, so the resolver returns a tagged
 * union and lets the UI surface pick the right kind to consume.
 *
 * - `none`: don't render an icon (the UI shows its default emoji
 *   or a placeholder).
 * - `uri`: a resolvable URL (`https://`, `data:`, `file://`) the UI
 *   passes to `<img>` (web) or `<Image source={{ uri }} />` (native).
 *   For SVGs the consumer wires `react-native-svg/SvgUri` on native.
 * - `emoji`: a unicode glyph the UI renders inside a `<Text>` /
 *   `<span>`. Cheap fallback for themes that ship no assets at all.
 */
export type FileIconRef =
  | { kind: 'none' }
  | { kind: 'uri'; uri: string }
  | { kind: 'emoji'; char: string };

/**
 * Raw shape of a VS Code marketplace `*-icon-theme.json`. The
 * format is a thicker spec than the color-theme one — VS Code uses
 * it to drive its file explorer, so it covers folder open/closed,
 * file extensions, exact file names, and language IDs.
 *
 * Reference: https://code.visualstudio.com/api/extension-guides/file-icon-theme
 *
 * We DON'T support every feature (notably: per-light-theme variants
 * and folder name expansion suffixes are dropped). Themes that lean
 * heavily on those features will still load — they'll just fall
 * back to the default file/folder icon for unmapped rules.
 */
export interface VSCodeIconTheme {
  iconDefinitions: Record<string, VSCodeIconDefinition>;
  file?: string;
  folder?: string;
  folderExpanded?: string;
  /** Map basename → icon-definition id. e.g. `package.json` → `_npm`. */
  fileNames?: Record<string, string>;
  /** Map lowercase extension → id. e.g. `js` → `_javascript`. */
  fileExtensions?: Record<string, string>;
  /**
   * Map Monaco/VS Code language id → icon-definition id.
   * Falls back to extension-based when the renderer doesn't know
   * the language yet (initial mount before Monaco loads).
   */
  languageIds?: Record<string, string>;
  /** Map folder name → id. Less common than file mappings. */
  folderNames?: Record<string, string>;
  folderNamesExpanded?: Record<string, string>;
  /** Light-mode overrides — we read `iconDefinitions` only (no
   * theme-aware switching yet). Round-tripped through but ignored. */
  light?: unknown;
  highContrast?: unknown;
}

export interface VSCodeIconDefinition {
  /**
   * Path relative to the icon-theme JSON. To render the icon, the
   * consumer must combine this with a `baseUrl` they supplied to
   * the parser (since marketplace themes ship the assets alongside
   * the JSON inside the .vsix archive).
   */
  iconPath?: string;
  /**
   * Font glyph variant — some themes use icon fonts (e.g.
   * vscode-icons uses font characters). We surface the unicode
   * character if the JSON includes one; otherwise we ignore the
   * font-id reference (font loading is out of scope).
   */
  fontCharacter?: string;
}

/**
 * Build a `FileIconResolver` from a VS Code marketplace icon-theme
 * JSON + the base URL where the theme's asset folder is hosted.
 *
 * `baseUrl` is whatever directory the theme's JSON lives in.
 * `iconPath` values in the JSON are joined relative to that URL.
 * For a typical marketplace extension unpacked to a CDN:
 *
 *   baseUrl = "https://cdn.example.com/material-icon-theme/dist/"
 *   iconPath in JSON = "./icons/javascript.svg"
 *   → resolved URI = "https://cdn.example.com/material-icon-theme/dist/icons/javascript.svg"
 *
 * The resolver also handles `data:` URIs inline (some themes inline
 * SVGs as base64 directly in `iconPath`), and falls back to the
 * theme's `_file` / `_folder` defaults for unmapped paths.
 */
export function buildIconResolver(
  raw: VSCodeIconTheme,
  baseUrl: string,
): FileIconResolver {
  const join = (rel: string): string => {
    if (!rel) return '';
    if (rel.startsWith('data:') || rel.startsWith('http://') || rel.startsWith('https://')) {
      return rel;
    }
    // Strip a leading "./" so URL constructor doesn't dedupe slashes weirdly.
    const cleaned = rel.startsWith('./') ? rel.slice(2) : rel;
    try {
      // `URL` is a JS-standard global — both Node and the browser
      // provide it. The lint config (which still uses the legacy
      // `script` env) doesn't know about it, hence the eslint
      // disable.
      // eslint-disable-next-line no-undef
      return new URL(cleaned, baseUrl).toString();
    } catch {
      // baseUrl wasn't an absolute URL — fall back to manual join.
      return baseUrl.replace(/\/$/, '') + '/' + cleaned.replace(/^\/+/, '');
    }
  };

  const resolveById = (id: string | undefined): FileIconRef => {
    if (!id) return { kind: 'none' };
    const def = raw.iconDefinitions[id];
    if (!def) return { kind: 'none' };
    if (def.iconPath) {
      const uri = join(def.iconPath);
      if (uri) return { kind: 'uri', uri };
    }
    if (def.fontCharacter) {
      return { kind: 'emoji', char: def.fontCharacter };
    }
    return { kind: 'none' };
  };

  return {
    forFile(filename, languageId) {
      // Resolution order matches VS Code: exact filename → language
      // id → extension → default. The first hit wins.
      const exact = raw.fileNames?.[filename] ?? raw.fileNames?.[filename.toLowerCase()];
      if (exact) return resolveById(exact);

      if (languageId) {
        const lang = raw.languageIds?.[languageId];
        if (lang) return resolveById(lang);
      }

      // Strip leading dots from `.gitignore` so the extension is
      // matched correctly (`gitignore` not `.gitignore`).
      const lastDot = filename.lastIndexOf('.');
      if (lastDot > 0) {
        const ext = filename.slice(lastDot + 1).toLowerCase();
        const byExt = raw.fileExtensions?.[ext];
        if (byExt) return resolveById(byExt);
      }

      return resolveById(raw.file);
    },

    forFolder(folderName, expanded) {
      const map = expanded ? raw.folderNamesExpanded : raw.folderNames;
      const exact = map?.[folderName] ?? map?.[folderName.toLowerCase()];
      if (exact) return resolveById(exact);
      return resolveById(expanded ? raw.folderExpanded : raw.folder);
    },
  };
}
