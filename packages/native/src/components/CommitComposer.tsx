import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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

export interface CommitComposerProps {
  message: string;
  onMessageChange: (value: string) => void;
  canCommit: boolean;
  busy: 'commit' | 'push' | 'pull' | null;
  branchLabel: string;
  error: string | null;
  ok: string | null;
  onCommit: () => void;
}

export function CommitComposer({
  message,
  onMessageChange,
  canCommit,
  busy,
  branchLabel,
  error,
  ok,
  onCommit,
}: CommitComposerProps) {
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
            onPress={() => onMessageChange(applyCommitPrefix(message, p.type, p.emoji))}
            style={({ pressed }) => [styles.prefixChip, pressed && styles.prefixChipPressed]}
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
        onChangeText={onMessageChange}
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
          <Text style={styles.commitBtnText}>{busy === 'commit' ? 'Committing…' : 'Commit'}</Text>
        </Pressable>
      </View>
      {error || ok ? (
        <View style={[styles.flash, error ? styles.flashErr : styles.flashOk]}>
          <Text style={[styles.flashText, error ? styles.flashErrText : styles.flashOkText]}>
            {error ?? ok}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
