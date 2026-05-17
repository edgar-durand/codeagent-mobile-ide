import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityBar, type ActivityBarItem } from './ActivityBar';

interface IDEShellProps {
  /** Top items rendered in the activity bar (Files, Search, SCM…). */
  activityItems: ActivityBarItem[];
  /** Items rendered at the bottom of the bar (Settings, Account…). */
  activityBottomItems?: ActivityBarItem[];
  /** Currently-active panel id, or `null` when the side panel is
   * collapsed. Re-clicking the active icon collapses (matches the
   * VS Code behaviour). */
  activeView: string | null;
  onViewChange: (id: string | null) => void;
  /** Map of panel id → panel content. Only the active one renders. */
  panels: Record<string, ReactNode>;
  /** Main editor area (typically a TabsBar + editor). */
  children: ReactNode;
  /** Optional title bar pinned to the top. Consumers typically render
   * their back button, traffic lights, plan badge, etc. */
  titleBar?: ReactNode;
  /** Optional status bar pinned to the bottom. */
  statusBar?: ReactNode;
  /** Width of the side panel on md+ viewports. Default 288 (w-72). */
  sidePanelWidth?: number;
  /** Breakpoint (px) below which the panel becomes a drawer overlay
   * instead of pushing the main content. Default 768 (Tailwind md). */
  mobileBreakpoint?: number;
}

/**
 * Composite IDE layout: title bar, ActivityBar + collapsible side
 * panel + main content, optional status bar.
 *
 * Responsive behaviour:
 *   - md+ (≥ `mobileBreakpoint` px): activity bar and side panel
 *     are inline. Side panel is hidden when `activeView` is `null`.
 *   - smaller: the side panel becomes an overlay drawer that
 *     slides over the main content with a backdrop. The activity
 *     bar stays pinned. Tapping the backdrop or re-tapping the
 *     active icon dismisses the drawer.
 *
 * `onViewChange` receives `null` when the active icon is
 * re-clicked — the consumer should reflect that by collapsing
 * the panel state. The shell itself doesn't own the active id.
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
  sidePanelWidth = 288,
  mobileBreakpoint = 768,
}: IDEShellProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(`(max-width: ${mobileBreakpoint - 1}px)`);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, [mobileBreakpoint]);

  const handleSelect = (id: string) => {
    // Re-clicking the active icon collapses the panel (VS Code
    // ergonomics). Anything else opens / switches the panel.
    if (id === activeView) onViewChange(null);
    else onViewChange(id);
  };

  // Track every panel that has ever been activated so we can keep
  // it mounted (with display: none) once the user navigates away.
  // This is the VS Code behaviour: file tree state, scroll
  // positions, expanded folders, etc. survive activity-bar
  // switches. Without this, switching to Search and back wipes
  // the FileTreeSidebar's internal state and refires the load.
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

  // Stable list of panels we've ever rendered, in the order they
  // first opened. Sorting by id keeps the DOM order deterministic.
  const persistentPanels = useMemo(
    () =>
      Array.from(mounted)
        .filter((id) => panels[id] !== undefined)
        .sort(),
    [mounted, panels],
  );
  const panelOpen = activeView !== null && mounted.has(activeView);

  return (
    <div className="h-screen w-full flex flex-col bg-[#0a0d12] text-gray-100 overflow-hidden">
      {titleBar ? <div className="shrink-0">{titleBar}</div> : null}

      <div className="flex-1 min-h-0 flex relative">
        <ActivityBar
          items={activityItems}
          activeId={activeView}
          onSelect={handleSelect}
          bottomItems={activityBottomItems}
        />

        {/* Side panel — inline on desktop, overlay drawer on mobile.
            We render every panel that has ever been activated and
            toggle visibility via `display: none` so internal state
            (scroll, search query, expanded folders, fetched data)
            survives activity-bar switches — VS Code parity. */}
        {isMobile ? (
          <>
            {panelOpen ? (
              <div
                role="button"
                aria-label="Close panel"
                tabIndex={0}
                onClick={() => onViewChange(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' || e.key === 'Enter') onViewChange(null);
                }}
                className="absolute inset-y-0 left-12 right-0 bg-black/40 z-10"
              />
            ) : null}
            <aside
              className="absolute inset-y-0 left-12 border-r border-gray-800/60 bg-[#0d1117] z-20 transition-transform duration-150 ease-out"
              style={{
                width: sidePanelWidth,
                transform: panelOpen ? 'translateX(0)' : 'translateX(-100%)',
                visibility: panelOpen ? 'visible' : 'hidden',
              }}
            >
              {persistentPanels.map((id) => (
                <div
                  key={id}
                  style={{ display: id === activeView ? 'flex' : 'none' }}
                  className="h-full flex-col"
                >
                  {panels[id]}
                </div>
              ))}
            </aside>
          </>
        ) : (
          <aside
            className="border-r border-gray-800/60 flex-shrink-0 overflow-hidden"
            style={{ width: panelOpen ? sidePanelWidth : 0 }}
          >
            {persistentPanels.map((id) => (
              <div
                key={id}
                style={{
                  display: id === activeView ? 'flex' : 'none',
                  width: sidePanelWidth,
                }}
                className="h-full flex-col"
              >
                {panels[id]}
              </div>
            ))}
          </aside>
        )}

        <main className="flex-1 flex flex-col min-w-0">{children}</main>
      </div>

      {statusBar ? <div className="shrink-0">{statusBar}</div> : null}
    </div>
  );
}
