import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { WebView, WebViewMessageEvent } from 'react-native-webview';
import { ResilientWebView } from './ResilientWebView';
import {
  buildEditorHtml,
  BUNDLED_CUSTOM_THEMES,
  DEFAULT_EDITOR_SETTINGS,
  detectLanguage,
  parseBridgeMessage,
  runCancellable,
  type EditorSettingsSnapshot,
  type FileFetcher,
  type MonacoTheme,
  type SettingsStore,
} from '@codeam/ide-core';
import { CUSTOM_THEMES_STORE_KEY } from './SettingsPanel';
import { ConflictBanner } from './ConflictBanner';
import { useIDETheme } from '../theme';
import { useAsyncAdapter } from '../hooks/useAsyncAdapter';

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
  const theme = useIDETheme();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState<number | null>(null);
  const { reloadCount, reload } = useAsyncAdapter(fetcher);
  const [settings, setSettings] = useState<EditorSettingsSnapshot>(DEFAULT_EDITOR_SETTINGS);
  const [customThemes, setCustomThemes] = useState<MonacoTheme[]>([]);
  const webRef = useRef<WebView>(null);
  const webReadyRef = useRef(false);
  const webGenerationRef = useRef(0);
  const [readyGeneration, setReadyGeneration] = useState<number | undefined>(undefined);
  const fetcherRef = useRef(fetcher);
  const loadedByFetcherRef = useRef(new Map<string, FileFetcher>());
  const savedFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  fetcherRef.current = fetcher;

  // Pull settings from the store and watch for changes.
  useEffect(() => {
    if (!settingsStore) return;
    let active = true;
    void Promise.all([
      settingsStore.get('editor').then((v) => {
        if (active && isSnapshot(v)) setSettings({ ...DEFAULT_EDITOR_SETTINGS, ...v });
      }),
      settingsStore.get(CUSTOM_THEMES_STORE_KEY).then((v) => {
        if (active && Array.isArray(v)) setCustomThemes(v as MonacoTheme[]);
      }),
    ]).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Could not load settings.');
    });
    let off = () => {};
    try {
      off = settingsStore.watch((key, value) => {
        if (key === 'editor' && isSnapshot(value)) {
          setSettings({ ...DEFAULT_EDITOR_SETTINGS, ...value });
        } else if (key === CUSTOM_THEMES_STORE_KEY && Array.isArray(value)) {
          setCustomThemes(value as MonacoTheme[]);
        }
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not watch settings.');
    }
    return () => {
      active = false;
      off();
    };
  }, [settingsStore]);

  // Push user-imported themes into the WebView whenever the list
  // changes (initial load + any subsequent import). The
  // `bridgeRegisterCustomThemes` defined in the HTML is idempotent
  // so re-sending the full list is safe.
  useEffect(() => {
    if (!webReadyRef.current || !webRef.current || customThemes.length === 0) return;
    const payload = JSON.stringify(customThemes);
    webRef.current.injectJavaScript(
      `try { window.bridgeRegisterCustomThemes(${payload}); } catch (e) {} true;`,
    );
  }, [customThemes]);

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
  useEffect(
    () =>
      runCancellable(async (isCancelled) => {
        if (!path || !fetcher) return;
        if (buffers[path] !== undefined && loadedByFetcherRef.current.get(path) === fetcher) return;
        setLoading(true);
        setError(null);
        webReadyRef.current = false;
        try {
          const r = await fetcher.read(path);
          if (isCancelled()) return;
          if (!r || r.error) {
            setError(r?.error ?? 'Could not read file.');
            return;
          }
          const content = r.content ?? '';
          loadedByFetcherRef.current.set(path, fetcher);
          setBuffers((prev) => ({ ...prev, [path]: content }));
          setSaved((prev) => ({ ...prev, [path]: content }));
        } catch (e) {
          if (isCancelled()) return;
          setError(e instanceof Error ? e.message : 'Read failed.');
        } finally {
          if (!isCancelled()) setLoading(false);
        }
      }),
    [path, fetcher, buffers, setBuffers, setSaved, reloadCount],
  );

  const language = useMemo(() => (path ? detectLanguage(path) : 'plaintext'), [path]);
  const content =
    path && fetcher && loadedByFetcherRef.current.get(path) === fetcher ? buffers[path] : undefined;
  const original =
    path && fetcher && loadedByFetcherRef.current.get(path) === fetcher ? saved[path] : undefined;
  const dirty =
    path !== null && content !== undefined && original !== undefined && content !== original;
  const canSave =
    path !== null &&
    fetcher !== null &&
    fetcher.canWrite &&
    content !== undefined &&
    dirty &&
    !saving;
  const requestClose = () => {
    if (!onClose) return;
    if (!dirty) {
      onClose();
      return;
    }
    Alert.alert('Discard unsaved changes?', `${path ?? 'This file'} has not been saved.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onClose },
    ]);
  };
  const handleGenerationChange = useCallback((generation: number) => {
    webGenerationRef.current = generation;
    webReadyRef.current = false;
    setReadyGeneration(undefined);
  }, []);

  // Build the WebView HTML once per file open — the bridge mutates
  // the buffer afterwards so we don't reload Monaco on every keystroke.
  const html = useMemo(
    () =>
      content !== undefined
        ? buildEditorHtml({
            initialContent: content,
            language,
            settings,
            readOnly: !fetcher?.canWrite,
            bundledThemes: BUNDLED_CUSTOM_THEMES,
          })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path, language, content !== undefined, fetcher?.canWrite],
  );

  const onMessage = (e: WebViewMessageEvent) => {
    const msg = parseBridgeMessage(e.nativeEvent.data);
    if (!msg) return;
    if (msg.type === 'change' && path) {
      setBuffers((prev) => ({ ...prev, [path]: typeof msg.value === 'string' ? msg.value : '' }));
    } else if (msg.type === 'save') {
      void onSave();
    } else if (msg.type === 'ready') {
      webReadyRef.current = true;
      setReadyGeneration(webGenerationRef.current);
      if (customThemes.length > 0 && webRef.current) {
        const payload = JSON.stringify(customThemes);
        webRef.current.injectJavaScript(
          `try { window.bridgeRegisterCustomThemes(${payload}); } catch (e) {} true;`,
        );
      }
    } else if (msg.type === 'error') {
      setError(typeof msg.value === 'string' ? msg.value : 'Editor error');
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
      if (savedFlashTimerRef.current) clearTimeout(savedFlashTimerRef.current);
      savedFlashTimerRef.current = setTimeout(() => setSavedFlash(null), 2500);
      onAfterSave?.(path);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(
    () => () => {
      if (savedFlashTimerRef.current) clearTimeout(savedFlashTimerRef.current);
    },
    [],
  );

  if (!path) {
    return (
      <View style={styles.placeholder}>
        <Ionicons name="folder-outline" size={28} color="#6b7280" />
        <Text style={styles.placeholderTitle}>No file open</Text>
        <Text style={styles.placeholderText}>Pick a file from the explorer to start editing.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.statusBar}>
        <Text style={styles.pathText} numberOfLines={1}>
          {path}
        </Text>
        <View style={styles.statusActions}>
          {savedFlash !== null && !dirty ? <Text style={styles.savedHint}>Saved</Text> : null}
          <Pressable
            onPress={onSave}
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityLabel="Save file"
            accessibilityState={{ disabled: !canSave, busy: saving }}
            style={[
              styles.saveBtn,
              { minHeight: theme.minimumTouchSize },
              !canSave && styles.saveBtnDisabled,
            ]}
          >
            <Ionicons name="save-outline" size={13} color="#fff" />
            <Text style={styles.saveBtnText}>{saving ? 'Saving' : 'Save'}</Text>
          </Pressable>
          {onClose ? (
            <Pressable
              onPress={requestClose}
              accessibilityRole="button"
              accessibilityLabel="Close file"
              accessibilityHint={dirty ? 'Unsaved changes; confirmation required' : undefined}
              hitSlop={12}
            >
              <Ionicons name="close" size={18} color="#9ca3af" />
            </Pressable>
          ) : null}
        </View>
      </View>
      {error ? (
        <View accessibilityRole="alert" style={styles.errorBar}>
          <Text style={styles.errorText} numberOfLines={2}>
            {error}
          </Text>
        </View>
      ) : null}
      {path && content !== undefined ? (
        <ConflictBanner
          content={content}
          onResolved={(next) => {
            // Update the React-side buffer so the dirty indicator
            // flips, AND push the new content into the WebView via
            // the bridge so the visible Monaco buffer matches.
            // Without the bridge call, the editor still shows the
            // old (unresolved) text and the next user edit would
            // re-introduce the conflict markers.
            setBuffers((prev) => ({ ...prev, [path]: next }));
            if (webReadyRef.current && webRef.current) {
              webRef.current.injectJavaScript(
                `try { window.bridgeSetValue(${JSON.stringify(next)}); } catch (e) {} true;`,
              );
            }
          }}
        />
      ) : null}
      <View style={styles.body}>
        {!fetcher ? (
          <View style={styles.placeholder}>
            <Ionicons name="cloud-offline-outline" size={26} color="#6b7280" />
            <Text style={styles.placeholderText}>
              No active session. Pair an IDE plugin or CLI first.
            </Text>
          </View>
        ) : loading || (html === null && error === null) ? (
          <View style={styles.loading}>
            <ActivityIndicator size="small" color="#a78bfa" />
            <Text style={styles.loadingText}>Fetching {path}…</Text>
          </View>
        ) : html === null ? (
          <View style={styles.placeholder}>
            <Ionicons name="alert-circle-outline" size={28} color={theme.colors.danger} />
            <Text style={styles.placeholderText}>{error ?? 'Could not read file.'}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry loading file"
              onPress={reload}
              style={[styles.saveBtn, { minHeight: theme.minimumTouchSize }]}
            >
              <Ionicons name="refresh-outline" size={14} color="#fff" />
              <Text style={styles.saveBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <ResilientWebView
            surfaceLabel="editor"
            loadingLabel="Opening editor…"
            testID="editor-surface"
            waitForBridgeReady
            bridgeReadyGeneration={readyGeneration}
            onGenerationChange={handleGenerationChange}
            webViewRef={webRef}
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
