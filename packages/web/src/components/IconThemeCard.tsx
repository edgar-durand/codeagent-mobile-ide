import type { MarketplaceIconThemeRef } from '@codeam/ide-core';

interface IconThemeCardProps {
  ref: MarketplaceIconThemeRef;
  isActive: boolean;
  isBusy: boolean;
  error: string | undefined;
  onInstall: (ref: MarketplaceIconThemeRef) => void;
  onUninstall: () => void;
}

export function IconThemeCard({
  ref,
  isActive,
  isBusy,
  error,
  onInstall,
  onUninstall,
}: IconThemeCardProps) {
  return (
    <article
      className={[
        'flex items-stretch gap-3 p-2 rounded-md border transition-colors',
        isActive
          ? 'border-violet-500/60 bg-violet-500/10'
          : 'border-gray-700/40 bg-gray-900/40 hover:bg-gray-900/70',
      ].join(' ')}
    >
      <div
        className="w-12 h-16 rounded-sm bg-gray-800/60 flex flex-col items-center justify-center gap-1 shrink-0"
        aria-hidden
      >
        {ref.preview.map((p, idx) => (
          <span key={idx} className="text-[16px] leading-none">
            {p.emoji}
          </span>
        ))}
      </div>
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-semibold text-gray-100 truncate">{ref.name}</span>
          <span className="text-[10px] uppercase tracking-wider text-gray-500">icons</span>
        </div>
        <span className="text-[10px] text-gray-400">{ref.publisher}</span>
        <p className="text-[11px] text-gray-300 mt-1 line-clamp-2">{ref.description}</p>
        {error && <span className="text-[10px] text-rose-300 mt-1">{error}</span>}
        <div className="mt-auto pt-2 flex items-center gap-2">
          {isActive ? (
            <>
              <span className="text-[10px] px-2 py-0.5 rounded bg-violet-500/30 text-violet-100">
                ● Active
              </span>
              <button
                type="button"
                onClick={onUninstall}
                className="text-[11px] px-2 py-0.5 rounded text-rose-300 hover:bg-rose-500/10"
              >
                Uninstall
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onInstall(ref)}
              className="text-[11px] px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white"
            >
              {isBusy ? 'Installing…' : 'Install'}
            </button>
          )}
          {ref.homepage && (
            <a
              href={ref.homepage}
              target="_blank"
              rel="noreferrer noopener"
              className="text-[10px] text-gray-500 hover:text-gray-300 ml-auto"
            >
              Source ↗
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
