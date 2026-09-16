import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { GitLogEntry, GitProvider, GitStatusEntry, GitStatusPayload } from '@codeam/ide-core';
import { useIDETheme } from '../theme';
import { CommitComposer } from './CommitComposer';
import { ChangesList } from './ChangesList';
import { GitGraphSection } from './GitGraphSection';

export { chipFor, GitStatusChip } from './GitStatusChip';

interface Props {
  provider: GitProvider;
  onSelect?: (entry: GitStatusEntry) => void;
  title?: string;
  reloadKey?: string | number;
}

type Row =
  | { kind: 'composer' }
  | { kind: 'changesHeader'; count: number; open: boolean }
  | { kind: 'change'; entry: GitStatusEntry }
  | { kind: 'graphHeader' };

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
    rows.push({ kind: 'graphHeader' });
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
                <CommitComposer
                  message={message}
                  onMessageChange={setMessage}
                  canCommit={canCommit}
                  busy={busy}
                  branchLabel={branchLabel}
                  error={error}
                  ok={ok}
                  onCommit={onCommit}
                />
              );
            }
            if (item.kind === 'change') {
              return (
                <ChangesList entries={[item.entry]} onSelect={onSelect} />
              );
            }
            // graphHeader
            return (
              <GitGraphSection
                log={log}
                graphOpen={graphOpen}
                onToggleGraph={() => setGraphOpen((o) => !o)}
                onReload={reload}
              />
            );
          }}
          ListEmptyComponent={() =>
            statusLoading && status === null ? (
              <View style={styles.empty}>
                <ActivityIndicator size="small" color="#a78bfa" />
                <Text style={styles.emptyText}>Loading status…</Text>
              </View>
            ) : null
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
});
