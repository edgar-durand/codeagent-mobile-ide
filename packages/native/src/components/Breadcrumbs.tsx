import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIDETheme } from '../theme';

interface Props {
  path: string;
  onSegmentClick?: (folderPath: string) => void;
  rootLabel?: string;
  onRootClick?: () => void;
}

/**
 * React Native breadcrumb strip — file path rendered as clickable
 * segments. Horizontally scrollable because deep paths blow the
 * narrow phone width otherwise.
 */
export function Breadcrumbs({ path, onSegmentClick, rootLabel, onRootClick }: Props) {
  const theme = useIDETheme();
  if (!path) return null;
  const segments = path.split('/').filter((s) => s.length > 0);
  if (segments.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel="File path"
      style={[
        styles.container,
        { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border },
      ]}
      contentContainerStyle={styles.content}
    >
      {rootLabel ? (
        <>
          <Pressable
            onPress={onRootClick}
            disabled={!onRootClick}
            accessibilityRole="button"
            accessibilityLabel={`Open ${rootLabel}`}
            accessibilityState={{ disabled: !onRootClick }}
            style={[styles.segment, { minHeight: theme.minimumTouchSize }]}
          >
            <Ionicons name="folder-outline" size={14} color={theme.colors.textMuted} />
            <Text
              style={[
                styles.segmentText,
                { color: theme.colors.textMuted, fontFamily: theme.typography.monoFamily },
              ]}
            >
              {rootLabel}
            </Text>
          </Pressable>
          <Chevron />
        </>
      ) : null}
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        const folderPath = segments.slice(0, i + 1).join('/');
        return (
          <Pressable
            key={folderPath}
            onPress={() => !isLast && onSegmentClick?.(folderPath)}
            disabled={isLast || !onSegmentClick}
            accessibilityRole={isLast ? 'text' : 'button'}
            accessibilityLabel={isLast ? `Current file ${seg}` : `Open folder ${folderPath}`}
            accessibilityState={{ disabled: isLast || !onSegmentClick }}
            style={[styles.segment, { minHeight: theme.minimumTouchSize }]}
          >
            <Text
              style={[
                styles.segmentText,
                { color: theme.colors.textMuted, fontFamily: theme.typography.monoFamily },
                isLast && styles.segmentLeaf,
                isLast && { color: theme.colors.text },
              ]}
            >
              {seg}
            </Text>
            {isLast ? null : <Chevron />}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function Chevron() {
  return <Ionicons name="chevron-forward" size={10} color="#6b7280" style={styles.chevron} />;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0d1117',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1f2433',
    flexGrow: 0,
    minHeight: 44,
  },
  content: { alignItems: 'center', paddingHorizontal: 12, gap: 4 },
  segment: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  segmentText: { fontSize: 11, color: '#9ca3af', fontFamily: 'Menlo' },
  segmentLeaf: { color: '#e5e7eb' },
  chevron: { marginHorizontal: 2 },
});
