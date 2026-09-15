import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { GitLogEntry, GitProvider, GitStatusEntry, GitStatusPayload } from '@codeam/ide-core';
import { useIDETheme } from '../theme';

interface Props {
  provider: GitProvider;
  onSelect?: (entry: GitStatusEntry) => void;
  title?: string;
  reloadKey?: string | number;
}

/**
 * Conventional Commits prefix presets — kept byte-identical to the
 * web SourceControlPanel so a future shared abstraction is just a
 * copy-paste removal. Emoji glyphs follow the gitmoji convention
 * for the four most useful types.
 */
const CC_PREFIXES: Array<{ type: string; emoji?: string }> = [
  { type: 'feat', emoji: '✨' },
  { type: 'fix', emoji: '🐛' },
  { type: 'chore' },
  { type: 'docs', emoji: '📝' },
  { type: 'refactor' },
  { type: 'test' },
  { type: 'perf', emoji: '⚡️' },
  { type: 'build' },
  { type: 'ci' },
  { type: 'style' },
  { type: 'revert' },
];

function applyCommitPrefix(current: string, type: string, emoji?: string): string {
  const trimmed = current.trimStart();
  const ccRe = /^[a-z]+(\([^)]+\))?!?:\s*(?:[\u{1F300}-\u{1FAFF}]\s*)?/u;
  const rest = trimmed.replace(ccRe, '');
  const prefix = emoji ? `${type}: ${emoji} ` : `${type}: `;
  return prefix + rest;
}

function chipFor(entry: GitStatusEntry): { label: string; color: string } {
  if (entry.conflict) return { label: 'C', color: '#fb7185' };
  if (entry.code === '??') return { label: 'U', color: '#34d399' };
  const x = entry.code[0];
  const y = entry.code[1];
  if (y === 'M' || x === 'M') return { label: 'M', color: '#fbbf24' };
  if (y === 'D' || x === 'D') return { label: 'D', color: '#fb7185' };
  if (y === 'A' || x === 'A') return { label: 'A', color: '#34d399' };
  if (y === 'R' || x === 'R') return { label: 'R', color: '#60a5fa' };
  return { label: entry.code, color: '#9ca3af' };
}

function timeAgo(ts: number): string {
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo`;
  return `${Math.floor(mo / 12)}y`;
}

type Row =
  | { kind: 'composer' }
  | { kind: 'changesHeader'; count: number; open: boolean }
  | { kind: 'change'; entry: GitStatusEntry }
  | { kind: 'graphHeader'; open: boolean }
  | { kind: 'commit'; commit: GitLogEntry; idx: number };

/**
 * React Native Source Control panel — VS Code parity. Single
 * scrollable list because RN doesn't have CSS grids and stacking
 * fixed-height sections wastes vertical space on phones.
 */
export function SourceControlPanel({ provider, onSelect, title, reloadKey }: Props) {
  const theme = useIDETheme();
  const [status, setStatus] = useState<GitStatusPayload | null>(null);
  const [log, setLog] = useState<GitLogEntry[] | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [logError, setLogError] = useState<string | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);
  const [busy, setBusy] = useState<'commit' | 'push' | 'pull' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [changesOpen, setChangesOpen] = useState(true);
  const [graphOpen, setGraphOpen] = useState(true);
  const providerRef = useRef(provider);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supportsLog = typeof provider.log === 'function';

  useEffect(() => {
    const providerChanged = providerRef.current !== provider;
    providerRef.current = provider;
    if (providerChanged) {
      setStatus(null);
      setLog(null);
    }
    let cancelled = false;
    setStatusLoading(true);
    setStatusError(null);
    setLogError(null);
    provider
      .status()
      .then((p) => {
        if (!cancelled) {
          setStatus(p);
          setStatusError(p.error ?? null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled)
          setStatusError(cause instanceof Error ? cause.message : 'Unable to load Git status.');
      })
      .finally(() => {
        if (!cancelled) setStatusLoading(false);
      });
    if (provider.log) {
      provider
        .log(30)
        .then((entries) => {
          if (!cancelled) setLog(entries);
        })
        .catch((cause: unknown) => {
          if (!cancelled)
            setLogError(cause instanceof Error ? cause.message : 'Unable to load Git history.');
        });
    }
    return () => {
      cancelled = true;
    };
  }, [provider, reloadKey, reloadCounter]);

  useEffect(
    () => () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    },
    [],
  );

  const reload = () => setReloadCounter((c) => c + 1);
  const flash = (kind: 'ok' | 'err', text: string) => {
    if (flashTimerRef.current) {
      clearTimeout(flashTimerRef.current);
      flashTimerRef.current = null;
    }
    if (kind === 'ok') {
      setOk(text);
      setError(null);
      flashTimerRef.current = setTimeout(() => {
        setOk(null);
        flashTimerRef.current = null;
      }, 2500);
    } else {
      setError(text);
      setOk(null);
    }
  };

  const onCommit = async () => {
    if (!message.trim()) {
      flash('err', 'Commit message is required.');
      return;
    }
    setBusy('commit');
    try {
      const r = await providerRef.current.commit({ message: message.trim(), all: true });
      if ('error' in r) flash('err', r.error);
      else {
        flash('ok', `Committed ${r.sha.slice(0, 7)}`);
        setMessage('');
        reload();
      }
    } catch (cause) {
      flash('err', cause instanceof Error ? cause.message : 'Commit failed.');
    } finally {
      setBusy(null);
    }
  };

  const onPush = async () => {
    setBusy('push');
    try {
      const r = await providerRef.current.push();
      if ('error' in r) flash('err', r.error);
      else {
        flash('ok', 'Pushed.');
        reload();
      }
    } catch (cause) {
      flash('err', cause instanceof Error ? cause.message : 'Push failed.');
    } finally {
      setBusy(null);
    }
  };

  const onPull = async () => {
    setBusy('pull');
    try {
      const pull = providerRef.current.pull;
      const r = pull ? await pull.call(providerRef.current) : await providerRef.current.fetch();
      if ('error' in r) flash('err', r.error);
      else {
        flash('ok', pull ? 'Pulled.' : 'Fetched (manual merge required).');
        reload();
      }
    } catch (cause) {
      flash('err', cause instanceof Error ? cause.message : 'Pull failed.');
    } finally {
      setBusy(null);
    }
  };

  const entries = status?.entries ?? [];
  const canCommit = entries.length > 0 && message.trim().length > 0 && busy === null;
  const branchLabel = status?.branch ?? 'main';

  const rows: Row[] = [];
  rows.push({ kind: 'changesHeader', count: entries.length, open: changesOpen });
  if (changesOpen) {
    rows.push({ kind: 'composer' });
    for (const e of entries) rows.push({ kind: 'change', entry: e });
  }
  if (supportsLog) {
    rows.push({ kind: 'graphHeader', open: graphOpen });
    if (graphOpen) (log ?? []).forEach((c, idx) => rows.push({ kind: 'commit', commit: c, idx }));
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title ?? 'Source Control'}</Text>
      </View>

      {statusError ? (
        <View style={styles.errorBanner} accessibilityRole="alert">
          <Text style={styles.errorBannerText}>{statusError}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry Git status"
            onPress={reload}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : statusLoading ? (
        <View style={styles.refreshingRow} accessibilityRole="progressbar">
          <ActivityIndicator size="small" color={theme.colors.accent} />
          <Text style={styles.refreshingText}>
            {status === null ? 'Loading status…' : 'Refreshing status…'}
          </Text>
        </View>
      ) : null}

      {status === null ? null : (
        <FlatList
          data={rows}
          keyExtractor={(r, i) => {
            if (r.kind === 'change') return `change:${r.entry.path}:${r.entry.code}`;
            if (r.kind === 'commit') return `commit:${r.commit.sha}`;
            return `${r.kind}:${i}`;
          }}
          renderItem={({ item }) => {
            if (item.kind === 'changesHeader') {
              return (
                <View style={styles.sectionHeader}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Toggle changes"
                    accessibilityState={{ expanded: item.open }}
                    onPress={() => setChangesOpen((o) => !o)}
                    style={styles.sectionToggle}
                  >
                    <Text style={styles.chevron}>{item.open ? '▾' : '▸'}</Text>
                    <Text style={styles.sectionLabel}>Changes</Text>
                    {item.count > 0 ? (
                      <View style={styles.countPill}>
                        <Text style={styles.countText}>{item.count}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                  <View style={styles.actionRow}>
                    <IconBtn
                      name="checkmark"
                      label="Commit changes"
                      disabled={!canCommit}
                      onPress={() => void onCommit()}
                    />
                    <IconBtn
                      name="arrow-down"
                      label="Pull changes"
                      disabled={busy !== null || !status?.upstream}
                      onPress={() => void onPull()}
                    />
                    <IconBtn
                      name="arrow-up"
                      label="Push changes"
                      disabled={busy !== null || !status?.upstream}
                      onPress={() => void onPush()}
                    />
                    <IconBtn name="refresh" label="Refresh Git status" onPress={reload} />
                  </View>
                </View>
              );
            }
            if (item.kind === 'composer') {
              return (
                <View style={styles.composer}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.prefixRow}
                  >
                    {CC_PREFIXES.map((p) => (
                      <Pressable
                        key={p.type}
                        onPress={() =>
                          setMessage((prev) => applyCommitPrefix(prev, p.type, p.emoji))
                        }
                        style={({ pressed }) => [
                          styles.prefixChip,
                          pressed && styles.prefixChipPressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Use ${p.type} commit prefix`}
                      >
                        <Text style={styles.prefixChipText}>
                          {p.emoji ? `${p.emoji} ` : ''}
                          {p.type}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <TextInput
                    value={message}
                    onChangeText={setMessage}
                    placeholder={`Message (commit on "${branchLabel}")`}
                    placeholderTextColor="#6b7280"
                    style={styles.composerInput}
                    multiline={false}
                    returnKeyType="send"
                    onSubmitEditing={() => {
                      if (canCommit) void onCommit();
                    }}
                    accessibilityLabel="Commit message"
                  />
                  <View style={styles.commitBtnRow}>
                    <Pressable
                      disabled={!canCommit}
                      onPress={onCommit}
                      style={[styles.commitBtn, !canCommit && styles.commitBtnDisabled]}
                      accessibilityRole="button"
                      accessibilityLabel="Commit changes"
                      accessibilityState={{ disabled: !canCommit, busy: busy === 'commit' }}
                    >
                      <Ionicons name="checkmark" size={13} color="#fff" />
                      <Text style={styles.commitBtnText}>
                        {busy === 'commit' ? 'Committing…' : 'Commit'}
                      </Text>
                    </Pressable>
                  </View>
                  {error || ok ? (
                    <View style={[styles.flash, error ? styles.flashErr : styles.flashOk]}>
                      <Text
                        style={[styles.flashText, error ? styles.flashErrText : styles.flashOkText]}
                      >
                        {error ?? ok}
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            }
            if (item.kind === 'change') {
              const chip = chipFor(item.entry);
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${item.entry.path}, status ${chip.label}`}
                  disabled={!onSelect}
                  onPress={() => onSelect?.(item.entry)}
                  style={styles.changeRow}
                >
                  <Text style={styles.changeName} numberOfLines={1}>
                    {item.entry.path.split('/').pop()}
                  </Text>
                  <Text style={styles.changeDir} numberOfLines={1}>
                    {item.entry.path.replace(/\/[^/]+$/, '')}
                  </Text>
                  <Text style={[styles.changeChip, { color: chip.color }]}>{chip.label}</Text>
                </Pressable>
              );
            }
            if (item.kind === 'graphHeader') {
              return (
                <View style={[styles.sectionHeader, styles.graphHeader]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Toggle Git graph"
                    accessibilityState={{ expanded: item.open }}
                    onPress={() => setGraphOpen((o) => !o)}
                    style={styles.sectionToggle}
                  >
                    <Text style={styles.chevron}>{item.open ? '▾' : '▸'}</Text>
                    <Text style={styles.sectionLabel}>Graph</Text>
                  </Pressable>
                  <View style={styles.actionRow}>
                    <IconBtn name="refresh" label="Refresh Git history" onPress={reload} />
                  </View>
                </View>
              );
            }
            // commit row
            return (
              <View style={styles.commitRow}>
                <Text style={styles.commitDot}>{item.idx === 0 ? '○' : '●'}</Text>
                <Text
                  style={[styles.commitSubject, item.idx === 0 && styles.commitSubjectHead]}
                  numberOfLines={1}
                >
                  {item.commit.subject}
                </Text>
                {item.commit.refs?.map((r) => (
                  <View key={r} style={styles.refPill}>
                    <Text style={styles.refPillText}>{r}</Text>
                  </View>
                ))}
                <Text style={styles.commitTime}>{timeAgo(item.commit.timestamp)}</Text>
              </View>
            );
          }}
          ListEmptyComponent={() =>
            statusLoading && status === null ? (
              <View style={styles.empty}>
                <ActivityIndicator size="small" color="#a78bfa" />
                <Text style={styles.emptyText}>Loading status…</Text>
              </View>
            ) : statusError ? null : null
          }
          ListFooterComponent={() =>
            logError ? (
              <View style={styles.logError} accessibilityRole="alert">
                <Text style={styles.errorBannerText}>{logError}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Retry Git history"
                  onPress={reload}
                  style={styles.retryButton}
                >
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

function IconBtn({
  name,
  label,
  onPress,
  disabled,
}: {
  name: 'checkmark' | 'refresh' | 'ellipsis-horizontal' | 'arrow-up' | 'arrow-down';
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const theme = useIDETheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={[
        styles.iconBtn,
        { width: theme.minimumTouchSize, height: theme.minimumTouchSize },
        disabled && styles.iconBtnDisabled,
      ]}
    >
      <Ionicons name={name} size={13} color="#9ca3af" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  title: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#9ca3af',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    minHeight: 44,
  },
  graphHeader: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1f2433',
    marginTop: 8,
  },
  sectionToggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chevron: { width: 12, fontSize: 10, color: '#6b7280' },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#e5e7eb',
  },
  countPill: {
    backgroundColor: '#374151',
    borderRadius: 9,
    paddingHorizontal: 6,
    paddingVertical: 0,
    marginLeft: 4,
  },
  countText: { fontSize: 10, color: '#e5e7eb', fontWeight: '700' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  iconBtnDisabled: { opacity: 0.3 },

  composer: { paddingHorizontal: 12, paddingTop: 8, gap: 8 },
  composerInput: {
    backgroundColor: 'rgba(17,24,39,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.4)',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
    color: '#e5e7eb',
    fontFamily: 'Menlo',
  },
  commitBtnRow: {
    flexDirection: 'row',
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.4)',
  },
  commitBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(124,58,237,0.85)',
    paddingVertical: 7,
  },
  commitBtnDisabled: { opacity: 0.4 },
  commitBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  flash: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1 },
  flashOk: { backgroundColor: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.3)' },
  flashErr: { backgroundColor: 'rgba(244,63,94,0.1)', borderColor: 'rgba(244,63,94,0.3)' },
  flashText: { fontSize: 11, fontFamily: 'Menlo' },
  flashOkText: { color: '#a7f3d0' },
  flashErrText: { color: '#fecaca' },

  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    minHeight: 44,
    gap: 6,
  },
  changeName: { fontSize: 12, color: '#e5e7eb', fontFamily: 'Menlo', flex: 1 },
  changeDir: { fontSize: 10, color: '#6b7280', maxWidth: '40%' },
  changeChip: { fontSize: 10, fontWeight: '700', width: 14, textAlign: 'center' },

  commitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    minHeight: 44,
    gap: 6,
  },
  commitDot: { width: 12, fontSize: 12, color: '#60a5fa', textAlign: 'center' },
  commitSubject: { flex: 1, fontSize: 12, color: '#d1d5db', fontFamily: 'Menlo' },
  commitSubjectHead: { color: '#fff', fontWeight: '600' },
  refPill: {
    backgroundColor: 'rgba(167,139,250,0.2)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(167,139,250,0.3)',
  },
  refPillText: { fontSize: 9, color: '#ede9fe', fontFamily: 'Menlo' },
  commitTime: { fontSize: 10, color: '#6b7280' },

  empty: { padding: 24, alignItems: 'center', gap: 6 },
  emptyText: { fontSize: 11, color: '#6b7280' },
  errorText: { padding: 24, textAlign: 'center', color: '#fb7185', fontSize: 12 },
  errorBanner: {
    minHeight: 44,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(244,63,94,0.1)',
  },
  logError: {
    minHeight: 44,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorBannerText: { flex: 1, color: '#fecaca', fontSize: 11 },
  retryButton: { minWidth: 64, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  retryText: { color: '#c4b5fd', fontSize: 12, fontWeight: '600' },
  refreshingRow: {
    minHeight: 44,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshingText: { color: '#9ca3af', fontSize: 11 },
  prefixRow: { gap: 4, paddingBottom: 6, paddingRight: 8 },
  prefixChip: {
    paddingHorizontal: 6,
    minHeight: 44,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: 'rgba(17,24,39,0.6)',
  },
  prefixChipPressed: { backgroundColor: 'rgba(124,58,237,0.25)', borderColor: '#a78bfa' },
  prefixChipText: { fontSize: 10, color: '#d1d5db', fontFamily: 'Menlo' },
});
