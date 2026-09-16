import { StyleSheet, Text } from 'react-native';
import type { GitStatusEntry } from '@codeam/ide-core';

export interface GitStatusChipProps {
  entry: GitStatusEntry;
}

export function chipFor(entry: GitStatusEntry): { label: string; color: string } {
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

export function GitStatusChip({ entry }: GitStatusChipProps) {
  const chip = chipFor(entry);
  return (
    <Text style={[styles.chip, { color: chip.color }]}>{chip.label}</Text>
  );
}

const styles = StyleSheet.create({
  chip: { fontSize: 10, fontWeight: '700', width: 14, textAlign: 'center' },
});
