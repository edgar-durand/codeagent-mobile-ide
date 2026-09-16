import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { GitLogEntry } from '@codeam/ide-core';
import { Ionicons } from '@expo/vector-icons';
import { useIDETheme } from '../theme';

export interface GitGraphSectionProps {
  log: GitLogEntry[] | null;
  graphOpen: boolean;
  onToggleGraph: () => void;
  onReload: () => void;
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

export function GitGraphSection({ log, graphOpen, onToggleGraph, onReload }: GitGraphSectionProps) {
  const theme = useIDETheme();

  return (
    <>
      <View style={[styles.graphHeader, styles.sectionHeader]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Toggle Git graph"
          accessibilityState={{ expanded: graphOpen }}
          onPress={onToggleGraph}
          style={styles.sectionToggle}
        >
          <Text style={styles.chevron}>{graphOpen ? '▾' : '▸'}</Text>
          <Text style={styles.sectionLabel}>Graph</Text>
        </Pressable>
        <View style={styles.actionRow}>
          <Pressable
            onPress={onReload}
            accessibilityRole="button"
            accessibilityLabel="Refresh Git history"
            style={[
              styles.iconBtn,
              { width: theme.minimumTouchSize, height: theme.minimumTouchSize },
            ]}
          >
            <Ionicons name="refresh" size={13} color="#9ca3af" />
          </Pressable>
        </View>
      </View>

      {graphOpen &&
        (log ?? []).map((commit, idx) => (
          <View key={commit.sha} style={styles.commitRow}>
            <Text style={styles.commitDot}>{idx === 0 ? '○' : '●'}</Text>
            <Text
              style={[styles.commitSubject, idx === 0 && styles.commitSubjectHead]}
              numberOfLines={1}
            >
              {commit.subject}
            </Text>
            {commit.refs?.map((r) => (
              <View key={r} style={styles.refPill}>
                <Text style={styles.refPillText}>{r}</Text>
              </View>
            ))}
            <Text style={styles.commitTime}>{timeAgo(commit.timestamp)}</Text>
          </View>
        ))}
    </>
  );
}

const styles = StyleSheet.create({
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
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
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
});
