import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export interface EditorTab {
  id: string;
  label: string;
  icon?: ReactNode;
  dirty?: boolean;
  preview?: boolean;
}

interface Props {
  tabs: EditorTab[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  rightActions?: ReactNode;
}

/**
 * React Native editor-tabs strip. Same prop shape as the web
 * TabsBar so cross-platform consumers can swap import paths.
 * Horizontally scrollable; closing a tab shows the X button on
 * press-and-hold (mobile-friendlier than VS Code's hover-only X).
 */
export function TabsBar({ tabs, activeId, onSelect, onClose, rightActions }: Props) {
  if (tabs.length === 0 && !rightActions) return null;
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {tabs.map((t) => {
          const isActive = t.id === activeId;
          return (
            <Pressable
              key={t.id}
              onPress={() => onSelect(t.id)}
              style={({ pressed }) => [
                styles.tab,
                isActive && styles.tabActive,
                pressed && !isActive && styles.tabPressed,
              ]}
            >
              {t.icon ? <View style={styles.tabIcon}>{t.icon}</View> : null}
              <Text
                style={[
                  styles.tabLabel,
                  isActive && styles.tabLabelActive,
                  t.preview && styles.tabLabelPreview,
                ]}
                numberOfLines={1}
              >
                {t.label}
              </Text>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  onClose(t.id);
                }}
                hitSlop={6}
                style={styles.closeBtn}
                accessibilityLabel={`Close ${t.label}`}
              >
                {t.dirty ? <View style={styles.dirtyDot} /> : <Text style={styles.closeX}>×</Text>}
              </Pressable>
            </Pressable>
          );
        })}
      </ScrollView>
      {rightActions ? <View style={styles.rightActions}>{rightActions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#161b22',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1f2433',
    height: 36,
  },
  scrollContent: { alignItems: 'stretch' },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#1f2433',
    maxWidth: 200,
    gap: 8,
  },
  tabActive: { backgroundColor: '#0d1117' },
  tabPressed: { backgroundColor: 'rgba(255,255,255,0.04)' },
  tabIcon: {},
  tabLabel: {
    fontSize: 12,
    color: '#9ca3af',
    fontFamily: 'Menlo',
    maxWidth: 120,
  },
  tabLabelActive: { color: '#ffffff' },
  tabLabelPreview: { fontStyle: 'italic' },
  closeBtn: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    marginLeft: 4,
  },
  closeX: { color: '#9ca3af', fontSize: 16, lineHeight: 16 },
  dirtyDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fbbf24' },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: '#1f2433',
    gap: 4,
  },
});
