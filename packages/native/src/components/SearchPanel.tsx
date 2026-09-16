import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  runCancellable,
  type SearchHit,
  type SearchOptions,
  type SearchProvider,
  type SearchResult,
} from '@codeam/ide-core';
import { useIDETheme } from '../theme';
import { useAsyncAdapter } from '../hooks/useAsyncAdapter';

interface Props {
  provider: SearchProvider;
  onOpen: (hit: SearchHit) => void;
  initialQuery?: string;
  /** Override the native confirmation dialog, primarily for custom hosts and tests. */
  confirmReplace?: (message: string, confirm: () => void) => void;
}

interface GroupedHits {
  path: string;
  hits: SearchHit[];
}

function groupByFile(hits: SearchHit[]): GroupedHits[] {
  const map = new Map<string, SearchHit[]>();
  for (const h of hits) {
    const arr = map.get(h.path);
    if (arr) arr.push(h);
    else map.set(h.path, [h]);
  }
  return Array.from(map.entries()).map(([path, hits]) => ({ path, hits }));
}

type Row =
  | { kind: 'group'; path: string; count: number; collapsed: boolean }
  | { kind: 'hit'; hit: SearchHit; idx: number };

/**
 * React Native multi-file search panel. Mirrors the web SearchPanel:
 * regex / case / word toggles, optional include / exclude globs,
 * results grouped by file. Uses FlatList for cheap virtualisation
 * on large result sets.
 */
export function SearchPanel({ provider, onOpen, initialQuery, confirmReplace }: Props) {
  const theme = useIDETheme();
  const [query, setQuery] = useState(initialQuery ?? '');
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery ?? '');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [regex, setRegex] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [include, setInclude] = useState('');
  const [exclude, setExclude] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { reloadCount, reload } = useAsyncAdapter(provider);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replacement, setReplacement] = useState('');
  const [replacing, setReplacing] = useState(false);
  const [replaceStatus, setReplaceStatus] = useState<string | null>(null);
  const previousProvider = useRef(provider);
  const replaceSupported = typeof provider.replace === 'function';

  const fetchKey = useMemo(
    () =>
      [
        debouncedQuery,
        caseSensitive ? 'C' : 'c',
        wholeWord ? 'W' : 'w',
        regex ? 'R' : 'r',
        include,
        exclude,
      ].join('|'),
    [debouncedQuery, caseSensitive, wholeWord, regex, include, exclude],
  );
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(
    () =>
      runCancellable(async (isCancelled) => {
        if (previousProvider.current !== provider) {
          previousProvider.current = provider;
          setResult(null);
          setCollapsed(new Set());
        }
        if (!debouncedQuery) {
          setResult(null);
          setError(null);
          setLoading(false);
          return;
        }
        setLoading(true);
        setError(null);
        const options: SearchOptions = {
          caseSensitive,
          wholeWord,
          regex,
          include: include
            ? include
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined,
          exclude: exclude
            ? exclude
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined,
        };
        try {
          const r = await provider.search(debouncedQuery, options);
          if (isCancelled()) return;
          setResult(r);
          setError(null);
        } catch (cause: unknown) {
          if (isCancelled()) return;
          setError(cause instanceof Error ? cause.message : 'Search failed.');
        } finally {
          if (!isCancelled()) setLoading(false);
        }
      }),
    [
      provider,
      debouncedQuery,
      caseSensitive,
      wholeWord,
      regex,
      include,
      exclude,
      fetchKey,
      reloadCount,
    ],
  );

  const groups = useMemo(() => groupByFile(result?.hits ?? []), [result]);

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const g of groups) {
      const isCollapsed = collapsed.has(g.path);
      out.push({ kind: 'group', path: g.path, count: g.hits.length, collapsed: isCollapsed });
      if (!isCollapsed) {
        g.hits.forEach((hit, idx) => out.push({ kind: 'hit', hit, idx }));
      }
    }
    return out;
  }, [groups, collapsed]);

  const toggle = (path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const runReplace = async (targets?: Array<{ path: string; line?: number; column?: number }>) => {
    if (!replaceSupported || !debouncedQuery || !provider.replace) return;
    setReplacing(true);
    setReplaceStatus(null);
    try {
      const r = await provider.replace(
        debouncedQuery,
        replacement,
        {
          caseSensitive,
          wholeWord,
          regex,
          include: include
            ? include
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined,
          exclude: exclude
            ? exclude
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined,
        },
        targets,
      );
      setReplaceStatus(
        `Replaced ${r.replaced} in ${r.filesChanged} file${r.filesChanged === 1 ? '' : 's'}.`,
      );
      // Re-run search so the result list reflects post-replace state.
      reload();
    } catch (e) {
      setReplaceStatus(e instanceof Error ? e.message : 'Replace failed');
    } finally {
      setReplacing(false);
    }
  };

  const confirmReplaceAll = () => {
    const hitCount = result?.total ?? result?.hits.length ?? 0;
    const fileCount = groups.length;
    const message = `Replace ${hitCount} match${hitCount === 1 ? '' : 'es'} in ${fileCount} file${fileCount === 1 ? '' : 's'}? This action cannot be undone.`;
    const confirm = () => void runReplace();
    if (confirmReplace) confirmReplace(message, confirm);
    else
      Alert.alert('Replace all?', message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Replace All', style: 'destructive', onPress: confirm },
      ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Search</Text>
      </View>

      <View style={styles.queryBlock}>
        <View style={styles.inputWrap}>
          <Ionicons name="search" size={12} color="#6b7280" style={styles.inputIcon} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
            placeholderTextColor="#6b7280"
            autoCapitalize="none"
            autoCorrect={false}
            style={[
              styles.input,
              {
                color: theme.colors.text,
                fontSize: theme.typography.bodySize,
                fontFamily: theme.typography.monoFamily,
              },
            ]}
            accessibilityLabel="Search across files"
          />
        </View>
        <View style={styles.togglesRow}>
          <ToggleBtn
            label="Aa"
            accessibilityLabel="Match case"
            on={caseSensitive}
            onPress={() => setCaseSensitive((v) => !v)}
          />
          <ToggleBtn
            label="ab"
            accessibilityLabel="Match whole word"
            on={wholeWord}
            onPress={() => setWholeWord((v) => !v)}
          />
          <ToggleBtn
            label=".*"
            accessibilityLabel="Use regular expression"
            on={regex}
            onPress={() => setRegex((v) => !v)}
          />
          {replaceSupported && (
            <ToggleBtn
              label="⇄"
              accessibilityLabel="Toggle replace"
              on={replaceOpen}
              onPress={() => setReplaceOpen((v) => !v)}
            />
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Toggle file filters"
            accessibilityState={{ expanded: showAdvanced }}
            onPress={() => setShowAdvanced((v) => !v)}
            style={[styles.advancedButton, { minHeight: theme.minimumTouchSize }]}
          >
            <Text style={styles.advancedToggle}>
              {showAdvanced ? '▾ files to include / exclude' : '▸ files to include / exclude'}
            </Text>
          </Pressable>
        </View>
        {replaceSupported && replaceOpen && (
          <View style={styles.replaceRow}>
            <View style={styles.inputWrap}>
              <Text style={styles.inputIcon}>↦</Text>
              <TextInput
                value={replacement}
                onChangeText={setReplacement}
                placeholder="Replace"
                placeholderTextColor="#6b7280"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
            </View>
            <Pressable
              disabled={!debouncedQuery || replacing}
              onPress={confirmReplaceAll}
              style={[
                styles.replaceAllBtn,
                { minHeight: theme.minimumTouchSize, backgroundColor: theme.colors.accent },
                (!debouncedQuery || replacing) && { opacity: 0.5 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Replace all search results"
              accessibilityState={{ disabled: !debouncedQuery || replacing }}
            >
              <Text style={styles.replaceAllText}>All</Text>
            </Pressable>
          </View>
        )}
        {replaceSupported && replaceStatus && (
          <Text style={styles.replaceStatus}>{replaceStatus}</Text>
        )}
        {showAdvanced ? (
          <View style={styles.advancedBlock}>
            <TextInput
              value={include}
              onChangeText={setInclude}
              placeholder="files to include (comma-separated globs)"
              placeholderTextColor="#6b7280"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.advancedInput}
            />
            <TextInput
              value={exclude}
              onChangeText={setExclude}
              placeholder="files to exclude"
              placeholderTextColor="#6b7280"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.advancedInput}
            />
          </View>
        ) : null}
      </View>

      {error ? (
        <View style={styles.errorBanner} accessibilityRole="alert">
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry search"
            onPress={reload}
            style={[styles.retryButton, { minHeight: theme.minimumTouchSize }]}
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
      {!debouncedQuery ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Type to search…</Text>
        </View>
      ) : loading && result === null ? (
        <View style={styles.empty}>
          <ActivityIndicator size="small" color="#a78bfa" />
          <Text style={styles.emptyText}>Searching…</Text>
        </View>
      ) : groups.length === 0 ? (
        error ? null : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No results.</Text>
          </View>
        )
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r, i) =>
            r.kind === 'group'
              ? `g:${r.path}`
              : `h:${r.hit.path}:${r.hit.line}:${r.hit.column}:${i}`
          }
          ListHeaderComponent={() => (
            <Text style={styles.totalText}>
              {result?.total ?? result?.hits.length ?? 0} result
              {(result?.hits.length ?? 0) === 1 ? '' : 's'} in {groups.length} file
              {groups.length === 1 ? '' : 's'}
              {result?.truncated ? ' · truncated' : ''}
            </Text>
          )}
          renderItem={({ item }) => {
            if (item.kind === 'group') {
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${item.path}, ${item.count} results`}
                  accessibilityState={{ expanded: !item.collapsed }}
                  onPress={() => toggle(item.path)}
                  style={[styles.groupRow, { minHeight: theme.minimumTouchSize }]}
                >
                  <Text style={styles.chevron}>{item.collapsed ? '▸' : '▾'}</Text>
                  <Ionicons name="document-outline" size={12} color="#6b7280" />
                  <Text style={styles.groupPath} numberOfLines={1}>
                    {item.path}
                  </Text>
                  <Text style={styles.groupCount}>{item.count}</Text>
                </Pressable>
              );
            }
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${item.hit.path} line ${item.hit.line}`}
                onPress={() => onOpen(item.hit)}
                style={[styles.hitRow, { minHeight: theme.minimumTouchSize }]}
              >
                <Text style={styles.hitText} numberOfLines={1}>
                  {item.hit.text}
                </Text>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

function ToggleBtn({
  label,
  accessibilityLabel,
  on,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  on: boolean;
  onPress: () => void;
}) {
  const theme = useIDETheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: on }}
      onPress={onPress}
      style={[
        styles.toggle,
        { minWidth: theme.minimumTouchSize, height: theme.minimumTouchSize },
        on && styles.toggleOn,
      ]}
    >
      <Text
        style={[
          styles.toggleText,
          { fontFamily: theme.typography.monoFamily },
          on && styles.toggleTextOn,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  headerRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1f2433',
  },
  header: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#9ca3af',
  },
  queryBlock: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1f2433',
    gap: 8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(17,24,39,0.7)',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 6,
  },
  inputIcon: {},
  input: { flex: 1, color: '#e5e7eb', fontSize: 12, paddingVertical: 4 },
  togglesRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toggle: {
    minWidth: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  toggleOn: { backgroundColor: 'rgba(167,139,250,0.25)', borderColor: 'rgba(167,139,250,0.5)' },
  toggleText: { fontSize: 10, color: '#6b7280', fontFamily: 'Menlo' },
  toggleTextOn: { color: '#ede9fe' },
  advancedToggle: { fontSize: 11, color: '#9ca3af', marginLeft: 4 },
  advancedButton: { minHeight: 44, justifyContent: 'center' },
  advancedBlock: { gap: 6 },
  advancedInput: {
    backgroundColor: 'rgba(17,24,39,0.7)',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 11,
    color: '#e5e7eb',
    fontFamily: 'Menlo',
  },
  empty: { padding: 24, alignItems: 'center', gap: 6 },
  emptyText: { fontSize: 11, color: '#6b7280' },
  errorBanner: {
    minHeight: 44,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(244,63,94,0.1)',
  },
  errorText: { flex: 1, color: '#fecaca', fontSize: 11 },
  retryButton: { minWidth: 64, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  retryText: { color: '#c4b5fd', fontSize: 12, fontWeight: '600' },
  totalText: { paddingHorizontal: 12, paddingVertical: 6, fontSize: 11, color: '#9ca3af' },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    minHeight: 44,
    gap: 6,
  },
  chevron: { width: 12, fontSize: 10, color: '#6b7280' },
  groupPath: { flex: 1, fontSize: 12, color: '#e5e7eb', fontFamily: 'Menlo' },
  groupCount: { fontSize: 10, color: '#6b7280' },
  hitRow: { paddingHorizontal: 32, minHeight: 44, justifyContent: 'center' },
  hitText: { fontSize: 11, color: '#d1d5db', fontFamily: 'Menlo' },
  replaceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  replaceAllBtn: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 44,
    borderRadius: 4,
  },
  replaceAllText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  replaceStatus: { fontSize: 10, color: '#9ca3af', marginTop: 2 },
});
