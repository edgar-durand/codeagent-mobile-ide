import { Pressable, StyleSheet, Text } from 'react-native';
import type { GitStatusEntry } from '@codeam/ide-core';
import { chipFor } from './GitStatusChip';

export interface ChangesListProps {
  entries: readonly GitStatusEntry[];
  onSelect?: (entry: GitStatusEntry) => void;
}

export function ChangesList({ entries, onSelect }: ChangesListProps) {
  return (
    <>
      {entries.map((entry) => {
        const chip = chipFor(entry);
        return (
          <Pressable
            key={`${entry.path}:${entry.code}`}
            accessibilityRole="button"
            accessibilityLabel={`${entry.path}, status ${chip.label}`}
            disabled={!onSelect}
            onPress={() => onSelect?.(entry)}
            style={styles.changeRow}
          >
            <Text style={styles.changeName} numberOfLines={1}>
              {entry.path.split('/').pop()}
            </Text>
            <Text style={styles.changeDir} numberOfLines={1}>
              {entry.path.replace(/\/[^/]+$/, '')}
            </Text>
            <Text style={[styles.changeChip, { color: chip.color }]}>{chip.label}</Text>
          </Pressable>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
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
});
