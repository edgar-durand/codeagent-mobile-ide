import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { TerminalProvider, TerminalSession } from '@codeam/ide-core';

interface Props {
  provider: TerminalProvider;
  cwd?: string;
  rows?: number;
  cols?: number;
  title?: string;
}

/**
 * Build the HTML hosting xterm.js inside a WebView. Loaded from
 * jsDelivr at runtime — same delivery story as Monaco in the
 * FileViewerHost / InlineEditor. Keeps the npm tarball lean and
 * lets the user's network handle the cold-start.
 */
function buildHtml(rows: number, cols: number): string {
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
  // Initial resize after layout settles.
  setTimeout(() => window.__bridgeFit(), 100);
  post({ type: 'ready', cols: term.cols, rows: term.rows });
</script>
</body>
</html>`;
}

/**
 * React Native terminal panel — xterm.js rendered inside a
 * WebView, same delivery pattern as Monaco for the file editor.
 * Wire shape matches the web TerminalPanel so consumers swap
 * imports without touching call sites.
 *
 * Keyboard input flows: WebView's hidden input → xterm.onData →
 * postMessage → provider.write. Provider data events flow back the
 * other way via `injectJavaScript`. Resizes happen on layout
 * change inside the WebView and are reflected to the PTY via
 * `provider.resize`.
 */
export function TerminalPanel({ provider, cwd, rows = 24, cols = 80, title }: Props) {
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const webRef = useRef<WebView | null>(null);
  const sessionRef = useRef<TerminalSession | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const providerRef = useRef(provider);
  providerRef.current = provider;

  const html = useMemo(() => buildHtml(rows, cols), [rows, cols]);

  // Open session once the WebView's xterm reports ready.
  const openSession = async (initialCols: number, initialRows: number) => {
    try {
      const s = await providerRef.current.open({ cols: initialCols, rows: initialRows, cwd });
      sessionRef.current = s;
      unsubRef.current = providerRef.current.subscribe(s, (ev) => {
        if (ev.type === 'data' && typeof ev.data === 'string') {
          const escaped = JSON.stringify(ev.data);
          webRef.current?.injectJavaScript(`window.__bridgeWrite(${escaped}); true;`);
        } else if (ev.type === 'exit') {
          setExitCode(ev.exitCode ?? 0);
        }
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const escaped = JSON.stringify(`\r\n\x1b[31mTerminal error: ${msg}\x1b[0m\r\n`);
      webRef.current?.injectJavaScript(`window.__bridgeWrite(${escaped}); true;`);
      setExitCode(-1);
    }
  };

  useEffect(
    () => () => {
      if (unsubRef.current) unsubRef.current();
      const s = sessionRef.current;
      if (s) void providerRef.current.close(s);
      sessionRef.current = null;
      unsubRef.current = null;
    },
    [],
  );

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'ready') {
        setReady(true);
        void openSession(msg.cols ?? cols, msg.rows ?? rows);
      } else if (msg.type === 'data' && typeof msg.data === 'string') {
        const s = sessionRef.current;
        if (s) void providerRef.current.write(s, msg.data);
      } else if (msg.type === 'resize') {
        const s = sessionRef.current;
        if (s && typeof msg.cols === 'number' && typeof msg.rows === 'number') {
          void providerRef.current.resize(s, msg.cols, msg.rows);
        }
      }
    } catch {
      /* malformed bridge message — ignore */
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>Terminal</Text>
        {title ? <Text style={styles.headerTitle}>{title}</Text> : null}
        <View style={styles.headerSpacer} />
        {exitCode !== null ? (
          <View
            style={[
              styles.statusBadge,
              exitCode === 0 ? styles.statusBadgeOk : styles.statusBadgeErr,
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                exitCode === 0 ? styles.statusBadgeTextOk : styles.statusBadgeTextErr,
              ]}
            >
              exit {exitCode}
            </Text>
          </View>
        ) : (
          <Text style={styles.runningText}>{ready ? 'running' : 'starting…'}</Text>
        )}
      </View>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        hideKeyboardAccessoryView
        keyboardDisplayRequiresUserAction={false}
        onMessage={onMessage}
        setSupportMultipleWindows={false}
        automaticallyAdjustContentInsets={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#161b22',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1f2433',
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#9ca3af',
  },
  headerTitle: { fontSize: 11, color: '#6b7280', fontFamily: 'Menlo' },
  headerSpacer: { flex: 1 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, borderWidth: 1 },
  statusBadgeOk: { borderColor: 'rgba(16,185,129,0.4)', backgroundColor: 'rgba(16,185,129,0.1)' },
  statusBadgeErr: { borderColor: 'rgba(244,63,94,0.4)', backgroundColor: 'rgba(244,63,94,0.1)' },
  statusBadgeText: { fontSize: 10, fontFamily: 'Menlo' },
  statusBadgeTextOk: { color: '#a7f3d0' },
  statusBadgeTextErr: { color: '#fecaca' },
  runningText: { fontSize: 10, color: '#6b7280', fontFamily: 'Menlo' },
  webview: { flex: 1, backgroundColor: '#0d1117' },
});
