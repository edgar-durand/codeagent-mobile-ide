import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { WebViewMessageEvent } from 'react-native-webview';
import { ResilientWebView } from './ResilientWebView';
import {
  buildDiffHtml,
  detectLanguage,
  parseBridgeMessage,
  reconstructOriginal,
  runCancellable,
  type FileFetcher,
  type GitProvider,
} from '@codeam/ide-core';
import { useIDETheme } from '../theme';
import { useAsyncAdapter } from '../hooks/useAsyncAdapter';

interface Props {
  path: string;
  git: GitProvider;
  fetcher: FileFetcher;
  staged?: boolean;
  onClose?: () => void;
}

interface DiffState {
  loading: boolean;
  error: string | null;
  original: string;
  modified: string;
}

/**
 * React Native side-by-side diff viewer. Same UX as the web
 * DiffViewer: fetch the working-tree buffer + unified diff,
 * reverse-apply the diff to reconstruct the original, and render
 * Monaco's DiffEditor inside a WebView.
 *
 * Side-by-side mode collapses to a stacked diff on narrow
 * viewports because Monaco's DiffEditor handles the rebreak
 * automatically when its renderer detects the available width.
 */
export function DiffViewer({ path, git, fetcher, staged, onClose }: Props) {
  const theme = useIDETheme();
  const generationRef = useRef(0);
  const [readyGeneration, setReadyGeneration] = useState<number | undefined>(undefined);
  const handleGenerationChange = useCallback((generation: number) => {
    generationRef.current = generation;
    setReadyGeneration(undefined);
  }, []);
  const [state, setState] = useState<DiffState>({
    loading: true,
    error: null,
    original: '',
    modified: '',
  });
  const { adapterRef: gitRef, reloadCount, reload } = useAsyncAdapter(git);
  const { adapterRef: fetcherRef } = useAsyncAdapter(fetcher);

  useEffect(
    () =>
      runCancellable(async (isCancelled) => {
        setState({ loading: true, error: null, original: '', modified: '' });
        try {
          const [diffResult, readResult] = await Promise.all([
            gitRef.current.diff(path, staged),
            fetcherRef.current.read(path),
          ]);
          if (isCancelled()) return;
          if (!readResult || readResult.error) {
            setState({
              loading: false,
              error: readResult?.error ?? 'Could not read working-tree version.',
              original: '',
              modified: '',
            });
            return;
          }
          if (!diffResult) {
            setState({
              loading: false,
              error: 'The source-control provider did not return a diff for this file.',
              original: '',
              modified: '',
            });
            return;
          }
          const modified = readResult.content ?? '';
          const original = diffResult.diff
            ? reconstructOriginal(modified, diffResult.diff)
            : modified;
          setState({ loading: false, error: null, original, modified });
        } catch (e) {
          if (isCancelled()) return;
          setState({
            loading: false,
            error: e instanceof Error ? e.message : 'Diff failed.',
            original: '',
            modified: '',
          });
        }
      }),
    [path, staged, reloadCount, gitRef, fetcherRef],
  );

  const html = useMemo(() => {
    if (state.loading) return null;
    return buildDiffHtml({
      original: state.original,
      modified: state.modified,
      language: detectLanguage(path),
    });
  }, [state.loading, state.original, state.modified, path]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.headerBar}>
        <Text style={styles.pathText} numberOfLines={1}>
          {path}
        </Text>
        <View style={styles.headerRight}>
          <View style={styles.stagedBadge}>
            <Text style={styles.stagedBadgeText}>{staged ? 'STAGED' : 'WORKING TREE'}</Text>
          </View>
          {onClose ? (
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close diff"
            >
              <Ionicons name="close" size={18} color="#9ca3af" />
            </Pressable>
          ) : null}
        </View>
      </View>
      {state.error ? (
        <View accessibilityRole="alert" style={styles.errorBar}>
          <Text style={styles.errorText} numberOfLines={2}>
            {state.error}
          </Text>
        </View>
      ) : null}
      <View style={styles.body}>
        {state.loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="small" color="#a78bfa" />
            <Text style={styles.loadingText}>Loading diff…</Text>
          </View>
        ) : state.error ? (
          <View style={styles.loading}>
            <Ionicons name="alert-circle-outline" size={28} color={theme.colors.danger} />
            <Text style={styles.loadingText}>The diff could not be loaded.</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry loading diff"
              onPress={reload}
              style={[styles.retryBtn, { minHeight: theme.minimumTouchSize }]}
            >
              <Ionicons name="refresh-outline" size={14} color="#fff" />
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : html !== null ? (
          <ResilientWebView
            surfaceLabel="diff"
            loadingLabel="Rendering diff…"
            testID="diff-surface"
            waitForBridgeReady
            bridgeReadyGeneration={readyGeneration}
            onGenerationChange={handleGenerationChange}
            originWhitelist={['*']}
            source={{ html }}
            style={styles.webview}
            javaScriptEnabled
            domStorageEnabled
            setSupportMultipleWindows={false}
            automaticallyAdjustContentInsets={false}
            onMessage={(event: WebViewMessageEvent) => {
              const message = parseBridgeMessage(event.nativeEvent.data);
              if (message?.type === 'ready') setReadyGeneration(generationRef.current);
            }}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  headerBar: {
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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stagedBadge: {
    backgroundColor: 'rgba(167,139,250,0.18)',
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  stagedBadgeText: { fontSize: 9, color: '#ede9fe', fontWeight: '700' },
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
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#7c5cff',
  },
  retryText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
