import { useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  MARKETPLACE_THEMES,
  vscodeThemeToMonaco,
  type MarketplaceThemeRef,
  type MonacoTheme,
  type SettingsStore,
  type VSCodeColorTheme,
} from '@codeam/ide-core';
import { CUSTOM_THEMES_STORE_KEY } from './SettingsPanel';

interface Props {
  store: SettingsStore;
  themes?: readonly MarketplaceThemeRef[];
  title?: string;
}

type Filter = 'all' | 'dark' | 'light' | 'installed';

/**
 * React Native mirror of the web MarketplacePanel. Same fetch /
 * install / activate flow, restyled for touch — chip-style filter
 * row + tall cards with the 3-swatch preview vertical bar. Tap
 * Install (or Apply when previously installed) to flip the active
 * theme via the SettingsStore.
 */
export function MarketplacePanel({
  store,
  themes = MARKETPLACE_THEMES,
  title = 'Themes Marketplace',
}: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [installed, setInstalled] = useState<MonacoTheme[]>([]);
  const [activeTheme, setActiveTheme] = useState<string>('vs-dark');
  const [busyName, setBusyName] = useState<string | null>(null);
  const [errorByName, setErrorByName] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    void store.get(CUSTOM_THEMES_STORE_KEY).then((v) => {
      if (cancelled) return;
      if (Array.isArray(v)) setInstalled(v as MonacoTheme[]);
    });
    void store.get('editor').then((v) => {
      if (cancelled) return;
      if (v && typeof v === 'object' && 'theme' in v && typeof v.theme === 'string') {
        setActiveTheme(v.theme);
      }
    });
    const off = store.watch((key, value) => {
      if (key === CUSTOM_THEMES_STORE_KEY && Array.isArray(value)) {
        setInstalled(value as MonacoTheme[]);
      } else if (
        key === 'editor' &&
        value &&
        typeof value === 'object' &&
        'theme' in value &&
        typeof value.theme === 'string'
      ) {
        setActiveTheme(value.theme);
      }
    });
    return () => {
      cancelled = true;
      off();
    };
  }, [store]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return themes.filter((t) => {
      if (filter === 'dark' && t.kind !== 'dark') return false;
      if (filter === 'light' && t.kind !== 'light') return false;
      if (filter === 'installed' && !installed.some((i) => i.name === t.name)) return false;
      if (q.length > 0) {
        const hay = `${t.name} ${t.publisher} ${t.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [themes, query, filter, installed]);

  const install = async (ref: MarketplaceThemeRef) => {
    setBusyName(ref.name);
    setErrorByName((prev) => {
      const next = { ...prev };
      delete next[ref.name];
      return next;
    });
    try {
      const res = await fetch(ref.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = (await res.json()) as VSCodeColorTheme;
      const monacoTheme = vscodeThemeToMonaco({ ...raw, name: ref.name }, ref.name);
      const nextInstalled = [
        ...installed.filter((t) => t.name !== monacoTheme.name),
        monacoTheme,
      ];
      await store.set(CUSTOM_THEMES_STORE_KEY, nextInstalled);
      const current = (await store.get('editor')) ?? {};
      await store.set('editor', { ...current, theme: ref.name });
    } catch (e) {
      setErrorByName((prev) => ({
        ...prev,
        [ref.name]: e instanceof Error ? e.message : 'Install failed',
      }));
    } finally {
      setBusyName(null);
    }
  };

  const apply = async (ref: MarketplaceThemeRef) => {
    const current = (await store.get('editor')) ?? {};
    await store.set('editor', { ...current, theme: ref.name });
  };

  const uninstall = async (ref: MarketplaceThemeRef) => {
    const next = installed.filter((t) => t.name !== ref.name);
    await store.set(CUSTOM_THEMES_STORE_KEY, next);
    if (activeTheme === ref.name) {
      const current = (await store.get('editor')) ?? {};
      await store.set('editor', { ...current, theme: 'vs-dark' });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.controls}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search themes…"
          placeholderTextColor="#6b7280"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.search}
        />
        <View style={styles.filterRow}>
          {(['all', 'dark', 'light', 'installed'] as const).map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filter === f && styles.filterChipTextActive,
                ]}
              >
                {f}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {filtered.length === 0 ? (
          <Text style={styles.empty}>No themes match your filters.</Text>
        ) : (
          filtered.map((ref) => {
            const isInstalled = installed.some((t) => t.name === ref.name);
            const isActive = activeTheme === ref.name;
            const isBusy = busyName === ref.name;
            const err = errorByName[ref.name];
            return (
              <View
                key={ref.name}
                style={[styles.card, isActive && styles.cardActive]}
              >
                <View style={[styles.swatch, { backgroundColor: ref.swatch.bg }]}>
                  <View style={[styles.swatchStripe, { backgroundColor: ref.swatch.fg }]} />
                  <View style={[styles.swatchStripe, { backgroundColor: ref.swatch.bg }]} />
                  <View style={[styles.swatchStripe, { backgroundColor: ref.swatch.accent }]} />
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardName} numberOfLines={1}>
                      {ref.name}
                    </Text>
                    <Text style={styles.cardKind}>{ref.kind}</Text>
                  </View>
                  <Text style={styles.cardPublisher}>{ref.publisher}</Text>
                  <Text style={styles.cardDesc} numberOfLines={2}>
                    {ref.description}
                  </Text>
                  {err && <Text style={styles.cardError}>{err}</Text>}
                  <View style={styles.cardActions}>
                    {isActive ? (
                      <View style={styles.activePill}>
                        <Text style={styles.activePillText}>● Active</Text>
                      </View>
                    ) : isInstalled ? (
                      <>
                        <Pressable
                          onPress={() => void apply(ref)}
                          style={[styles.btn, styles.btnPrimary]}
                        >
                          <Text style={styles.btnText}>Apply</Text>
                        </Pressable>
                        <Pressable onPress={() => void uninstall(ref)}>
                          <Text style={styles.btnDanger}>Uninstall</Text>
                        </Pressable>
                      </>
                    ) : (
                      <Pressable
                        disabled={isBusy}
                        onPress={() => void install(ref)}
                        style={[styles.btn, styles.btnInstall, isBusy && { opacity: 0.5 }]}
                      >
                        <Text style={styles.btnText}>{isBusy ? 'Installing…' : 'Install'}</Text>
                      </Pressable>
                    )}
                    {ref.homepage && (
                      <Pressable
                        style={styles.sourceLink}
                        onPress={() => {
                          if (ref.homepage) void Linking.openURL(ref.homepage);
                        }}
                      >
                        <Text style={styles.sourceLinkText}>Source ↗</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  titleRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1f2433',
  },
  title: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#9ca3af',
  },
  controls: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1f2433',
  },
  search: {
    backgroundColor: 'rgba(17,24,39,0.7)',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: '#e5e7eb',
    fontSize: 12,
  },
  filterRow: { flexDirection: 'row', gap: 4 },
  filterChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: 'rgba(124,58,237,0.25)',
    borderColor: '#a78bfa',
  },
  filterChipText: { fontSize: 11, color: '#9ca3af', textTransform: 'capitalize' },
  filterChipTextActive: { color: '#ede9fe' },
  list: { padding: 8, gap: 8 },
  empty: { textAlign: 'center', color: '#6b7280', fontSize: 12, paddingVertical: 48 },
  card: {
    flexDirection: 'row',
    gap: 10,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(55,65,81,0.4)',
    backgroundColor: 'rgba(17,24,39,0.4)',
  },
  cardActive: {
    borderColor: 'rgba(167,139,250,0.6)',
    backgroundColor: 'rgba(124,58,237,0.1)',
  },
  swatch: {
    width: 44,
    height: 64,
    borderRadius: 4,
    overflow: 'hidden',
  },
  swatchStripe: { flex: 1 },
  cardBody: { flex: 1, minWidth: 0 },
  cardHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  cardName: { fontSize: 13, fontWeight: '700', color: '#f3f4f6', flex: 1 },
  cardKind: {
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: '#6b7280',
  },
  cardPublisher: { fontSize: 10, color: '#9ca3af' },
  cardDesc: { fontSize: 11, color: '#d1d5db', marginTop: 4 },
  cardError: { fontSize: 10, color: '#fda4af', marginTop: 4 },
  cardActions: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  btnPrimary: { backgroundColor: '#7c3aed' },
  btnInstall: { backgroundColor: '#2563eb' },
  btnText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  btnDanger: { color: '#fda4af', fontSize: 11 },
  activePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: 'rgba(124,58,237,0.3)',
  },
  activePillText: { color: '#ede9fe', fontSize: 10, fontWeight: '600' },
  sourceLink: { marginLeft: 'auto' },
  sourceLinkText: { color: '#6b7280', fontSize: 10 },
});
