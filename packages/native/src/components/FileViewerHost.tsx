import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { detectLanguage } from '@codeam/ide-core';
import { useFileViewer } from './FileViewerContext';

/**
 * Build the HTML that hosts a Monaco editor inside a WebView. Monaco
 * loads from a CDN — that's the simplest cross-platform delivery
 * because bundling 5+ MB of editor sources into the RN bundle is
 * prohibitive on cold-start. Consumers who need offline operation can
 * later self-host the assets and override this loader via a prop.
 */
function buildEditorHtml(initialContent: string, language: string): string {
  const escaped = JSON.stringify(initialContent);
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
<script src="https://cdn.jsdelivr.net/npm/monaco-editor@0.52/min/vs/loader.js"></script>
<script>
  const post = (m) => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m));
  require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52/min/vs' } });
  require(['vs/editor/editor.main'], function () {
    try {
      const editor = monaco.editor.create(document.getElementById('editor'), {
        value: ${escaped},
        language: ${lang},
        theme: 'vs-dark',
        minimap: { enabled: false },
        automaticLayout: true,
        wordWrap: 'on',
        scrollBeyondLastLine: false,
        fontSize: 13,
        tabSize: 2,
        bracketPairColorization: { enabled: true },
        smoothScrolling: true,
      });
      window.__editor = editor;
      window.bridgeSetValue = (v) => editor.setValue(v);
      window.bridgeSetReadOnly = (ro) => editor.updateOptions({ readOnly: !!ro });
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

/**
 * Renders the file viewer modal when the {@link useFileViewer} context has
 * an active request. Mount it once near the root of any screen that may
 * trigger `open()`. Outside an active request it returns `null` and adds
 * no runtime cost.
 *
 * Connection / lifecycle notes:
 *   - The host depends on the `fetcher` identity from context being stable.
 *     The recommended pattern is for the consumer to module-memoise its
 *     fetcher factory by workspace id so re-renders don't allocate new
 *     adapter objects — otherwise the read-effect re-fires on every parent
 *     render and the file flickers.
 *   - On Android, the fullScreen Modal places its container at (0, 0)
 *     regardless of the status bar and the gesture-nav insets, so we apply
 *     `useSafeAreaInsets()` directly as paddingTop / paddingBottom to keep
 *     the header and footer out from under system UI.
 */
export function FileViewerHost() {
  const { request, fetcher, close } = useFileViewer();
  const insets = useSafeAreaInsets();
  const [content, setContent] = useState<string | null>(null);
  const [originalContent, setOriginalContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const webRef = useRef<WebView>(null);
  const webReadyRef = useRef(false);

  // Reset + fetch when a new request arrives.
  useEffect(() => {
    if (!request || !fetcher) return;
    setContent(null);
    setOriginalContent(null);
    setError(null);
    setSavedAt(null);
    setLoading(true);
    webReadyRef.current = false;
    let cancelled = false;
    fetcher
      .read(request.path)
      .then((result) => {
        if (cancelled) return;
        if (!result || result.error) {
          setError(
            result?.error ??
              'Could not read file. Make sure the IDE plugin / CLI is running and on a recent version.',
          );
          return;
        }
        const c = result.content ?? '';
        setContent(c);
        setOriginalContent(c);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Read failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [request, fetcher]);

  const language = useMemo(() => (request ? detectLanguage(request.path) : 'plaintext'), [request]);
  const html = useMemo(
    () => (content !== null ? buildEditorHtml(content, language) : null),
    // Build the WebView HTML once per file open — Monaco does its own DOM
    // diff for subsequent edits, no need to re-render the whole shell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [request?.path, language, content !== null],
  );

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data) as
        | { type: 'change'; value: string }
        | { type: 'save' }
        | { type: 'ready' }
        | { type: 'error'; value: string };
      if (msg.type === 'change') setContent(msg.value);
      else if (msg.type === 'save') void onSave();
      else if (msg.type === 'ready') webReadyRef.current = true;
      else if (msg.type === 'error') setError(msg.value);
    } catch {
      /* malformed bridge message — ignore */
    }
  };

  const dirty = content !== originalContent && originalContent !== null;
  const canSave = fetcher !== null && fetcher.canWrite && content !== null && dirty && !saving;

  const onSave = async () => {
    if (!fetcher || content === null || !request) return;
    setSaving(true);
    setError(null);
    try {
      const result = await fetcher.write(request.path, content);
      if (!result || result.error) {
        setError(result?.error ?? 'Save failed.');
        return;
      }
      setOriginalContent(content);
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!request) return null;

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.dotsRow}>
              <TouchableOpacity onPress={close} hitSlop={6}>
                <View style={[styles.dot, { backgroundColor: '#ff5f56' }]} />
              </TouchableOpacity>
              <View style={[styles.dot, { backgroundColor: '#ffbd2e' }]} />
              <View style={[styles.dot, { backgroundColor: '#27c93f' }]} />
            </View>
            <Text style={styles.fileName} numberOfLines={1}>
              {request.path}
            </Text>
            {dirty && <Text style={styles.dirty}>●</Text>}
          </View>
          <View style={styles.headerRight}>
            {savedAt && !dirty && <Text style={styles.savedHint}>Saved</Text>}
            <TouchableOpacity
              onPress={onSave}
              disabled={!canSave}
              style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator size={14} color="#fff" />
              ) : (
                <Ionicons name="save-outline" size={14} color={canSave ? '#fff' : '#8b8794'} />
              )}
              <Text style={[styles.saveText, !canSave && { color: '#8b8794' }]}>
                {saving ? 'Saving' : 'Save'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={close} hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}>
              <Ionicons name="close" size={22} color="#bcb6cc" />
            </TouchableOpacity>
          </View>
        </View>
        {error && (
          <View style={styles.errorBar}>
            <Text style={styles.errorText} numberOfLines={3}>
              {error}
            </Text>
          </View>
        )}
        <View style={styles.body}>
          {loading || html === null ? (
            <View style={styles.placeholder}>
              <ActivityIndicator size="small" color="#cbb7ff" />
              <Text style={styles.placeholderText}>Fetching {request.path}…</Text>
            </View>
          ) : !fetcher ? (
            <View style={styles.placeholder}>
              <Ionicons name="cloud-offline-outline" size={28} color="#8b8794" />
              <Text style={styles.placeholderText}>
                No active session. Pair an IDE plugin or CLI first.
              </Text>
            </View>
          ) : (
            <WebView
              ref={webRef}
              originWhitelist={['*']}
              source={{ html: html ?? '' }}
              style={styles.webview}
              javaScriptEnabled
              domStorageEnabled
              hideKeyboardAccessoryView
              keyboardDisplayRequiresUserAction={false}
              onMessage={onMessage}
              setSupportMultipleWindows={false}
              automaticallyAdjustContentInsets={false}
            />
          )}
        </View>
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {fetcher ? 'Connected · powered by Monaco' : 'Read-only'}
          </Text>
          <Text style={styles.footerText}>{language.toUpperCase()}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1f2433',
    backgroundColor: '#161b22',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dotsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  fileName: { color: '#e5e7eb', fontSize: 13, flexShrink: 1 },
  dirty: { color: '#fbbf24', fontSize: 18, marginLeft: 4 },
  savedHint: { color: '#34d399', fontSize: 11 },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#a78bfa',
  },
  saveBtnDisabled: { backgroundColor: '#2a2f3d' },
  saveText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  errorBar: {
    backgroundColor: 'rgba(239,68,68,0.18)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(239,68,68,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorText: { color: '#fecaca', fontSize: 11 },
  body: { flex: 1 },
  webview: { flex: 1, backgroundColor: '#0d1117' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  placeholderText: { color: '#bcb6cc', fontSize: 12 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#161b22',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1f2433',
  },
  footerText: { color: '#8b8794', fontSize: 11 },
});
