import { MONACO_CDN_BASE } from './index';

export interface BuildDiffHtmlOptions {
  /** Original (left side) content. */
  original: string;
  /** Modified (right side) content. */
  modified: string;
  /** Monaco language ID. */
  language: string;
}

/**
 * Build the HTML that hosts Monaco's DiffEditor inside a WebView.
 */
export function buildDiffHtml(options: BuildDiffHtmlOptions): string {
  const { original, modified, language } = options;
  const o = JSON.stringify(original);
  const m = JSON.stringify(modified);
  const lang = JSON.stringify(language);
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
  require.config({ paths: { vs: '${MONACO_CDN_BASE}' } });
  require(['vs/editor/editor.main'], function () {
    const originalModel = monaco.editor.createModel(${o}, ${lang});
    const modifiedModel = monaco.editor.createModel(${m}, ${lang});
    const diffEditor = monaco.editor.createDiffEditor(document.getElementById('editor'), {
      theme: 'vs-dark',
      automaticLayout: true,
      readOnly: true,
      renderSideBySide: true,
      minimap: { enabled: false },
      wordWrap: 'on',
      fontSize: 12,
      scrollBeyondLastLine: false,
    });
    diffEditor.setModel({ original: originalModel, modified: modifiedModel });
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
  });
</script>
</body>
</html>`;
}
