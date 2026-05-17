import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { ActivityBar, type ActivityBarItem } from './ActivityBar';

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
}: IDEShellProps) {
  const [width, setWidth] = useState(() => Dimensions.get('window').width);
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setWidth(window.width));
    return () => sub.remove();
  }, []);
  const isMobile = width < mobileBreakpoint;

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
      if (prev.has(activeView)) return prev;
      const next = new Set(prev);
      next.add(activeView);
      return next;
    });
  }, [activeView]);

  const persistentPanels = useMemo(
    () =>
      Array.from(mounted)
        .filter((id) => panels[id] !== undefined)
        .sort(),
    [mounted, panels],
  );
  const panelOpen = activeView !== null && mounted.has(activeView);

  // Drawer slide animation on mobile.
  const slide = useState(() => new Animated.Value(panelOpen ? 0 : -sidePanelWidth))[0];
  useEffect(() => {
    Animated.timing(slide, {
      toValue: panelOpen ? 0 : -sidePanelWidth,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [panelOpen, sidePanelWidth, slide]);

  return (
    <View style={styles.container}>
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
                onPress={() => onViewChange(null)}
                style={styles.backdrop}
              />
            ) : null}
            <Animated.View
              pointerEvents={panelOpen ? 'auto' : 'none'}
              style={[
                styles.drawer,
                { width: sidePanelWidth, transform: [{ translateX: slide }] },
              ]}
            >
              {persistentPanels.map((id) => (
                <View
                  key={id}
                  style={{ flex: 1, display: id === activeView ? 'flex' : 'none' }}
                >
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
                  width: panelOpen ? sidePanelWidth : 0,
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
                    width: sidePanelWidth,
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
  body: { flex: 1, flexDirection: 'row' },
  main: { flex: 1 },
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
