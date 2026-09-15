import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { WebView, WebViewMessageEvent } from 'react-native-webview';
import { ResilientWebView } from './ResilientWebView';
import type { TerminalProvider, TerminalSession } from '@codeam/ide-core';
import { useIDETheme } from '../theme';

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
  const [webGeneration, setWebGeneration] = useState(0);
  const [readyGeneration, setReadyGeneration] = useState<number | null>(null);
  const [status, setStatus] = useState<'starting' | 'connecting' | 'running' | 'error'>('starting');
  const [error, setError] = useState<string | null>(null);
  const theme = useIDETheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const webRef = useRef<WebView | null>(null);
  const sessionRef = useRef<TerminalSession | null>(null);
  const sessionProviderRef = useRef<TerminalProvider | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const lifecycleRef = useRef(0);
  const mountedRef = useRef(true);
  const dimensionsRef = useRef({ cols, rows });

  const html = useMemo(() => buildHtml(rows, cols), [rows, cols]);

  const reportError = useCallback((operation: string, cause: unknown) => {
    if (!mountedRef.current) return;
    const detail = cause instanceof Error ? cause.message : String(cause);
    setError(`${operation}: ${detail}`);
    setStatus('error');
  }, []);

  const disconnect = useCallback(
    async (reportCloseError: boolean) => {
      const session = sessionRef.current;
      const owner = sessionProviderRef.current;
      sessionRef.current = null;
      sessionProviderRef.current = null;
      const unsubscribe = unsubRef.current;
      unsubRef.current = null;
      try {
        unsubscribe?.();
      } catch (cause) {
        if (reportCloseError) reportError('Could not detach terminal', cause);
        else console.warn('Could not detach terminal session', cause);
      }
      if (session && owner) {
        try {
          await owner.close(session);
        } catch (cause) {
          if (reportCloseError) reportError('Could not close terminal', cause);
          else console.warn('Could not close terminal session', cause);
        }
      }
    },
    [reportError],
  );

  // Every connection owns a generation. Late opens and events are disposed
  // instead of being allowed to replace the current provider's session.
  const connect = useCallback(async () => {
    const generation = ++lifecycleRef.current;
    setError(null);
    setExitCode(null);
    setStatus('connecting');
    await disconnect(true);
    if (!mountedRef.current || generation !== lifecycleRef.current) return;

    const dimensions = dimensionsRef.current;
    let session: TerminalSession;
    try {
      session = await provider.open({ ...dimensions, cwd });
    } catch (cause) {
      if (generation === lifecycleRef.current) reportError('Could not open terminal', cause);
      return;
    }

    if (!mountedRef.current || generation !== lifecycleRef.current) {
      try {
        await provider.close(session);
      } catch (cause) {
        console.warn('Could not close stale terminal session', cause);
      }
      return;
    }

    sessionRef.current = session;
    sessionProviderRef.current = provider;
    try {
      unsubRef.current = provider.subscribe(session, (ev) => {
        if (generation !== lifecycleRef.current) return;
        if (ev.type === 'data' && typeof ev.data === 'string') {
          const escaped = JSON.stringify(ev.data);
          webRef.current?.injectJavaScript(`window.__bridgeWrite(${escaped}); true;`);
        } else if (ev.type === 'exit') {
          setExitCode(ev.exitCode ?? 0);
        }
      });
    } catch (cause) {
      reportError('Could not subscribe to terminal', cause);
      await disconnect(false);
      return;
    }
    setStatus('running');
  }, [cwd, disconnect, provider, reportError]);

  useEffect(() => {
    if (readyGeneration === webGeneration) void connect();
  }, [connect, readyGeneration, webGeneration]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      lifecycleRef.current += 1;
      void disconnect(false);
    };
  }, [disconnect]);

  const runForCurrentSession = useCallback(
    async (
      operation: 'write' | 'resize',
      invoke: (owner: TerminalProvider, session: TerminalSession) => Promise<void>,
    ) => {
      const session = sessionRef.current;
      const owner = sessionProviderRef.current;
      const generation = lifecycleRef.current;
      if (!session || !owner) return;
      try {
        await invoke(owner, session);
      } catch (cause) {
        if (generation === lifecycleRef.current) reportError(`Terminal ${operation} failed`, cause);
      }
    },
    [reportError],
  );

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'ready') {
        dimensionsRef.current = { cols: msg.cols ?? cols, rows: msg.rows ?? rows };
        setReadyGeneration(webGeneration);
      } else if (msg.type === 'data' && typeof msg.data === 'string') {
        void runForCurrentSession('write', (owner, session) => owner.write(session, msg.data));
      } else if (msg.type === 'resize') {
        if (typeof msg.cols === 'number' && typeof msg.rows === 'number') {
          dimensionsRef.current = { cols: msg.cols, rows: msg.rows };
          void runForCurrentSession('resize', (owner, session) =>
            owner.resize(session, msg.cols, msg.rows),
          );
        }
      }
    } catch {
      /* malformed bridge message — ignore */
    }
  };

  const onGenerationChange = useCallback(
    (generation: number) => {
      setWebGeneration(generation);
      setReadyGeneration(null);
      setStatus('starting');
      lifecycleRef.current += 1;
      void disconnect(true);
    },
    [disconnect],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>Terminal</Text>
        {title ? <Text style={styles.headerTitle}>{title}</Text> : null}
        <View style={styles.headerSpacer} />
        {error ? (
          <TouchableOpacity
            onPress={() => void connect()}
            style={styles.reconnectButton}
            accessibilityRole="button"
            accessibilityLabel="Reconnect terminal"
            accessibilityHint={error}
            testID="terminal-reconnect"
          >
            <Text style={styles.errorText}>Reconnect</Text>
          </TouchableOpacity>
        ) : exitCode !== null ? (
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
          <Text style={styles.runningText} accessibilityLiveRegion="polite">
            {status === 'running' ? 'running' : `${status}…`}
          </Text>
        )}
      </View>
      {error ? (
        <View style={styles.errorBanner} accessibilityRole="alert" testID="terminal-error">
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      <ResilientWebView
        surfaceLabel="terminal"
        loadingLabel="Starting terminal…"
        testID="terminal-surface"
        webViewRef={webRef}
        waitForBridgeReady
        bridgeReadyGeneration={readyGeneration ?? undefined}
        onGenerationChange={onGenerationChange}
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

function createStyles(theme: ReturnType<typeof useIDETheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.surface },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: theme.colors.surfaceRaised,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    headerLabel: {
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      color: theme.colors.textMuted,
    },
    headerTitle: {
      fontSize: theme.typography.detailSize,
      color: theme.colors.textSubtle,
      fontFamily: theme.typography.monoFamily,
    },
    headerSpacer: { flex: 1 },
    statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, borderWidth: 1 },
    statusBadgeOk: { borderColor: 'rgba(16,185,129,0.4)', backgroundColor: 'rgba(16,185,129,0.1)' },
    statusBadgeErr: { borderColor: 'rgba(244,63,94,0.4)', backgroundColor: 'rgba(244,63,94,0.1)' },
    statusBadgeText: { fontSize: 10, fontFamily: theme.typography.monoFamily },
    statusBadgeTextOk: { color: '#a7f3d0' },
    statusBadgeTextErr: { color: '#fecaca' },
    runningText: {
      fontSize: 10,
      color: theme.colors.textSubtle,
      fontFamily: theme.typography.monoFamily,
    },
    reconnectButton: {
      minHeight: theme.minimumTouchSize,
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.sm,
    },
    errorBanner: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: 'rgba(248,113,113,0.12)',
    },
    errorText: { color: theme.colors.danger, fontSize: theme.typography.detailSize },
    webview: { flex: 1, backgroundColor: theme.colors.surface },
  });
}
