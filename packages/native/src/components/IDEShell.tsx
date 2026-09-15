import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Animated, AccessibilityInfo, Dimensions, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityBar, type ActivityBarItem } from './ActivityBar';
import { useIDETheme } from '../theme';

interface IDEShellProps {
  activityItems: ActivityBarItem[];
  activityBottomItems?: ActivityBarItem[];
  activeView: string | null;
  onViewChange: (id: string | null) => void;
  panels: Record<string, ReactNode>;
  children: ReactNode;
  titleBar?: ReactNode;
  statusBar?: ReactNode;
  /** Side panel width on phones in landscape / tablets. Default 280. */
  sidePanelWidth?: number;
  /** Viewport width (px) below which the side panel becomes a
   * drawer overlay. Default 600 — phones in portrait. */
  mobileBreakpoint?: number;
  /** Apply device safe-area padding around the complete IDE shell. Default true. */
  respectSafeArea?: boolean;
  /** Maximum inactive panels retained in memory. Default 6. */
  maxMountedPanels?: number;
}

/**
 * React Native composite IDE shell — title bar (optional) + activity
 * bar + side panel + main content + optional status bar. Tracks
 * viewport width via the `Dimensions` API and toggles between
 * "drawer overlay" and "inline panel" layouts at `mobileBreakpoint`.
 *
 * Inactive panels stay mounted with `display: 'none'` so internal
 * state (scroll, expand, query) survives activity-bar switches —
 * same behaviour as the web IDEShell.
 */
export function IDEShell({
  activityItems,
  activityBottomItems,
  activeView,
  onViewChange,
  panels,
  children,
  titleBar,
  statusBar,
  sidePanelWidth = 280,
  mobileBreakpoint = 600,
  respectSafeArea = true,
  maxMountedPanels = 6,
}: IDEShellProps) {
  const theme = useIDETheme();
  const insets = useSafeAreaInsets();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [width, setWidth] = useState(() => Dimensions.get('window').width);
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setWidth(window.width));
    return () => sub.remove();
  }, []);
  const isMobile = width < mobileBreakpoint;
  const effectivePanelWidth = Math.min(sidePanelWidth, Math.max(200, width - 92));

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  const handleSelect = (id: string) => {
    if (id === activeView) onViewChange(null);
    else onViewChange(id);
  };

  // Track every panel that has been activated so we can keep it
  // mounted. Same trick as the web shell.
  const [mounted, setMounted] = useState<Set<string>>(() =>
    activeView ? new Set([activeView]) : new Set(),
  );
  useEffect(() => {
    if (!activeView) return;
    setMounted((prev) => {
      const next = new Set(prev);
      // Refresh insertion order so the set doubles as a small LRU.
      next.delete(activeView);
      next.add(activeView);
      while (next.size > Math.max(1, maxMountedPanels)) {
        const oldest = next.values().next().value as string | undefined;
        if (!oldest) break;
        next.delete(oldest);
      }
      return next;
    });
  }, [activeView, maxMountedPanels]);

  const persistentPanels = useMemo(
    () =>
      Array.from(mounted)
        .filter((id) => panels[id] !== undefined)
        .sort(),
    [mounted, panels],
  );
  const panelOpen = activeView !== null && mounted.has(activeView);

  // Drawer slide animation on mobile.
  const slide = useState(() => new Animated.Value(panelOpen ? 0 : -effectivePanelWidth))[0];
  useEffect(() => {
    Animated.timing(slide, {
      toValue: panelOpen ? 0 : -effectivePanelWidth,
      duration: reduceMotion ? 0 : 150,
      useNativeDriver: true,
    }).start();
  }, [effectivePanelWidth, panelOpen, reduceMotion, slide]);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.canvas },
        respectSafeArea && { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      {titleBar ? <View>{titleBar}</View> : null}

      <View style={styles.body}>
        <ActivityBar
          items={activityItems}
          activeId={activeView}
          onSelect={handleSelect}
          bottomItems={activityBottomItems}
        />

        {isMobile ? (
          <>
            {/* Main area always takes full remaining width on mobile */}
            <View style={styles.main}>{children}</View>
            {/* Drawer overlay */}
            {panelOpen ? (
              <Pressable
                accessibilityLabel="Close panel"
                accessibilityRole="button"
                accessibilityHint="Closes the navigation drawer"
                onPress={() => onViewChange(null)}
                style={[styles.backdrop, { backgroundColor: theme.colors.overlay }]}
              />
            ) : null}
            <Animated.View
              pointerEvents={panelOpen ? 'auto' : 'none'}
              style={[
                styles.drawer,
                {
                  width: effectivePanelWidth,
                  backgroundColor: theme.colors.surface,
                  borderRightColor: theme.colors.border,
                  transform: [{ translateX: slide }],
                },
              ]}
            >
              {persistentPanels.map((id) => (
                <View key={id} style={{ flex: 1, display: id === activeView ? 'flex' : 'none' }}>
                  {panels[id]}
                </View>
              ))}
            </Animated.View>
          </>
        ) : (
          <>
            <View
              style={[
                styles.inlinePanel,
                {
                  width: panelOpen ? effectivePanelWidth : 0,
                  borderRightWidth: panelOpen ? StyleSheet.hairlineWidth : 0,
                },
              ]}
            >
              {persistentPanels.map((id) => (
                <View
                  key={id}
                  style={{
                    flex: 1,
                    display: id === activeView ? 'flex' : 'none',
                    width: effectivePanelWidth,
                  }}
                >
                  {panels[id]}
                </View>
              ))}
            </View>
            <View style={styles.main}>{children}</View>
          </>
        )}
      </View>

      {statusBar ? <View>{statusBar}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0d12' },
  // overflow:hidden clips the drawer's bg when it's translated off
  // the left edge. Without this the drawer's #0d1117 surface can
  // bleed under the ActivityBar on iOS, making the bar appear empty
  // when the side panel is "collapsed".
  body: { flex: 1, flexDirection: 'row', overflow: 'hidden' },
  main: { flex: 1, minWidth: 0 },
  inlinePanel: {
    borderRightColor: '#1f2433',
    overflow: 'hidden',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 48, // activity bar width
    backgroundColor: '#0d1117',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#1f2433',
    zIndex: 20,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 48,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 10,
  },
});
