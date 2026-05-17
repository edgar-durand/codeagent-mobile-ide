interface Props {
  /** Full file path relative to the workspace root, e.g.
   * `apps/landing/src/pages/IDEPage.tsx`. Empty string renders
   * nothing (matching the "no file open" state). */
  path: string;
  /** Fired when the user clicks a folder segment. The callback
   * receives the cumulative folder path up to and including the
   * clicked segment (e.g. clicking "src" in `apps/landing/src/foo`
   * fires `apps/landing/src`). The leaf segment (the file name)
   * is not clickable. */
  onSegmentClick?: (folderPath: string) => void;
  /** Optional leading segment, typically the workspace name.
   * Rendered with a folder icon. */
  rootLabel?: string;
  /** Fires when the rootLabel is clicked (typically to navigate
   * to the workspace root in the file tree). */
  onRootClick?: () => void;
}

/**
 * VS Code-style breadcrumb strip — file path rendered as clickable
 * folder segments separated by chevrons. Lives above the editor
 * and below the TabsBar in a typical IDE layout. Pure controlled
 * component; the consumer owns the file-tree navigation hook.
 */
export function Breadcrumbs({ path, onSegmentClick, rootLabel, onRootClick }: Props) {
  if (!path) return null;
  const segments = path.split('/').filter((s) => s.length > 0);
  if (segments.length === 0) return null;

  return (
    <div
      className="flex items-center gap-1 h-7 px-3 bg-[#0d1117] border-b border-gray-800/60 overflow-x-auto select-none"
      aria-label="Breadcrumb"
    >
      {rootLabel ? (
        <>
          <button
            type="button"
            onClick={onRootClick}
            className="inline-flex items-center gap-1 text-[11px] font-mono text-gray-400 hover:text-gray-100 transition-colors"
            disabled={!onRootClick}
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25V4.75A1.75 1.75 0 0 0 14.25 3H7.5L5.5 1z" />
            </svg>
            <span>{rootLabel}</span>
          </button>
          <Chevron />
        </>
      ) : null}
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        const folderPath = segments.slice(0, i + 1).join('/');
        return (
          <span key={folderPath} className="inline-flex items-center gap-1">
            {isLast ? (
              <span className="text-[11px] font-mono text-gray-200 truncate max-w-[280px]">
                {seg}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onSegmentClick?.(folderPath)}
                className="text-[11px] font-mono text-gray-400 hover:text-gray-100 transition-colors disabled:cursor-default"
                disabled={!onSegmentClick}
              >
                {seg}
              </button>
            )}
            {isLast ? null : <Chevron />}
          </span>
        );
      })}
    </div>
  );
}

function Chevron() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="#6b7280" aria-hidden="true">
      <path d="M6.22 12.78 10.94 8 6.22 3.22 7.28 2.16 13.13 8l-5.85 5.84z" />
    </svg>
  );
}
