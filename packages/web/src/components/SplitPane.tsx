import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';

interface Props {
  /** Layout direction. `vertical` = top + bottom (drag the handle
   * up/down); `horizontal` = left + right. */
  direction?: 'vertical' | 'horizontal';
  /** Children: exactly two regions. First = top/left, second = bottom/right. */
  children: [ReactNode, ReactNode];
  /** Initial size (in px) of the SECOND region. */
  initialSecondSize?: number;
  /** Lower bound the second region can shrink to. */
  minSecondSize?: number;
  /** Upper bound. */
  maxSecondSize?: number;
  /** Optional title slot rendered inside the drag handle (e.g.
   * "Terminal"). Clicking the title toggles collapse. */
  handleTitle?: ReactNode;
  /** Right-side actions rendered inside the drag handle. */
  handleActions?: ReactNode;
  /** When `true`, the second region is collapsed (height = 0). The
   * drag handle stays clickable so the user can reopen. */
  collapsed?: boolean;
  /** Fires when the user clicks the handle title — consumer should
   * toggle `collapsed`. */
  onCollapseToggle?: () => void;
}

/**
 * Two-region resizable splitter. Pure CSS + pointer events, no
 * external deps. Designed for the IDE bottom-terminal pattern:
 *
 *     <SplitPane direction="vertical" handleTitle="Terminal">
 *       <EditorArea />
 *       <TerminalPanel />
 *     </SplitPane>
 *
 * Drag the bar between the two regions to resize. Click the title
 * to collapse the bottom region.
 */
export function SplitPane({
  direction = 'vertical',
  children,
  initialSecondSize = 240,
  minSecondSize = 80,
  maxSecondSize = 1200,
  handleTitle,
  handleActions,
  collapsed,
  onCollapseToggle,
}: Props) {
  const [size, setSize] = useState(initialSecondSize);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startCoord: number; startSize: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (collapsed) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        startCoord: direction === 'vertical' ? e.clientY : e.clientX,
        startSize: size,
      };
      setDragging(true);
    },
    [collapsed, direction, size],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || !containerRef.current) return;
      const current = direction === 'vertical' ? e.clientY : e.clientX;
      // Vertical split: dragging UP grows the bottom region.
      // Horizontal split: dragging LEFT grows the right region.
      const delta = drag.startCoord - current;
      const containerSize =
        direction === 'vertical'
          ? containerRef.current.clientHeight
          : containerRef.current.clientWidth;
      const upperCap = Math.min(maxSecondSize, containerSize - 80);
      const next = Math.max(minSecondSize, Math.min(upperCap, drag.startSize + delta));
      setSize(next);
    },
    [direction, maxSecondSize, minSecondSize],
  );

  const onPointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      dragRef.current = null;
      setDragging(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* pointer already released */
      }
    }
  }, []);

  // Reset dragging if the layout container shrinks below our chosen
  // size (e.g. window resized smaller than the terminal pane). Cap
  // size at half the container so the editor always has room.
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const e = entry;
      if (!e) return;
      const containerSize = direction === 'vertical' ? e.contentRect.height : e.contentRect.width;
      setSize((s) => Math.min(s, Math.max(minSecondSize, containerSize - 80)));
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [direction, minSecondSize]);

  const secondPx = collapsed ? 0 : size;
  const isVertical = direction === 'vertical';

  return (
    <div
      ref={containerRef}
      className="flex flex-1 min-h-0 min-w-0"
      style={{ flexDirection: isVertical ? 'column' : 'row' }}
    >
      <div className="flex-1 min-h-0 min-w-0 flex flex-col">{children[0]}</div>
      <div
        role="separator"
        aria-orientation={isVertical ? 'horizontal' : 'vertical'}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={[
          'flex items-center justify-between bg-[#161b22] border-y border-gray-800/60 shrink-0 select-none',
          collapsed ? 'cursor-pointer' : isVertical ? 'cursor-row-resize' : 'cursor-col-resize',
          dragging ? 'bg-violet-500/20' : 'hover:bg-gray-800/60',
        ].join(' ')}
        style={isVertical ? { height: 22 } : { width: 6 }}
      >
        {isVertical ? (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCollapseToggle?.();
              }}
              className="pl-3 pr-1 text-[10px] uppercase tracking-wider font-bold text-gray-500 hover:text-gray-100 transition-colors"
            >
              {collapsed ? '▸ ' : '▾ '}
              {handleTitle ?? 'Bottom Pane'}
            </button>
            <div
              className="pr-2 flex items-center gap-2"
              onPointerDown={(e) => e.stopPropagation()}
            >
              {handleActions}
            </div>
          </>
        ) : null}
      </div>
      <div
        className="shrink-0 flex flex-col min-h-0 min-w-0 overflow-hidden"
        style={isVertical ? { height: secondPx } : { width: secondPx }}
      >
        {collapsed ? null : children[1]}
      </div>
    </div>
  );
}
