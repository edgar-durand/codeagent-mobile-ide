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
          // Wrapping the icon in a parent with opacity ≠ 1 hides the
          // glyph entirely on some @expo/vector-icons builds. Tint
          // the row background instead so the icon's own color
          // controls visibility.
          !isActive && !item.disabled && styles.itemInactiveTint,
          item.disabled && styles.itemDisabled,
          pressed && !item.disabled && styles.itemPressed,
        ]}
      >
        {isActive ? <View style={styles.accent} /> : null}
        <View style={styles.iconWrap}>{item.icon}</View>
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
    // Use a 1px border (not hairline) so the bar's right edge is
    // actually visible on Android — hairlineWidth rounds to <1px on
    // high-DPI screens and disappears against the near-identical
    // #0a0d12 main area, leaving the bar visually merged with the
    // editor. Bumping to a brighter tone makes it pop without
    // touching the VS Code look.
    borderRightWidth: 1,
    borderRightColor: '#262c3a',
    flexDirection: 'column',
    justifyContent: 'space-between',
    // Force the bar to occupy the full body height. Without this,
    // RN's `alignItems: stretch` default isn't always honored on
    // Android when the parent is a row flexbox and the child has
    // no flex/height — the bar shrinks to the height of its top
    // section (~144 dp) and the bottom items disappear off-screen
    // for users on phones with shorter viewports.
    alignSelf: 'stretch',
    // Pin the bar's width so a parent flex row can't shrink it to
    // zero. Without these the iOS mobile shell occasionally
    // collapsed the bar to 0 dp once the side panel drawer animated
    // closed (visible bug: "icons disappear when side nav collapses"
    // even though ActivityBar is rendered unconditionally).
    flexShrink: 0,
    flexGrow: 0,
    // Hoist the bar into its own compositor layer above the sibling
    // editor / WebView column AND above the drawer overlay (zIndex 20).
    // On iOS, RN's WebView (used by InlineEditor's Monaco bridge)
    // renders inside a UIView that gets composited over adjacent flex
    // children in the body row, and the drawer's translateX(-280) is
    // applied to the visual frame but the native shadow tree can leak
    // its background paint a frame before settling — the icons are
    // painted but the drawer's surface sits on top of them until RN
    // re-flattens the view tree. Bumping the activity bar's zIndex
    // above the drawer keeps the bar's surface in front from frame 0.
    zIndex: 100,
    elevation: 100,
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
  itemInactiveTint: {},
  itemDisabled: { opacity: 0.3 },
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
  },
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
