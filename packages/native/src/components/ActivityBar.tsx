import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export interface ActivityBarItem {
  id: string;
  label: string;
  /** Already-rendered icon node — consumer passes whatever icon
   * library they like (Ionicons, lucide-react-native, vendor SVG). */
  icon: ReactNode;
  badge?: number;
  disabled?: boolean;
}

interface Props {
  items: ActivityBarItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  bottomItems?: ActivityBarItem[];
  /** Bar width in px. Default 48 — matches VS Code. */
  width?: number;
}

/**
 * React Native equivalent of the web ActivityBar. Same props shape
 * so cross-platform consumers can re-export without touching call
 * sites. Active item gets a 2px accent strip on its left edge.
 */
export function ActivityBar({ items, activeId, onSelect, bottomItems, width = 48 }: Props) {
  const renderItem = (item: ActivityBarItem) => {
    const isActive = item.id === activeId;
    return (
      <Pressable
        key={item.id}
        accessibilityLabel={item.label}
        accessibilityRole="button"
        disabled={item.disabled}
        onPress={() => {
          if (item.disabled) return;
          onSelect(item.id);
        }}
        style={({ pressed }) => [
          styles.item,
          isActive && styles.itemActive,
          pressed && !item.disabled && styles.itemPressed,
        ]}
      >
        {isActive ? <View style={styles.accent} /> : null}
        <View
          style={[
            styles.iconWrap,
            item.disabled && styles.iconDisabled,
            isActive && styles.iconActive,
          ]}
        >
          {item.icon}
        </View>
        {item.badge !== undefined && item.badge > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.badge > 99 ? '99+' : item.badge}</Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { width }]}>
      <View style={styles.section}>{items.map(renderItem)}</View>
      {bottomItems && bottomItems.length > 0 ? (
        <View style={[styles.section, styles.bottomSection]}>
          {bottomItems.map(renderItem)}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0d1117',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#1f2433',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  section: { flexDirection: 'column' },
  bottomSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1f2433',
  },
  item: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  itemActive: {},
  itemPressed: { backgroundColor: 'rgba(255,255,255,0.04)' },
  accent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#ffffff',
  },
  iconWrap: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.55,
  },
  iconActive: { opacity: 1 },
  iconDisabled: { opacity: 0.2 },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#a78bfa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
});
