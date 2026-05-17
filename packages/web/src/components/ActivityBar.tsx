import type { ReactNode } from 'react';

export interface ActivityBarItem {
  /** Stable identifier used by the consumer's onSelect callback. */
  id: string;
  /** Accessibility label + native tooltip. */
  label: string;
  /** Already-rendered icon node — the library doesn't pick an icon
   * pack for you; the consumer passes whatever they like (lucide,
   * heroicons, vendor SVG, etc.). Sized ~22px for visual balance. */
  icon: ReactNode;
  /** Optional badge count rendered as a small pill in the
   * top-right corner of the icon (e.g. unread / dirty / count). */
  badge?: number;
  /** When `true`, the slot is rendered greyed out and the click
   * handler does not fire. Useful for slots that aren't wired up
   * yet (placeholder for a deferred milestone). */
  disabled?: boolean;
}

interface Props {
  items: ActivityBarItem[];
  /** Item currently shown in the side panel. Pass `null` to
   * indicate the side panel is collapsed. */
  activeId: string | null;
  onSelect: (id: string) => void;
  /** Optional items rendered at the bottom of the bar (settings /
   * account / etc.). Same shape as `items`. */
  bottomItems?: ActivityBarItem[];
  /** Width in px. Default 48 — VS Code's exact width. */
  width?: number;
}

/**
 * VS Code-style vertical activity bar. Pure controlled component —
 * the parent owns `activeId` and decides which panel to render in
 * the side area next to the bar. Items are passed in as props so
 * the library doesn't impose an opinion on which panels exist
 * (Phase 2 ships Files / Search / Source Control / Settings;
 * Phase 3 extensions will surface as additional items the host
 * adds at runtime).
 */
export function ActivityBar({ items, activeId, onSelect, bottomItems, width = 48 }: Props) {
  const renderItem = (item: ActivityBarItem) => {
    const isActive = item.id === activeId;
    return (
      <button
        key={item.id}
        type="button"
        title={item.label}
        aria-label={item.label}
        aria-current={isActive ? 'page' : undefined}
        disabled={item.disabled}
        onClick={() => {
          if (item.disabled) return;
          onSelect(item.id);
        }}
        className={[
          'relative flex items-center justify-center w-full h-12 transition-colors',
          item.disabled
            ? 'text-gray-700 cursor-not-allowed'
            : isActive
              ? 'text-white'
              : 'text-gray-500 hover:text-gray-200',
        ].join(' ')}
      >
        {/* Active indicator — 2px accent strip on the left edge */}
        <span
          className={[
            'absolute left-0 top-0 bottom-0 w-[2px]',
            isActive ? 'bg-white' : 'bg-transparent',
          ].join(' ')}
          aria-hidden="true"
        />
        <span className="flex items-center justify-center text-[22px] leading-none">
          {item.icon}
        </span>
        {item.badge !== undefined && item.badge > 0 ? (
          <span className="absolute top-2 right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-violet-500 text-white text-[10px] font-semibold flex items-center justify-center">
            {item.badge > 99 ? '99+' : item.badge}
          </span>
        ) : null}
      </button>
    );
  };

  return (
    <div
      className="flex flex-col bg-[#0d1117] border-r border-gray-800/60 select-none"
      style={{ width }}
    >
      <div className="flex-1 flex flex-col items-stretch py-1">{items.map(renderItem)}</div>
      {bottomItems && bottomItems.length > 0 ? (
        <div className="flex flex-col items-stretch py-1 border-t border-gray-800/60">
          {bottomItems.map(renderItem)}
        </div>
      ) : null}
    </div>
  );
}
