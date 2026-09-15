import { useMemo, useRef, useState, type ReactNode } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { useIDETheme } from '../theme';

interface Props {
  direction?: 'vertical' | 'horizontal';
  children: [ReactNode, ReactNode];
  initialSecondSize?: number;
  minSecondSize?: number;
  maxSecondSize?: number;
  handleTitle?: string;
  handleActions?: ReactNode;
  collapsed?: boolean;
  onCollapseToggle?: () => void;
}

/**
 * Resizable two-region splitter for React Native. Designed for the
 * IDE bottom-terminal pattern. The drag handle uses PanResponder
 * so it works the same on iOS, Android and Expo Web.
 */
export function SplitPane({
  direction = 'vertical',
  children,
  initialSecondSize = 220,
  minSecondSize = 80,
  maxSecondSize = 1200,
  handleTitle,
  handleActions,
  collapsed,
  onCollapseToggle,
}: Props) {
  const theme = useIDETheme();
  const [size, setSize] = useState(initialSecondSize);
  const dragStart = useRef(initialSecondSize);
  const isVertical = direction === 'vertical';

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !collapsed,
        onMoveShouldSetPanResponder: () => !collapsed,
        onPanResponderGrant: () => {
          dragStart.current = size;
        },
        onPanResponderMove: (_e, gesture) => {
          const delta = isVertical ? -gesture.dy : -gesture.dx;
          const next = Math.max(minSecondSize, Math.min(maxSecondSize, dragStart.current + delta));
          setSize(next);
        },
      }),
    [collapsed, isVertical, maxSecondSize, minSecondSize, size],
  );

  const secondPx = collapsed ? 0 : size;

  return (
    <View style={[styles.container, isVertical ? styles.containerCol : styles.containerRow]}>
      <View style={[styles.first, isVertical ? styles.firstCol : styles.firstRow]}>
        {children[0]}
      </View>
      <View
        {...panResponder.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={handleTitle ?? 'Resize pane'}
        accessibilityValue={{ min: minSecondSize, max: maxSecondSize, now: secondPx }}
        accessibilityActions={[
          { name: 'increment', label: 'Make pane larger' },
          { name: 'decrement', label: 'Make pane smaller' },
        ]}
        onAccessibilityAction={({ nativeEvent }) => {
          const delta = nativeEvent.actionName === 'increment' ? 24 : -24;
          setSize((current) => Math.max(minSecondSize, Math.min(maxSecondSize, current + delta)));
        }}
        style={[
          isVertical ? styles.handleV : styles.handleH,
          { backgroundColor: theme.colors.surfaceRaised },
        ]}
      >
        {isVertical ? (
          <View style={styles.handleRow}>
            <Pressable
              onPress={onCollapseToggle}
              disabled={!onCollapseToggle}
              accessibilityRole="button"
              accessibilityLabel={`${collapsed ? 'Expand' : 'Collapse'} ${handleTitle ?? 'bottom pane'}`}
              accessibilityState={{ expanded: !collapsed, disabled: !onCollapseToggle }}
              style={{ minHeight: theme.minimumTouchSize, justifyContent: 'center' }}
            >
              <Text style={[styles.handleTitle, { color: theme.colors.textMuted }]}>
                {collapsed ? '▸ ' : '▾ '}
                {handleTitle ?? 'Bottom Pane'}
              </Text>
            </Pressable>
            {handleActions ? <View style={styles.handleActions}>{handleActions}</View> : null}
          </View>
        ) : null}
      </View>
      <View
        style={
          isVertical
            ? { height: secondPx, overflow: 'hidden' }
            : { width: secondPx, overflow: 'hidden' }
        }
      >
        {collapsed ? null : children[1]}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0, minWidth: 0 },
  containerCol: { flexDirection: 'column' },
  containerRow: { flexDirection: 'row' },
  first: { minHeight: 0, minWidth: 0, flex: 1 },
  firstCol: { flexDirection: 'column' },
  firstRow: { flexDirection: 'row' },
  handleV: {
    minHeight: 44,
    backgroundColor: '#161b22',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1f2433',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1f2433',
    justifyContent: 'center',
  },
  handleH: {
    width: 12,
    backgroundColor: '#161b22',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: '#1f2433',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#1f2433',
  },
  handleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  handleTitle: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#6b7280',
  },
  handleActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
