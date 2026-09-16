import type { EditorSettingsSnapshot } from '../types/settings';
import type { MonacoTheme } from '../types/theme';
import { MONACO_CDN_BASE } from './index';

export interface BuildEditorHtmlOptions {
  /** File content to load into the editor. */
  initialContent: string;
  /** Monaco language ID (e.g. "typescript", "python"). */
  language: string;
  /** Editor settings snapshot. */
  settings?: Partial<EditorSettingsSnapshot>;
  /** When true, the editor is read-only. */
  readOnly?: boolean;
  /** Bundled custom themes to register before editor instantiation. */
  bundledThemes?: ReadonlyArray<Pick<MonacoTheme, 'name' | 'base' | 'inherit' | 'rules' | 'colors'>>;
}

const DEFAULT_SETTINGS: EditorSettingsSnapshot = {
  theme: 'vs-dark',
  fontSize: 13,
  tabSize: 2,
  wordWrap: true,
  minimap: false,
  lineNumbers: true,
};

/**
 * Build the HTML that hosts a Monaco editor inside a WebView. Monaco
 * loads from a CDN — that's the simplest cross-platform delivery
 * because bundling 5+ MB of editor sources into the RN bundle is
 * prohibitive on cold-start. Consumers who need offline operation can
 * later self-host the assets and override this loader via a prop.
 */
export function buildEditorHtml(options: BuildEditorHtmlOptions): string {
  const { initialContent, language, readOnly = false } = options;
  const settings = { ...DEFAULT_SETTINGS, ...options.settings };
  const bundledThemes = options.bundledThemes ?? [];

  const value = JSON.stringify(initialContent);
  const lang = JSON.stringify(language);

  // Inline the bundled custom themes (github-dark, github-light)
  // into the page so `monaco.editor.setTheme(name)` resolves them
  // without a follow-up bridge call. User-imported themes arrive
  // later via the `bridgeRegisterCustomThemes` path.
  const bundledJson = JSON.stringify(
    bundledThemes.map((t) => ({
      name: t.name,
      base: t.base,
      inherit: t.inherit,
      rules: t.rules,
      colors: t.colors,
    })),
  );

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  html, body, #editor { margin:0; padding:0; height:100%; background:#0d1117; }
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
</style>
</head>
<body>
<div id="editor"></div>
<script src="${MONACO_CDN_BASE}/loader.js"></script>
<script>
  const post = (m) => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m));
  require.config({ paths: { vs: '${MONACO_CDN_BASE}' } });
  require(['vs/editor/editor.main'], function () {
    try {
      const BUNDLED = ${bundledJson};
      for (const t of BUNDLED) {
        try {
          monaco.editor.defineTheme(t.name, {
            base: t.base, inherit: t.inherit, rules: t.rules, colors: t.colors,
          });
        } catch (e) { /* malformed bundled theme — should be unreachable */ }
      }
      const editor = monaco.editor.create(document.getElementById('editor'), {
        value: ${value},
        language: ${lang},
        theme: ${JSON.stringify(settings.theme)},
        minimap: { enabled: ${settings.minimap ? 'true' : 'false'} },
        automaticLayout: true,
        wordWrap: ${settings.wordWrap ? "'on'" : "'off'"},
        scrollBeyondLastLine: false,
        fontSize: ${settings.fontSize},
        tabSize: ${settings.tabSize},
        lineNumbers: ${settings.lineNumbers ? "'on'" : "'off'"},
        bracketPairColorization: { enabled: true },
        smoothScrolling: true,
        readOnly: ${readOnly ? 'true' : 'false'},
      });
      window.__editor = editor;
      window.bridgeSetValue = (v) => editor.setValue(v);
      window.bridgeSetReadOnly = (ro) => editor.updateOptions({ readOnly: !!ro });
      window.bridgeSetOptions = (o) => {
        try { editor.updateOptions(o); } catch (e) {}
        if (o && o.theme) monaco.editor.setTheme(o.theme);
      };
      window.bridgeRegisterCustomThemes = (themes) => {
        if (!Array.isArray(themes)) return;
        for (const t of themes) {
          if (!t || typeof t.name !== 'string') continue;
          try {
            monaco.editor.defineTheme(t.name, {
              base: t.base, inherit: t.inherit, rules: t.rules, colors: t.colors,
            });
          } catch (e) { /* skip — malformed theme */ }
        }
      };
      editor.onDidChangeModelContent(() => {
        post({ type: 'change', value: editor.getValue() });
      });
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => post({ type: 'save' }));
      post({ type: 'ready' });
    } catch (e) {
      post({ type: 'error', value: String((e && e.message) || e) });
    }
  });
</script>
</body>
</html>`;
}
