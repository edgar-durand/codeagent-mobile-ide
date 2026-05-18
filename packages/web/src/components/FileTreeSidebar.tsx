import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type {
  FileIconRef,
  FileIconResolver,
  FileTreeEntry,
  FileTreeProvider,
} from '@codeam/ide-core';

interface Props {
  /** Adapter that yields the workspace's file list. Identity should be
   * stable across renders — the host keys its initial load effect off
   * the `provider` reference. Allocating a new provider on every
   * render will refire the load on each parent render. */
  provider: FileTreeProvider;
  /** Path currently open in the file viewer, used for the row's
   * "selected" highlight. */
  selectedPath: string | null;
  /** Fired when the user taps a file row. The consumer is expected to
   * open the file in the viewer (typically by calling `open(...)` on
   * the FileViewer context). Folder taps are handled internally — the
   * sidebar tracks its own expand state. */
  onSelect: (path: string) => void;
  /** Forces a reload of the file list. Bump this when the workspace
   * changes (e.g. after a git pull or branch switch). Default is a
   * fixed key, so the load only fires once per mount. */
  reloadKey?: string | number;
  /**
   * Optional file-icon theme. When supplied, each row renders an
   * icon from the resolver instead of the default emoji glyphs.
   * Wire via `buildIconResolver(themeJson, baseUrl)` from core.
   */
  iconResolver?: FileIconResolver | null;
}

function IconCell({ ref: r }: { ref: FileIconRef }): ReactNode {
  if (r.kind === 'uri') {
    // Squared icon slot — VS Code-style icon themes are 16×16 PNG /
    // SVG. We size the slot, not the image, so transparent margins
    // in the source still render correctly.
    return (
      <span
        aria-hidden
        className="inline-block w-4 h-4 bg-no-repeat bg-center"
        style={{ backgroundImage: `url(${JSON.stringify(r.uri).slice(1, -1)})`, backgroundSize: 'contain' }}
      />
    );
  }
  if (r.kind === 'emoji') {
    return <span className="text-[12px] leading-none">{r.char}</span>;
  }
  return null;
}

interface TreeNode {
  name: string;
  fullPath: string;
  isFile: boolean;
  children: Map<string, TreeNode>;
}

function buildTree(files: FileTreeEntry[]): TreeNode {
  const root: TreeNode = { name: '', fullPath: '', isFile: false, children: new Map() };
  for (const f of files) {
    const parts = f.path.split('/').filter((p): p is string => p.length > 0);
    let cursor = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const isLast = i === parts.length - 1;
      const fullPath = parts.slice(0, i + 1).join('/');
      let next = cursor.children.get(part);
      if (!next) {
        next = { name: part, fullPath, isFile: isLast, children: new Map() };
        cursor.children.set(part, next);
      }
      cursor = next;
    }
  }
  return root;
}

function sortedChildren(node: TreeNode): TreeNode[] {
  return Array.from(node.children.values()).sort((a, b) => {
    if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
}

function NodeRow({
  node,
  depth,
  selectedPath,
  onSelect,
  expanded,
  setExpanded,
  iconResolver,
}: {
  node: TreeNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (p: string) => void;
  expanded: Set<string>;
  setExpanded: (n: Set<string>) => void;
  iconResolver?: FileIconResolver | null;
}) {
  const isOpen = expanded.has(node.fullPath);
  const isSelected = selectedPath === node.fullPath;

  if (node.isFile) {
    const iconRef = iconResolver?.forFile(node.name);
    return (
      <button
        type="button"
        onClick={() => onSelect(node.fullPath)}
        className={`group w-full text-left flex items-center gap-1.5 pr-2 py-0.5 rounded transition-colors ${
          isSelected
            ? 'bg-violet-500/20 text-violet-100'
            : 'text-gray-300 hover:bg-gray-800/50 hover:text-gray-100'
        }`}
        style={{ paddingLeft: 4 + depth * 12 }}
        title={node.fullPath}
      >
        {iconRef && iconRef.kind !== 'none' ? (
          <IconCell ref={iconRef} />
        ) : (
          <span className="text-[10px] text-gray-500 group-hover:text-gray-400">📄</span>
        )}
        <span className="font-mono text-[12px] truncate">{node.name}</span>
      </button>
    );
  }

  const folderIcon = iconResolver?.forFolder(node.name, isOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          const next = new Set(expanded);
          if (isOpen) next.delete(node.fullPath);
          else next.add(node.fullPath);
          setExpanded(next);
        }}
        className="w-full text-left flex items-center gap-1.5 pr-2 py-0.5 rounded text-gray-300 hover:bg-gray-800/50 hover:text-gray-100 transition-colors"
        style={{ paddingLeft: 4 + depth * 12 }}
      >
        <span className="text-[10px] text-gray-500 w-3">{isOpen ? '▾' : '▸'}</span>
        {folderIcon && folderIcon.kind !== 'none' && <IconCell ref={folderIcon} />}
        <span className="font-mono text-[12px] font-semibold text-gray-200">{node.name}</span>
      </button>
      {isOpen && (
        <div>
          {sortedChildren(node).map((child) => (
            <NodeRow
              key={child.fullPath}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
              expanded={expanded}
              setExpanded={setExpanded}
              iconResolver={iconResolver}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * VS Code-style file explorer. Stateful: owns its own search query,
 * expand-set, and load-result state. Driven by a {@link FileTreeProvider}
 * — same shape the host uses, supplied by the consumer.
 *
 * The query is debounced (200 ms) before being passed to the
 * provider; the provider can choose to filter server-side or return
 * everything and let the sidebar filter client-side. When a query
 * is active the sidebar switches to a flat list (capped at 500
 * results) so matches are scannable without expanding folders.
 */
export function FileTreeSidebar({
  provider,
  selectedPath,
  onSelect,
  reloadKey,
  iconResolver,
}: Props) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [files, setFiles] = useState<FileTreeEntry[]>([]);
  const [truncated, setTruncated] = useState(false);
  // Loading is derived from the most recent committed fetch key, so a
  // synchronous setLoading(true) inside the effect isn't required —
  // see the same pattern in apps/landing for the rationale.
  const fetchKey = `${reloadKey ?? ''}|${debouncedQuery}`;
  const [committedKey, setCommittedKey] = useState<string | null>(null);
  const loading = committedKey !== fetchKey;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Mirror the provider in a ref so the load effect can see the
  // latest without making it a dep (provider identity is the
  // consumer's contract responsibility — see the comment in `Props`).
  const providerRef = useRef(provider);
  providerRef.current = provider;

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), 200);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    providerRef.current
      .list(debouncedQuery || undefined)
      .then((payload) => {
        if (cancelled) return;
        setFiles(payload.files);
        setTruncated(payload.truncated);
        setCommittedKey(fetchKey);
      })
      .catch(() => {
        if (cancelled) return;
        setFiles([]);
        setTruncated(false);
        setCommittedKey(fetchKey);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, reloadKey, fetchKey]);

  const tree = useMemo(() => buildTree(files), [files]);

  // When the user is actively filtering, render a flat list — easier
  // to scan than expanding folders for each match. Cap at 500 to keep
  // the DOM tame on very loose searches.
  const showFlat = debouncedQuery.length > 0;
  const flatList = showFlat ? files.slice(0, 500) : null;

  return (
    <div className="flex flex-col h-full bg-[#0d1117] border-r border-gray-800/60 min-w-0">
      <div className="px-2 py-2 border-b border-gray-800/60">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search files…"
          className="w-full bg-gray-900/70 border border-gray-700/60 rounded-md px-2 py-1.5 text-[12px] text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-violet-500/50"
        />
        {truncated && (
          <div className="mt-1 text-[10px] text-amber-300/80 font-mono">
            {files.length} files (truncated — refine search)
          </div>
        )}
      </div>
      <div className="flex-1 overflow-auto py-1">
        {loading && files.length === 0 ? (
          <div className="text-center text-gray-500 text-[11px] py-8">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse mr-1.5" />
            Loading workspace…
          </div>
        ) : files.length === 0 ? (
          <div className="text-center text-gray-500 text-[11px] py-8">
            {query ? 'No files match.' : 'No files found.'}
          </div>
        ) : flatList ? (
          <div>
            {flatList.map((f) => (
              <button
                key={f.path}
                type="button"
                onClick={() => onSelect(f.path)}
                className={`group w-full text-left flex items-center gap-1.5 px-3 py-0.5 rounded transition-colors ${
                  selectedPath === f.path
                    ? 'bg-violet-500/20 text-violet-100'
                    : 'text-gray-300 hover:bg-gray-800/50 hover:text-gray-100'
                }`}
                title={f.path}
              >
                {(() => {
                  const basename = f.path.split('/').pop() ?? f.path;
                  const ref = iconResolver?.forFile(basename);
                  return ref && ref.kind !== 'none' ? (
                    <IconCell ref={ref} />
                  ) : (
                    <span className="text-[10px] text-gray-500 group-hover:text-gray-400">📄</span>
                  );
                })()}
                <span className="font-mono text-[12px] truncate">{f.path}</span>
              </button>
            ))}
            {files.length > 500 && (
              <div className="px-3 py-1 text-[10px] text-amber-300/80 font-mono">
                +{files.length - 500} more — refine search
              </div>
            )}
          </div>
        ) : (
          sortedChildren(tree).map((child) => (
            <NodeRow
              key={child.fullPath}
              node={child}
              depth={0}
              selectedPath={selectedPath}
              onSelect={onSelect}
              expanded={expanded}
              setExpanded={setExpanded}
              iconResolver={iconResolver}
            />
          ))
        )}
      </div>
    </div>
  );
}
