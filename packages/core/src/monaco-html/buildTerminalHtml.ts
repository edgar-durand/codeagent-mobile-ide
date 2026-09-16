export interface BuildTerminalHtmlOptions {
  rows?: number;
  cols?: number;
}

/**
 * Build the HTML hosting xterm.js inside a WebView. Loaded from
 * jsDelivr at runtime — same delivery story as Monaco.
 */
export function buildTerminalHtml(options: BuildTerminalHtmlOptions = {}): string {
  const { rows = 24, cols = 80 } = options;
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/css/xterm.min.css" />
<style>
  html, body { margin:0; padding:0; height:100%; background:#0d1117; overflow:hidden; }
  #term { position:absolute; inset:0; padding:4px; }
</style>
</head>
<body>
<div id="term"></div>
<script src="https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/lib/xterm.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.10.0/lib/addon-fit.js"></script>
<script>
  const post = (m) => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m));
  const term = new window.Terminal({
    cursorBlink: true,
    cursorStyle: 'block',
    fontFamily: 'Menlo, Monaco, monospace',
    fontSize: 13,
    rows: ${rows},
    cols: ${cols},
    theme: {
      background: '#0d1117',
      foreground: '#e5e7eb',
      cursor: '#a78bfa',
      red: '#fb7185', green: '#34d399', yellow: '#fbbf24',
      blue: '#60a5fa', magenta: '#a78bfa', cyan: '#22d3ee', white: '#e5e7eb',
    },
    scrollback: 5000,
  });
  const fit = new window.FitAddon.FitAddon();
  term.loadAddon(fit);
  term.open(document.getElementById('term'));
  try { fit.fit(); } catch (e) {}
  window.__bridgeWrite = (s) => { try { term.write(s); } catch (e) {} };
  window.__bridgeFit = () => {
    try {
      fit.fit();
      post({ type: 'resize', cols: term.cols, rows: term.rows });
    } catch (e) {}
  };
  term.onData((data) => post({ type: 'data', data }));
  window.addEventListener('resize', () => window.__bridgeFit());
  setTimeout(() => window.__bridgeFit(), 100);
  post({ type: 'ready', cols: term.cols, rows: term.rows });
</script>
</body>
</html>`;
}
