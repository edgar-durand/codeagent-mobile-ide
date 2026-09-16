interface SearchInputProps {
  query: string;
  onQueryChange: (value: string) => void;
  caseSensitive: boolean;
  onCaseSensitiveChange: (value: boolean) => void;
  wholeWord: boolean;
  onWholeWordChange: (value: boolean) => void;
  regex: boolean;
  onRegexChange: (value: boolean) => void;
  include: string;
  onIncludeChange: (value: string) => void;
  exclude: string;
  onExcludeChange: (value: string) => void;
  replaceSupported: boolean;
  replaceOpen: boolean;
  onToggleReplace: () => void;
}

export function SearchInput({
  query,
  onQueryChange,
  caseSensitive,
  onCaseSensitiveChange,
  wholeWord,
  onWholeWordChange,
  regex,
  onRegexChange,
  include,
  onIncludeChange,
  exclude,
  onExcludeChange,
  replaceSupported,
  replaceOpen,
  onToggleReplace,
}: SearchInputProps) {
  return (
    <div className="px-3 py-3 border-b border-gray-800/60 flex flex-col gap-2">
      <div className="flex items-center gap-1.5 bg-gray-900/70 border border-gray-700/60 rounded-md px-2 py-1.5 focus-within:border-violet-500/50">
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="#6b7280"
          aria-hidden="true"
          className="shrink-0"
        >
          <path d="M10.68 11.74A6 6 0 1 1 11.74 10.68L14.53 13.47l-1.06 1.06zM12 7a5 5 0 1 0-10 0 5 5 0 0 0 10 0z" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search"
          className="flex-1 min-w-0 bg-transparent text-[12px] font-mono text-gray-200 placeholder:text-gray-500 focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-1 text-[11px]">
        <Toggle on={caseSensitive} onChange={onCaseSensitiveChange} label="Match case" hint="Aa" />
        <Toggle on={wholeWord} onChange={onWholeWordChange} label="Whole word" hint="ab" />
        <Toggle on={regex} onChange={onRegexChange} label="Regex" hint=".*" />
        {replaceSupported && (
          <button
            type="button"
            onClick={onToggleReplace}
            aria-label="Toggle replace"
            title="Toggle replace"
            className={[
              'w-6 h-6 inline-flex items-center justify-center rounded font-mono text-[10px] transition-colors ml-auto',
              replaceOpen
                ? 'bg-violet-500/30 text-violet-100 border border-violet-500/60'
                : 'text-gray-500 hover:bg-gray-800/60 hover:text-gray-300 border border-transparent',
            ].join(' ')}
          >
            ⇄
          </button>
        )}
      </div>

      <details className="text-[11px] text-gray-400">
        <summary className="cursor-pointer hover:text-gray-200">
          files to include / exclude
        </summary>
        <div className="mt-2 flex flex-col gap-1.5">
          <input
            type="text"
            value={include}
            onChange={(e) => onIncludeChange(e.target.value)}
            placeholder="files to include (comma-separated globs)"
            className="w-full bg-gray-900/70 border border-gray-700/60 rounded-md px-2 py-1 text-[11px] font-mono text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-violet-500/50"
          />
          <input
            type="text"
            value={exclude}
            onChange={(e) => onExcludeChange(e.target.value)}
            placeholder="files to exclude"
            className="w-full bg-gray-900/70 border border-gray-700/60 rounded-md px-2 py-1 text-[11px] font-mono text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-violet-500/50"
          />
        </div>
      </details>
    </div>
  );
}

function Toggle({
  on,
  onChange,
  label,
  hint,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      aria-label={label}
      title={label}
      className={[
        'w-6 h-6 inline-flex items-center justify-center rounded font-mono text-[10px] transition-colors',
        on
          ? 'bg-violet-500/30 text-violet-100 border border-violet-500/60'
          : 'text-gray-500 hover:bg-gray-800/60 hover:text-gray-300 border border-transparent',
      ].join(' ')}
    >
      {hint}
    </button>
  );
}
