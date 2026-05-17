import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import {
  DEFAULT_EDITOR_SETTINGS,
  detectLanguage,
  type EditorSettingsSnapshot,
  type FileFetcher,
  type SettingsStore,
} from '@codeam/ide-core';

interface Props {
  fetcher: FileFetcher | null;
  path: string | null;
  /** Optional settings store. When supplied, font size / theme /
   * tab size / wrap / minimap / line numbers come from here and
   * update live via watch. */
  settingsStore?: SettingsStore | null;
  /** Shared buffer cache so multiple InlineEditors (or tabs) keep
   * dirty state across mounts. */
  buffers: Record<string, string>;
  setBuffers: (next: (prev: Record<string, string>) => Record<string, string>) => void;
  saved: Record<string, string>;
  setSaved: (next: (prev: Record<string, string>) => Record<string, string>) => void;
  onClose?: () => void;
  /** Fires after a successful write. Consumers typically use this
   * to refresh the SourceControl status (so the just-saved file
   * appears in the changes list without a manual refresh). */
  onAfterSave?: (path: string) => void;
}

function buildEditorHtml(initial: string, language: string, settings: EditorSettingsSnapshot) {
  const value = JSON.stringify(initial);
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
      });
      window.__editor = editor;
      window.bridgeSetValue = (v) => editor.setValue(v);
      window.bridgeSetOptions = (o) => {
        try { editor.updateOptions(o); } catch (e) {}
        if (o && o.theme) monaco.editor.setTheme(o.theme);
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

function isSnapshot(v: unknown): v is Partial<EditorSettingsSnapshot> {
  return typeof v === 'object' && v !== null;
}

/**
 * Inline editor for native — the same WebView + Monaco bridge as
 * `FileViewerHost` but without the surrounding Modal. Designed to
 * live as a flex child inside `IDEShell`'s main area.
 */
export function InlineEditor({
  fetcher,
  path,
  settingsStore,
  buffers,
  setBuffers,
  saved,
  setSaved,
  onClose,
  onAfterSave,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState<number | null>(null);
  const [settings, setSettings] = useState<EditorSettingsSnapshot>(DEFAULT_EDITOR_SETTINGS);
  const webRef = useRef<WebView>(null);
  const webReadyRef = useRef(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // Pull settings from the store and watch for changes.
  useEffect(() => {
    if (!settingsStore) return;
    let active = true;
    void settingsStore.get('editor').then((v) => {
      if (!active) return;
      if (isSnapshot(v)) setSettings({ ...DEFAULT_EDITOR_SETTINGS, ...v });
    });
    const off = settingsStore.watch((key, value) => {
      if (key !== 'editor') return;
      if (isSnapshot(value)) setSettings({ ...DEFAULT_EDITOR_SETTINGS, ...value });
    });
    return () => {
      active = false;
      off();
    };
  }, [settingsStore]);

  // Push live settings into the Monaco instance without a full
  // reload (only the editor options need to change).
  useEffect(() => {
    if (!webReadyRef.current || !webRef.current) return;
    const o = {
      theme: settings.theme,
      fontSize: settings.fontSize,
      tabSize: settings.tabSize,
      wordWrap: settings.wordWrap ? 'on' : 'off',
      minimap: { enabled: settings.minimap },
      lineNumbers: settings.lineNumbers ? 'on' : 'off',
    };
    webRef.current.injectJavaScript(
      `try { window.bridgeSetOptions(${JSON.stringify(o)}); } catch(e) {} true;`,
    );
  }, [settings]);

  // Lazy-load file content on first open.
  useEffect(() => {
    if (!path || !fetcherRef.current) return;
    if (buffers[path] !== undefined) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    webReadyRef.current = false;
    fetcherRef.current
      .read(path)
      .then((r) => {
        if (cancelled) return;
        if (!r || r.error) {
          setError(r?.error ?? 'Could not read file.');
          return;
        }
        const content = r.content ?? '';
        setBuffers((prev) => ({ ...prev, [path]: content }));
        setSaved((prev) => ({ ...prev, [path]: content }));
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Read failed.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path, buffers, setBuffers, setSaved]);

  const language = useMemo(() => (path ? detectLanguage(path) : 'plaintext'), [path]);
  const content = path ? buffers[path] : undefined;
  const original = path ? saved[path] : undefined;
  const dirty =
    path !== null && content !== undefined && original !== undefined && content !== original;
  const canSave =
    path !== null &&
    fetcher !== null &&
    fetcher.canWrite &&
    content !== undefined &&
    dirty &&
    !saving;

  // Build the WebView HTML once per file open — the bridge mutates
  // the buffer afterwards so we don't reload Monaco on every keystroke.
  const html = useMemo(
    () => (content !== undefined ? buildEditorHtml(content, language, settings) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path, language, content !== undefined],
  );

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'change' && path) {
        setBuffers((prev) => ({ ...prev, [path]: typeof msg.value === 'string' ? msg.value : '' }));
      } else if (msg.type === 'save') {
        void onSave();
      } else if (msg.type === 'ready') {
        webReadyRef.current = true;
      } else if (msg.type === 'error') {
        setError(typeof msg.value === 'string' ? msg.value : 'Editor error');
      }
    } catch {
      /* ignore */
    }
  };

  const onSave = async () => {
    if (!path || !fetcher || content === undefined) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetcher.write(path, content);
      if (!r || r.error) {
        setError(r?.error ?? 'Save failed.');
        return;
      }
      setSaved((prev) => ({ ...prev, [path]: content }));
      setSavedFlash(Date.now());
      setTimeout(() => setSavedFlash(null), 2500);
      onAfterSave?.(path);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  if (!path) {
    return (
      <View style={styles.placeholder}>
        <Ionicons name="folder-outline" size={28} color="#6b7280" />
        <Text style={styles.placeholderTitle}>No file open</Text>
        <Text style={styles.placeholderText}>
          Pick a file from the explorer to start editing.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.statusBar}>
        <Text style={styles.pathText} numberOfLines={1}>
          {path}
        </Text>
        <View style={styles.statusActions}>
          {savedFlash !== null && !dirty ? (
            <Text style={styles.savedHint}>Saved</Text>
          ) : null}
          <Pressable
            onPress={onSave}
            disabled={!canSave}
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
          >
            <Ionicons name="save-outline" size={13} color="#fff" />
            <Text style={styles.saveBtnText}>{saving ? 'Saving' : 'Save'}</Text>
          </Pressable>
          {onClose ? (
            <Pressable onPress={onClose} hitSlop={6}>
              <Ionicons name="close" size={18} color="#9ca3af" />
            </Pressable>
          ) : null}
        </View>
      </View>
      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText} numberOfLines={2}>
            {error}
          </Text>
        </View>
      ) : null}
      <View style={styles.body}>
        {loading || html === null ? (
          <View style={styles.loading}>
            <ActivityIndicator size="small" color="#a78bfa" />
            <Text style={styles.loadingText}>Fetching {path}…</Text>
          </View>
        ) : !fetcher ? (
          <View style={styles.placeholder}>
            <Ionicons name="cloud-offline-outline" size={26} color="#6b7280" />
            <Text style={styles.placeholderText}>
              No active session. Pair an IDE plugin or CLI first.
            </Text>
          </View>
        ) : (
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
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#161b22',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1f2433',
  },
  pathText: { flex: 1, color: '#d1d5db', fontFamily: 'Menlo', fontSize: 12 },
  statusActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  savedHint: { color: '#34d399', fontSize: 11 },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#7c3aed',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  errorBar: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(244,63,94,0.1)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(244,63,94,0.4)',
  },
  errorText: { color: '#fecaca', fontSize: 11 },
  body: { flex: 1, backgroundColor: '#0d1117' },
  webview: { flex: 1, backgroundColor: '#0d1117' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  loadingText: { color: '#9ca3af', fontSize: 12 },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  placeholderTitle: { color: '#d1d5db', fontSize: 14, fontWeight: '600' },
  placeholderText: { color: '#6b7280', fontSize: 12, textAlign: 'center' },
});
