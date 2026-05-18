import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  acceptBoth,
  acceptCurrent,
  acceptIncoming,
  applyConflictResolutionAll,
  detectConflicts,
  type ConflictHunk,
} from '@codeam/ide-core';

interface Props {
  content: string;
  onResolved: (next: string) => void;
  currentLabel?: (hunk: ConflictHunk) => string;
  incomingLabel?: (hunk: ConflictHunk) => string;
}

/**
 * Native conflict-resolution banner. Same contract as the web
 * version — `content` in, resolved file body out via `onResolved`.
 * Renders nothing when there are no merge markers.
 *
 * The per-hunk buttons are placed in a horizontal scroll so long
 * label combinations (e.g. branch names) don't wrap and break the
 * one-row layout on narrow phones.
 */
export function ConflictBanner({
  content,
  onResolved,
  currentLabel,
  incomingLabel,
}: Props) {
  const hunks = useMemo(() => detectConflicts(content), [content]);
  if (hunks.length === 0) return null;

  const resolveAll = (side: 'current' | 'incoming' | 'both') => {
    onResolved(applyConflictResolutionAll(content, side));
  };

  const resolveHunk = (hunk: ConflictHunk, side: 'current' | 'incoming' | 'both') => {
    const next =
      side === 'current'
        ? acceptCurrent(content, hunk)
        : side === 'incoming'
          ? acceptIncoming(content, hunk)
          : acceptBoth(content, hunk);
    onResolved(next);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerText}>
          ⚠ {hunks.length} merge conflict{hunks.length === 1 ? '' : 's'}
        </Text>
        <View style={styles.headerBtns}>
          <Pressable onPress={() => resolveAll('current')} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>All current</Text>
          </Pressable>
          <Pressable onPress={() => resolveAll('incoming')} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>All incoming</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView style={styles.list}>
        {hunks.map((h, idx) => (
          <View key={`${h.startLine}-${h.endLine}-${idx}`} style={styles.hunkRow}>
            <Text style={styles.hunkLabel}>
              L{h.startLine + 1}–{h.endLine + 1}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.hunkBtns}>
                <Pressable
                  onPress={() => resolveHunk(h, 'current')}
                  style={[styles.hunkBtn, styles.hunkBtnCurrent]}
                >
                  <Text style={styles.hunkBtnText}>
                    Current {currentLabel ? currentLabel(h) : h.currentLabel}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => resolveHunk(h, 'incoming')}
                  style={[styles.hunkBtn, styles.hunkBtnIncoming]}
                >
                  <Text style={styles.hunkBtnText}>
                    Incoming {incomingLabel ? incomingLabel(h) : h.incomingLabel}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => resolveHunk(h, 'both')}
                  style={[styles.hunkBtn, styles.hunkBtnBoth]}
                >
                  <Text style={styles.hunkBtnText}>Both</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(120,53,15,0.45)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245,158,11,0.45)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  headerText: { color: '#fde68a', fontSize: 12, fontWeight: '600' },
  headerBtns: { flexDirection: 'row', gap: 6 },
  headerBtn: {
    backgroundColor: 'rgba(180,83,9,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  headerBtnText: { color: '#fef3c7', fontSize: 10 },
  list: { maxHeight: 140, paddingHorizontal: 10, paddingBottom: 6 },
  hunkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  hunkLabel: { color: '#fde68a', fontSize: 10, width: 56 },
  hunkBtns: { flexDirection: 'row', gap: 4 },
  hunkBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  hunkBtnCurrent: { backgroundColor: 'rgba(4,120,87,0.45)' },
  hunkBtnIncoming: { backgroundColor: 'rgba(3,105,161,0.45)' },
  hunkBtnBoth: { backgroundColor: 'rgba(109,40,217,0.45)' },
  hunkBtnText: { color: '#fff', fontSize: 10 },
});
