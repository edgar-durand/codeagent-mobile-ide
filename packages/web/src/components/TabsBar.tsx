import { useEffect, useState, type ReactNode } from 'react';

export interface EditorTab {
  /** Stable identifier for the tab. The IDE host uses this in
   * close / select callbacks. Typically the file path. */
  id: string;
  /** Display label, usually the basename of the file. */
  label: string;
  /** Optional small icon rendered to the left of the label. */
  icon?: ReactNode;
  /** When `true`, a small dot is rendered next to the close X to
   * signal unsaved changes — consumers should prompt-on-close. */
  dirty?: boolean;
  /** When `true`, the label is rendered in italic to indicate the
   * tab is in "preview" mode (single-click preview, replaced by
   * the next preview click — VS Code's default behaviour). */
  preview?: boolean;
}

interface Props {
  tabs: EditorTab[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  /**
   * Bulk-close handler. Receives the operation type the user
   * picked from the right-click context menu. Consumer is expected
   * to call `onClose` for each affected tab (or skip dirty tabs +
   * surface the save prompt itself).
   */
  onBulkClose?: (op: 'others' | 'right' | 'all', anchorId: string) => void;
  /** Optional right-side action slot (e.g. "Split editor" button). */
  rightActions?: ReactNode;
}

interface ContextMenuState {
  tabId: string;
  x: number;
  y: number;
}

/**
 * VS Code-style editor tabs. Rendered as a horizontal strip the
 * consumer typically docks above the editor. Overflow handling is
 * delegated to the browser (`overflow-x-auto`) — that matches the
 * VS Code default and avoids reimplementing a scrolling tab strip.
 *
 * Breadcrumbs (the second strip with parent-directory chunks)
 * live in a separate component — `Breadcrumbs.tsx` — so consumers
 * can dock them independently.
 */
export function TabsBar({
  tabs,
  activeId,
  onSelect,
  onClose,
  onBulkClose,
  rightActions,
}: Props) {
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  // Dismiss the context menu on any outside click / Escape press.
  useEffect(() => {
    if (!menu) return;
    const onDoc = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  if (tabs.length === 0 && !rightActions) return null;
  return (
    <div className="relative flex items-stretch h-9 bg-[#161b22] border-b border-gray-800/60 select-none">
      <div className="flex-1 flex items-stretch overflow-x-auto scrollbar-thin">
        {tabs.map((t) => {
          const isActive = t.id === activeId;
          return (
            <div
              key={t.id}
              role="tab"
              aria-selected={isActive}
              className={[
                'group inline-flex items-center gap-2 px-3 border-r border-gray-800/60 cursor-pointer max-w-[200px] min-w-0 transition-colors',
                isActive
                  ? 'bg-[#0d1117] text-white'
                  : 'bg-transparent text-gray-400 hover:bg-gray-800/40 hover:text-gray-200',
              ].join(' ')}
              onClick={() => onSelect(t.id)}
              onContextMenu={(e) => {
                if (!onBulkClose) return;
                e.preventDefault();
                setMenu({ tabId: t.id, x: e.clientX, y: e.clientY });
              }}
            >
              {t.icon ? <span className="text-[12px]">{t.icon}</span> : null}
              <span
                className={[
                  'text-[12px] font-mono truncate',
                  t.preview ? 'italic' : '',
                ].join(' ')}
                title={t.id}
              >
                {t.label}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(t.id);
                }}
                className="ml-auto w-4 h-4 inline-flex items-center justify-center rounded text-gray-500 hover:text-gray-100 hover:bg-gray-700/60 transition-colors"
                aria-label={`Close ${t.label}`}
                title="Close"
              >
                {t.dirty ? (
                  <span className="block w-2 h-2 rounded-full bg-amber-400 group-hover:hidden" />
                ) : null}
                <span className={t.dirty ? 'hidden group-hover:inline' : 'inline'}>×</span>
              </button>
            </div>
          );
        })}
      </div>
      {rightActions ? (
        <div className="flex items-center gap-1 px-2 border-l border-gray-800/60">
          {rightActions}
        </div>
      ) : null}
      {menu && onBulkClose ? (
        <div
          role="menu"
          className="fixed z-50 min-w-[180px] bg-[#0d1117] border border-gray-700/70 rounded-md shadow-xl py-1 text-[12px] text-gray-200"
          style={{ left: menu.x, top: menu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <MenuItem
            label="Close"
            onClick={() => {
              onClose(menu.tabId);
              setMenu(null);
            }}
          />
          <MenuItem
            label="Close others"
            onClick={() => {
              onBulkClose('others', menu.tabId);
              setMenu(null);
            }}
          />
          <MenuItem
            label="Close to the right"
            onClick={() => {
              onBulkClose('right', menu.tabId);
              setMenu(null);
            }}
          />
          <MenuItem
            label="Close all"
            onClick={() => {
              onBulkClose('all', menu.tabId);
              setMenu(null);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-3 py-1 hover:bg-violet-500/20 hover:text-violet-100"
    >
      {label}
    </button>
  );
}
