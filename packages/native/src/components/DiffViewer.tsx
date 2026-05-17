import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { detectLanguage, type FileFetcher, type GitProvider } from '@codeam/ide-core';

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
 * Reverse a unified-diff to reconstruct the ORIGINAL buffer from
 * the MODIFIED (working tree) buffer + diff text. Shared logic
 * with the web DiffViewer — kept inline here so the native bundle
 * doesn't pull in cross-platform helper modules unnecessarily.
 */
function reconstructOriginal(modified: string, diff: string): string {
  const modifiedLines = modified.split('\n');
  const original: string[] = [];
  let cursor = 0;
  const lines = diff.split('\n');
  let i = 0;
  while (i < lines.length && !(lines[i] ?? '').startsWith('@@')) i++;
  while (i < lines.length) {
    const header = lines[i] ?? '';
    const match = header.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (!match) {
      i++;
      continue;
    }
    const newStart = parseInt(match[3] ?? '1', 10) - 1;
    while (cursor < newStart && cursor < modifiedLines.length) {
      original.push(modifiedLines[cursor] ?? '');
      cursor++;
    }
    i++;
    while (i < lines.length && !(lines[i] ?? '').startsWith('@@')) {
      const raw = lines[i] ?? '';
      i++;
      if (raw.startsWith('\\')) continue;
      const prefix = raw[0];
      const body = raw.slice(1);
      if (prefix === ' ') {
        original.push(body);
        cursor++;
      } else if (prefix === '-') {
        original.push(body);
      } else if (prefix === '+') {
        cursor++;
      } else {
        original.push(raw);
        cursor++;
      }
    }
  }
  while (cursor < modifiedLines.length) {
    original.push(modifiedLines[cursor] ?? '');
    cursor++;
  }
  return original.join('\n');
}

function buildDiffHtml(original: string, modified: string, language: string): string {
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
<script src="https://cdn.jsdelivr.net/npm/monaco-editor@0.52/min/vs/loader.js"></script>
<script>
  require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52/min/vs' } });
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
  });
</script>
</body>
</html>`;
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
  const [state, setState] = useState<DiffState>({
    loading: true,
    error: null,
    original: '',
    modified: '',
  });
  const gitRef = useRef(git);
  gitRef.current = git;
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, error: null, original: '', modified: '' });
    (async () => {
      try {
        const [diffResult, readResult] = await Promise.all([
          gitRef.current.diff(path, staged),
          fetcherRef.current.read(path),
        ]);
        if (cancelled) return;
        if (!readResult || readResult.error) {
          setState({
            loading: false,
            error: readResult?.error ?? 'Could not read working-tree version.',
            original: '',
            modified: '',
          });
          return;
        }
        const modified = readResult.content ?? '';
        const original = diffResult?.diff
          ? reconstructOriginal(modified, diffResult.diff)
          : modified;
        setState({ loading: false, error: null, original, modified });
      } catch (e) {
        if (cancelled) return;
        setState({
          loading: false,
          error: e instanceof Error ? e.message : 'Diff failed.',
          original: '',
          modified: '',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path, staged]);

  const html = useMemo(() => {
    if (state.loading) return null;
    return buildDiffHtml(state.original, state.modified, detectLanguage(path));
  }, [state.loading, state.original, state.modified, path]);

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.pathText} numberOfLines={1}>
          {path}
        </Text>
        <View style={styles.headerRight}>
          <View style={styles.stagedBadge}>
            <Text style={styles.stagedBadgeText}>{staged ? 'STAGED' : 'WORKING TREE'}</Text>
          </View>
          {onClose ? (
            <Pressable onPress={onClose} hitSlop={6}>
              <Ionicons name="close" size={18} color="#9ca3af" />
            </Pressable>
          ) : null}
        </View>
      </View>
      {state.error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText} numberOfLines={2}>
            {state.error}
          </Text>
        </View>
      ) : null}
      <View style={styles.body}>
        {state.loading || html === null ? (
          <View style={styles.loading}>
            <ActivityIndicator size="small" color="#a78bfa" />
            <Text style={styles.loadingText}>Loading diff…</Text>
          </View>
        ) : (
          <WebView
            originWhitelist={['*']}
            source={{ html }}
            style={styles.webview}
            javaScriptEnabled
            domStorageEnabled
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
});
