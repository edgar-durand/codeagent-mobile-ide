import { useCallback, useEffect, useMemo, useRef, useState, type Ref } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView, type WebViewProps } from 'react-native-webview';

/**
 * A `WebView` that is never allowed to fail silently.
 *
 * ─── Why this exists ──────────────────────────────────────────────────
 *
 * Every content surface in this package is Monaco (or xterm) inside a
 * `react-native-webview`. Until 2026-09-15 all four of them —
 * `FileViewerHost`, `DiffViewer`, `InlineEditor`, `TerminalPanel` — mounted
 * a bare `<WebView source={{html}}>` with `onMessage` and **not one error
 * prop between them**: no `onError`, no `onHttpError`, no `renderError`, no
 * `onRenderProcessGone`, no `onContentProcessDidTerminate`, not even
 * `onLoadStart`/`onLoadEnd`.
 *
 * A WebView that dies renders as an empty rectangle. On this library's dark
 * theme that is a BLACK VOID with no message, no spinner and no way out, and
 * the native chrome around it (tabs, breadcrumbs, panels) keeps updating as
 * if nothing happened — so the app looks alive and the content looks dead.
 *
 * Seen in production (ksawdob44, Android 4.0.1, replay
 * 01a0a134-e10b-78b0-b8fd-da437b9d267a, 2026-09-14 18:46–18:57Z): the Source
 * Control panel said `CHANGES 3` over a black rectangle, and the editor
 * showed the tab `check-env.sh` while its breadcrumb said
 * `.beads/config.yaml` — 21 `friction.dead_tap` bursts as the user tapped
 * everywhere trying to make it do something, then left.
 *
 * ⚠️ This is the SECOND time this exact failure shipped. The in-app Preview
 * had it (`PreviewWebView.silentBlack`, 2026-08-30) and was fixed there —
 * the lesson never reached this package. Hence one shared primitive rather
 * than four call-site patches: the next WebView added here inherits it.
 *
 * ─── What it guarantees ───────────────────────────────────────────────
 *
 *  1. **Something is always on screen.** A spinner while loading, the content
 *     when it lives, an explicit error card when it dies. Never a bare void.
 *  2. **A dead renderer recovers itself, once.** Android reclaims WebView
 *     renderer processes under memory pressure (`onRenderProcessGone`) and
 *     iOS does the same (`onContentProcessDidTerminate`); that is transient
 *     and a silent remount is the right answer. The SECOND death in a row is
 *     not transient, so it surfaces instead of flapping forever.
 *  3. **Retry actually remounts.** Recovery bumps a key, so the WebView is
 *     rebuilt from scratch rather than asked to reload a dead process.
 *
 * `onReady` is optional: surfaces whose HTML posts its own ready message can
 * clear the spinner precisely; the rest fall back to `onLoadEnd`.
 */
export interface ResilientWebViewProps extends WebViewProps {
  /** Shown under the spinner while the surface boots. */
  loadingLabel?: string;
  /** Names the surface in the error card ("file", "diff", "terminal"…). */
  surfaceLabel?: string;
  /** Reported once per distinct failure — wire it to your telemetry. */
  onSurfaceError?: (info: { reason: string; detail?: string; recovered: boolean }) => void;
  /**
   * Ref to the inner WebView, for `injectJavaScript`.
   *
   * A named prop rather than `forwardRef`: callers keep their own ref and
   * the wrapper stays a plain function component. It also reads correctly
   * at the call site — `ref` on a wrapper is ambiguous about WHICH node you
   * get, and here you always want the WebView, never the error overlay.
   *
   * ⚠️ It goes null while the surface is in its error state (the WebView is
   * unmounted). Callers that inject must null-check — `?.` is enough.
   */
  webViewRef?: Ref<WebView>;
  testID?: string;
}

type Phase = 'loading' | 'ok' | 'error';

/** How many times a killed renderer is silently rebuilt before we surface it. */
const SILENT_RECOVERY_LIMIT = 1;

/**
 * How long a surface may stay blank before we call it broken.
 *
 * ⚠️ Load-bearing. Without it the first version of this component traded one
 * silent failure for another: a WebView that never reports `onLoadEnd` (the
 * HTML threw before `DOMContentLoaded`, the renderer hung, the bridge never
 * came up) would sit under a spinner FOREVER, which tells the user exactly as
 * little as the black rectangle did. A surface that cannot prove it loaded is
 * a surface that failed. Generous enough for a cold Monaco boot on a low-end
 * device, short enough that nobody stares at it.
 */
const LOAD_TIMEOUT_MS = 12_000;

export function ResilientWebView({
  loadingLabel,
  surfaceLabel = 'view',
  onSurfaceError,
  onLoadEnd,
  onError,
  onHttpError,
  webViewRef,
  testID,
  ...webViewProps
}: ResilientWebViewProps) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [detail, setDetail] = useState<string | undefined>(undefined);
  // Remounting is the only reliable recovery: a renderer process that died
  // cannot be told to reload itself.
  const [mountKey, setMountKey] = useState(0);
  const silentRecoveries = useRef(0);

  const fail = useCallback(
    (reason: string, nextDetail?: string) => {
      const recoverable = silentRecoveries.current < SILENT_RECOVERY_LIMIT;
      onSurfaceError?.({ reason, detail: nextDetail, recovered: recoverable });
      if (recoverable) {
        silentRecoveries.current += 1;
        setPhase('loading');
        setMountKey((k) => k + 1);
        return;
      }
      setDetail(nextDetail);
      setPhase('error');
    },
    [onSurfaceError],
  );

  // The watchdog. Armed on every mount and every remount (`mountKey`), and
  // disarmed the moment the surface reports it loaded.
  useEffect(() => {
    if (phase !== 'loading') return;
    const timer = setTimeout(() => fail('load-timeout', 'It never finished loading.'), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [phase, mountKey, fail]);

  const retry = useCallback(() => {
    // An explicit tap is a fresh budget — the user is telling us the
    // conditions may have changed (memory freed, network back).
    silentRecoveries.current = 0;
    setDetail(undefined);
    setPhase('loading');
    setMountKey((k) => k + 1);
  }, []);

  const handlers = useMemo(
    () => ({
      onLoadEnd: (e: Parameters<NonNullable<WebViewProps['onLoadEnd']>>[0]) => {
        setPhase((p) => (p === 'error' ? p : 'ok'));
        onLoadEnd?.(e);
      },
      onError: (e: Parameters<NonNullable<WebViewProps['onError']>>[0]) => {
        fail('load-error', e?.nativeEvent?.description);
        onError?.(e);
      },
      onHttpError: (e: Parameters<NonNullable<WebViewProps['onHttpError']>>[0]) => {
        fail('http-error', `HTTP ${e?.nativeEvent?.statusCode ?? '?'}`);
        onHttpError?.(e);
      },
      // Android. Returning `true` tells the platform we handled it, which is
      // what stops the whole RN process from being torn down with the view.
      onRenderProcessGone: () => {
        fail('renderer-gone', 'The system reclaimed this view.');
        return true;
      },
      // iOS equivalent.
      onContentProcessDidTerminate: () => {
        fail('renderer-gone', 'The system reclaimed this view.');
      },
    }),
    [fail, onLoadEnd, onError, onHttpError],
  );

  return (
    <View style={styles.fill} testID={testID}>
      {phase !== 'error' ? (
        <WebView
          {...webViewProps}
          ref={webViewRef}
          key={mountKey}
          {...handlers}
          style={[styles.fill, webViewProps.style]}
        />
      ) : null}

      {phase === 'loading' ? (
        <View style={styles.overlay} testID={testID ? `${testID}-loading` : undefined}>
          <ActivityIndicator size="small" color="#cbb7ff" />
          {loadingLabel ? <Text style={styles.text}>{loadingLabel}</Text> : null}
        </View>
      ) : null}

      {phase === 'error' ? (
        <View style={styles.overlay} testID={testID ? `${testID}-error` : undefined}>
          <Ionicons name="alert-circle-outline" size={28} color="#f87171" />
          {/* Say what broke and that it is recoverable. The old behaviour —
              a black rectangle — made users think their FILE was broken. */}
          <Text style={styles.text}>{`This ${surfaceLabel} stopped responding.`}</Text>
          {detail ? <Text style={styles.detail}>{detail}</Text> : null}
          <TouchableOpacity
            onPress={retry}
            style={styles.retryBtn}
            activeOpacity={0.8}
            testID={testID ? `${testID}-retry` : undefined}
          >
            <Ionicons name="refresh-outline" size={14} color="#fff" />
            <Text style={styles.retryText}>Reload</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
    backgroundColor: '#0d1117',
  },
  text: { color: '#cbc3d7', fontSize: 13, textAlign: 'center' },
  detail: { color: '#8b8699', fontSize: 11, textAlign: 'center' },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#7c5cff',
  },
  retryText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
