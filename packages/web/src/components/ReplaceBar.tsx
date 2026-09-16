interface ReplaceBarProps {
  replacement: string;
  onReplacementChange: (value: string) => void;
  debouncedQuery: string;
  replacing: boolean;
  onReplaceAll: () => void;
}

export function ReplaceBar({
  replacement,
  onReplacementChange,
  debouncedQuery,
  replacing,
  onReplaceAll,
}: ReplaceBarProps) {
  return (
    <div className="flex items-center gap-1.5 bg-gray-900/70 border border-gray-700/60 rounded-md px-2 py-1.5 focus-within:border-violet-500/50">
      <span className="text-[10px] text-gray-500 shrink-0">↦</span>
      <input
        type="text"
        value={replacement}
        onChange={(e) => onReplacementChange(e.target.value)}
        placeholder="Replace"
        className="flex-1 min-w-0 bg-transparent text-[12px] font-mono text-gray-200 placeholder:text-gray-500 focus:outline-none"
      />
      <button
        type="button"
        disabled={!debouncedQuery || replacing}
        onClick={onReplaceAll}
        className="text-[10px] px-2 py-0.5 rounded bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white shrink-0"
        title="Replace all"
      >
        All
      </button>
    </div>
  );
}
