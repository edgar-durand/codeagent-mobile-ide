import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SearchHit, SearchOptions, SearchProvider, SearchResult } from '@codeam/ide-core';

interface Props {
  provider: SearchProvider;
  onOpen: (hit: SearchHit) => void;
  initialQuery?: string;
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
export function SearchPanel({ provider, onOpen, initialQuery }: Props) {
  const [query, setQuery] = useState(initialQuery ?? '');
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery ?? '');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [regex, setRegex] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [include, setInclude] = useState('');
  const [exclude, setExclude] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replacement, setReplacement] = useState('');
  const [replacing, setReplacing] = useState(false);
  const [replaceStatus, setReplaceStatus] = useState<string | null>(null);
  const providerRef = useRef(provider);
  providerRef.current = provider;
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
  const [committedKey, setCommittedKey] = useState<string | null>(null);
  const loading = debouncedQuery.length > 0 && committedKey !== fetchKey;

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    if (!debouncedQuery) {
      setResult(null);
      setCommittedKey(fetchKey);
      return;
    }
    let cancelled = false;
    const options: SearchOptions = {
      caseSensitive,
      wholeWord,
      regex,
      include: include
        ? include.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
      exclude: exclude
        ? exclude.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
    };
    providerRef.current
      .search(debouncedQuery, options)
      .then((r) => {
        if (!cancelled) {
          setResult(r);
          setCommittedKey(fetchKey);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResult({ hits: [], truncated: false });
          setCommittedKey(fetchKey);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, caseSensitive, wholeWord, regex, include, exclude, fetchKey]);

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

  const runReplace = async (
    targets?: Array<{ path: string; line?: number; column?: number }>,
  ) => {
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
            ? include.split(',').map((s) => s.trim()).filter(Boolean)
            : undefined,
          exclude: exclude
            ? exclude.split(',').map((s) => s.trim()).filter(Boolean)
            : undefined,
        },
        targets,
      );
      setReplaceStatus(
        `Replaced ${r.replaced} in ${r.filesChanged} file${r.filesChanged === 1 ? '' : 's'}.`,
      );
      // Re-run search so the result list reflects post-replace state.
      setCommittedKey(null);
    } catch (e) {
      setReplaceStatus(e instanceof Error ? e.message : 'Replace failed');
    } finally {
      setReplacing(false);
    }
  };

  return (
    <View style={styles.container}>
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
            style={styles.input}
          />
        </View>
        <View style={styles.togglesRow}>
          <ToggleBtn label="Aa" on={caseSensitive} onPress={() => setCaseSensitive((v) => !v)} />
          <ToggleBtn label="ab" on={wholeWord} onPress={() => setWholeWord((v) => !v)} />
          <ToggleBtn label=".*" on={regex} onPress={() => setRegex((v) => !v)} />
          {replaceSupported && (
            <ToggleBtn label="⇄" on={replaceOpen} onPress={() => setReplaceOpen((v) => !v)} />
          )}
          <Pressable onPress={() => setShowAdvanced((v) => !v)} hitSlop={6}>
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
              onPress={() => void runReplace()}
              style={[styles.replaceAllBtn, (!debouncedQuery || replacing) && { opacity: 0.5 }]}
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

      {!debouncedQuery ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Type to search…</Text>
        </View>
      ) : loading ? (
        <View style={styles.empty}>
          <ActivityIndicator size="small" color="#a78bfa" />
          <Text style={styles.emptyText}>Searching…</Text>
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No results.</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r, i) =>
            r.kind === 'group' ? `g:${r.path}` : `h:${r.hit.path}:${r.hit.line}:${r.hit.column}:${i}`
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
                <Pressable onPress={() => toggle(item.path)} style={styles.groupRow}>
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
              <Pressable onPress={() => onOpen(item.hit)} style={styles.hitRow}>
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

function ToggleBtn({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={4} style={[styles.toggle, on && styles.toggleOn]}>
      <Text style={[styles.toggleText, on && styles.toggleTextOn]}>{label}</Text>
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
    width: 22,
    height: 22,
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
  totalText: { paddingHorizontal: 12, paddingVertical: 6, fontSize: 11, color: '#9ca3af' },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 6,
  },
  chevron: { width: 12, fontSize: 10, color: '#6b7280' },
  groupPath: { flex: 1, fontSize: 12, color: '#e5e7eb', fontFamily: 'Menlo' },
  groupCount: { fontSize: 10, color: '#6b7280' },
  hitRow: { paddingHorizontal: 32, paddingVertical: 2 },
  hitText: { fontSize: 11, color: '#d1d5db', fontFamily: 'Menlo' },
  replaceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  replaceAllBtn: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  replaceAllText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  replaceStatus: { fontSize: 10, color: '#9ca3af', marginTop: 2 },
});
