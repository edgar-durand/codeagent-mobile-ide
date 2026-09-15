import { useState, type ReactNode } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useIDETheme } from '../theme';

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
  /** Same contract as the web TabsBar. Surfaced via long-press on
   * the tab (no native right-click). */
  onBulkClose?: (op: 'others' | 'right' | 'all', anchorId: string) => void;
  rightActions?: ReactNode;
}

/**
 * React Native editor-tabs strip. Same prop shape as the web
 * TabsBar so cross-platform consumers can swap import paths.
 * Horizontally scrollable; closing a tab shows the X button on
 * press-and-hold (mobile-friendlier than VS Code's hover-only X).
 */
export function TabsBar({ tabs, activeId, onSelect, onClose, onBulkClose, rightActions }: Props) {
  const theme = useIDETheme();
  const [menuTabId, setMenuTabId] = useState<string | null>(null);
  const requestClose = (tab: EditorTab) => {
    if (!tab.dirty) {
      onClose(tab.id);
      return;
    }
    Alert.alert('Discard unsaved changes?', `${tab.label} has changes that have not been saved.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => onClose(tab.id) },
    ]);
  };
  const requestBulkClose = (op: 'others' | 'right' | 'all', anchorId: string) => {
    if (!onBulkClose) return;
    const anchorIndex = tabs.findIndex((tab) => tab.id === anchorId);
    const affected = tabs.filter((tab, index) => {
      if (op === 'all') return true;
      if (op === 'others') return tab.id !== anchorId;
      return index > anchorIndex;
    });
    const run = () => onBulkClose(op, anchorId);
    if (!affected.some((tab) => tab.dirty)) {
      run();
      return;
    }
    Alert.alert(
      'Discard unsaved changes?',
      'One or more affected tabs have changes that have not been saved.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: run },
      ],
    );
  };
  if (tabs.length === 0 && !rightActions) return null;
  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.container,
        { backgroundColor: theme.colors.surfaceRaised, borderBottomColor: theme.colors.border },
      ]}
    >
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
              accessibilityRole="tab"
              accessibilityLabel={t.label}
              accessibilityState={{ selected: isActive }}
              onPress={() => onSelect(t.id)}
              onLongPress={() => {
                if (onBulkClose) setMenuTabId(t.id);
              }}
              delayLongPress={350}
              style={({ pressed }) => [
                styles.tab,
                { minHeight: theme.minimumTouchSize, borderRightColor: theme.colors.border },
                isActive && [styles.tabActive, { backgroundColor: theme.colors.surface }],
                pressed && !isActive && styles.tabPressed,
              ]}
            >
              {t.icon ? <View style={styles.tabIcon}>{t.icon}</View> : null}
              <Text
                style={[
                  styles.tabLabel,
                  { color: theme.colors.textMuted, fontFamily: theme.typography.monoFamily },
                  isActive && [styles.tabLabelActive, { color: theme.colors.text }],
                  t.preview && styles.tabLabelPreview,
                ]}
                numberOfLines={1}
              >
                {t.label}
              </Text>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  requestClose(t);
                }}
                hitSlop={6}
                style={styles.closeBtn}
                accessibilityLabel={`Close ${t.label}`}
                accessibilityRole="button"
                accessibilityHint={t.dirty ? 'Unsaved changes; confirmation required' : undefined}
              >
                {t.dirty ? (
                  <View style={[styles.dirtyDot, { backgroundColor: theme.colors.warning }]} />
                ) : (
                  <Text style={[styles.closeX, { color: theme.colors.textMuted }]}>×</Text>
                )}
              </Pressable>
            </Pressable>
          );
        })}
      </ScrollView>
      {rightActions ? <View style={styles.rightActions}>{rightActions}</View> : null}
      <Modal
        visible={menuTabId !== null && !!onBulkClose}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuTabId(null)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close tab actions"
          style={[styles.menuBackdrop, { backgroundColor: theme.colors.overlay }]}
          onPress={() => setMenuTabId(null)}
        >
          <View
            accessibilityRole="menu"
            style={[
              styles.menuCard,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
            pointerEvents="box-none"
          >
            <MenuRow
              label="Close"
              onPress={() => {
                const tab = tabs.find((candidate) => candidate.id === menuTabId);
                if (tab) requestClose(tab);
                setMenuTabId(null);
              }}
            />
            <MenuRow
              label="Close others"
              onPress={() => {
                if (menuTabId) requestBulkClose('others', menuTabId);
                setMenuTabId(null);
              }}
            />
            <MenuRow
              label="Close to the right"
              onPress={() => {
                if (menuTabId) requestBulkClose('right', menuTabId);
                setMenuTabId(null);
              }}
            />
            <MenuRow
              label="Close all"
              onPress={() => {
                if (menuTabId) requestBulkClose('all', menuTabId);
                setMenuTabId(null);
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function MenuRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="menuitem"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
    >
      <Text style={styles.menuRowText}>{label}</Text>
    </Pressable>
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
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuCard: {
    backgroundColor: '#0d1117',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#262c3a',
    minWidth: 220,
    paddingVertical: 4,
  },
  menuRow: { paddingHorizontal: 14, paddingVertical: 10 },
  menuRowPressed: { backgroundColor: 'rgba(124,58,237,0.2)' },
  menuRowText: { color: '#e5e7eb', fontSize: 13 },
});
