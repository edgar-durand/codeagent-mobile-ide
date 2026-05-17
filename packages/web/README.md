# @codeam/ide-web

> A VS Code–style IDE surface for React (DOM). Activity bar, file explorer, source control, search, settings, tabs, breadcrumbs, inline editor, diff viewer, and terminal. Drops into any React web app — bring your own backend via small adapter interfaces.

[![npm](https://img.shields.io/npm/v/%40codeam%2Fide-web?label=%40codeam%2Fide-web)](https://www.npmjs.com/package/@codeam/ide-web)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/edgar-durand/codeagent-mobile-ide/blob/main/LICENSE)

## Quick install

```bash
npm install @codeam/ide-web @codeam/ide-core
# Peer deps the package expects you already have:
npm install react react-dom
```

The package ships ESM + CJS and works with Vite, Next.js, Remix, Create React App, etc.

## What you get

| Component                      | What it renders                                                       | Adapter it consumes             |
| ------------------------------ | --------------------------------------------------------------------- | ------------------------------- |
| `IDEShell`                     | Activity bar + side panel + main content, responsive (drawer < 768px) | none — pure layout              |
| `ActivityBar`                  | Vertical icon strip (Files / Search / SCM / …)                        | none                            |
| `FileTreeSidebar`              | VS Code-style explorer with search + collapsible tree                 | `FileTreeProvider`              |
| `SourceControlPanel`           | Branch header, commit input, file list, commit-log Graph              | `GitProvider`                   |
| `SearchPanel`                  | Multi-file search with case / word / regex toggles                    | `SearchProvider`                |
| `SettingsPanel`                | Theme / font / wrap / minimap / line-numbers controls                 | `SettingsStore` (optional)      |
| `TabsBar`                      | Editor-tab strip with dirty markers                                   | none — controlled by parent     |
| `Breadcrumbs`                  | Clickable path segments above the editor                              | none                            |
| `FileViewerProvider`           | Context + modal host that wraps Monaco for "open this file"           | `FileFetcher`                   |
| `FileViewerHost`               | Fullscreen Monaco editor modal (chat use case)                        | reads from `FileViewerProvider` |
| (consumer-side) `InlineEditor` | Inline Monaco editor for the IDE main pane (see example below)        | `FileFetcher` + `SettingsStore` |
| `DiffViewer`                   | Side-by-side Monaco diff (working tree ↔ HEAD)                        | `GitProvider` + `FileFetcher`   |
| `TerminalPanel`                | xterm.js terminal with a "Recent commands" chip strip                 | `TerminalProvider`              |

Every adapter type is **re-exported from `@codeam/ide-web`** so the consumer only ever imports from one place.

---

## The five-minute integration

The smallest useful integration is a single file with one read endpoint:

```tsx
import {
  FileViewerProvider,
  FileViewerHost,
  useFileViewer,
  type FileFetcher,
} from '@codeam/ide-web';

const fetcher: FileFetcher = {
  label: 'demo',
  canWrite: false,
  async read(path) {
    const r = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
    if (!r.ok) return { error: `HTTP ${r.status}` };
    return { content: await r.text() };
  },
  async write() {
    return { error: 'Read-only demo' };
  },
};

function OpenButton() {
  const { open } = useFileViewer();
  return <button onClick={() => open({ path: 'README.md', op: 'Read' })}>Open</button>;
}

export function App() {
  return (
    <FileViewerProvider fetcher={fetcher}>
      <OpenButton />
      <FileViewerHost />
    </FileViewerProvider>
  );
}
```

That's it — clicking the button pops a Monaco-backed editor over your page.

---

## Full IDE in 100 lines

A complete VS Code-style shell with the activity bar, file explorer, source control, settings, tabs, and inline editor:

```tsx
import { useMemo, useState } from 'react';
import {
  Breadcrumbs,
  DiffViewer,
  FileTreeSidebar,
  IDEShell,
  SearchPanel,
  SettingsPanel,
  SourceControlPanel,
  TabsBar,
  type ActivityBarItem,
  type EditorTab,
  type FileFetcher,
  type FileTreeProvider,
  type GitProvider,
  type GitStatusEntry,
  type SearchProvider,
  type SettingsStore,
} from '@codeam/ide-web';
import { InlineEditor } from './InlineEditor'; // see below

type View = 'files' | 'search' | 'scm' | 'settings';

export function IDEPage({
  fetcher,
  fileTree,
  git,
  search,
  settings,
}: {
  fetcher: FileFetcher;
  fileTree: FileTreeProvider;
  git: GitProvider;
  search: SearchProvider;
  settings: SettingsStore;
}) {
  const [view, setView] = useState<View | null>('files');
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [buffers, setBuffers] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [diff, setDiff] = useState<{ path: string; staged: boolean } | null>(null);

  const openFile = (path: string) => {
    setOpenTabs((p) => (p.includes(path) ? p : [...p, path]));
    setActiveTab(path);
    setDiff(null);
  };

  const closeTab = (path: string) => {
    setOpenTabs((p) => p.filter((x) => x !== path));
    if (activeTab === path) setActiveTab(null);
  };

  const items: ActivityBarItem[] = useMemo(
    () => [
      { id: 'files', label: 'Explorer', icon: <FilesIcon /> },
      { id: 'search', label: 'Search', icon: <SearchIcon /> },
      { id: 'scm', label: 'Source Control', icon: <BranchIcon /> },
    ],
    [],
  );

  const tabs: EditorTab[] = openTabs.map((p) => ({
    id: p,
    label: p.split('/').pop() ?? p,
    dirty: buffers[p] !== undefined && saved[p] !== undefined && buffers[p] !== saved[p],
  }));

  return (
    <IDEShell
      activityItems={items}
      activityBottomItems={[{ id: 'settings', label: 'Settings', icon: <CogIcon /> }]}
      activeView={view}
      onViewChange={(id) => setView(id as View | null)}
      panels={{
        files: <FileTreeSidebar provider={fileTree} selectedPath={activeTab} onSelect={openFile} />,
        search: <SearchPanel provider={search} onOpen={(h) => openFile(h.path)} />,
        scm: (
          <SourceControlPanel
            provider={git}
            onSelect={(e: GitStatusEntry) => setDiff({ path: e.path, staged: e.staged })}
          />
        ),
        settings: <SettingsPanel store={settings} />,
      }}
    >
      <TabsBar tabs={tabs} activeId={activeTab} onSelect={setActiveTab} onClose={closeTab} />
      <Breadcrumbs path={diff?.path ?? activeTab ?? ''} rootLabel="workspace" />
      {diff ? (
        <DiffViewer
          path={diff.path}
          git={git}
          fetcher={fetcher}
          staged={diff.staged}
          onClose={() => setDiff(null)}
        />
      ) : (
        <InlineEditor
          fetcher={fetcher}
          path={activeTab}
          settingsStore={settings}
          buffers={buffers}
          setBuffers={setBuffers}
          saved={saved}
          setSaved={setSaved}
        />
      )}
    </IDEShell>
  );
}
```

---

## Adapter recipes

You bring three small adapters: file ops, file-tree listing, and git. Search and terminal are optional. Adapter identity must be **stable across renders** — wrap creation in `useMemo` or use a module-level cache keyed by workspace id.

```ts
import type {
  FileFetcher,
  FileTreeProvider,
  GitProvider,
  SearchProvider,
  TerminalProvider,
} from '@codeam/ide-web';

export const fileFetcher: FileFetcher = {
  label: 'demo-workspace',
  canWrite: true,
  read: async (path) => fetch(`/api/files/${encodeURIComponent(path)}`).then(/* … */),
  write: async (path, body) =>
    fetch(`/api/files/${encodeURIComponent(path)}`, { method: 'PUT', body }).then(/* … */),
};

export const fileTree: FileTreeProvider = {
  list: async (query) =>
    fetch(`/api/files?query=${encodeURIComponent(query ?? '')}`).then((r) => r.json()),
};

export const git: GitProvider = {
  status: () => fetch('/api/git/status').then((r) => r.json()),
  diff: (p, staged) => fetch(`/api/git/diff?path=${p}&staged=${!!staged}`).then((r) => r.json()),
  stage: (paths) =>
    fetch('/api/git/stage', { method: 'POST', body: JSON.stringify({ paths }) }).then(() => {}),
  unstage: (paths) =>
    fetch('/api/git/unstage', { method: 'POST', body: JSON.stringify({ paths }) }).then(() => {}),
  commit: (opts) =>
    fetch('/api/git/commit', { method: 'POST', body: JSON.stringify(opts) }).then((r) => r.json()),
  push: () => fetch('/api/git/push', { method: 'POST' }).then((r) => r.json()),
  fetch: () => fetch('/api/git/fetch', { method: 'POST' }).then((r) => r.json()),
  // Optional — when present, the SCM panel renders a Graph section.
  log: async (limit) => fetch(`/api/git/log?limit=${limit ?? 30}`).then((r) => r.json()),
};

export const search: SearchProvider = {
  search: async (q, opts) =>
    fetch('/api/search', {
      method: 'POST',
      body: JSON.stringify({ query: q, ...opts }),
    }).then((r) => r.json()),
};

export const terminal: TerminalProvider = {
  open: async ({ cols, rows, cwd }) =>
    fetch('/api/terminal/open', { method: 'POST', body: JSON.stringify({ cols, rows, cwd }) }).then(
      (r) => r.json(),
    ),
  write: async (session, data) => {
    await fetch(`/api/terminal/${session.id}/write`, { method: 'POST', body: data });
  },
  resize: async (session, cols, rows) => {
    await fetch(`/api/terminal/${session.id}/resize`, {
      method: 'POST',
      body: JSON.stringify({ cols, rows }),
    });
  },
  subscribe: (session, handler) => {
    const es = new EventSource(`/api/terminal/${session.id}/stream`);
    es.addEventListener('data', (e) => handler({ type: 'data', data: (e as MessageEvent).data }));
    es.addEventListener('exit', (e) =>
      handler({ type: 'exit', exitCode: Number((e as MessageEvent).data) }),
    );
    return () => es.close();
  },
  close: async (session) => {
    await fetch(`/api/terminal/${session.id}`, { method: 'DELETE' });
  },
};
```

---

## Persistence — `SettingsStore`

The `SettingsPanel` reads / writes through an optional `SettingsStore`. A localStorage implementation is ~50 lines and gives you cross-tab synchronisation for free:

```ts
import type { SettingsStore } from '@codeam/ide-web';

const PREFIX = 'codeam-ide:';

export const localStorageSettings: SettingsStore = {
  async get(key) {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : undefined;
  },
  async set(key, value) {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  },
  watch(cb) {
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith(PREFIX)) {
        cb(e.key.slice(PREFIX.length), e.newValue ? JSON.parse(e.newValue) : undefined);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  },
};
```

Pass it to the `SettingsPanel` and the `InlineEditor` (so settings changes apply live).

---

## Tips

1. **Memoise adapter instances.** The library keys its load effects off adapter identity. A fresh `{ list: () => fetch(...) }` per render causes refetch loops + flicker.
2. **The `SearchProvider` is optional.** Pass a stub returning `{ hits: [], truncated: false }` if you don't have a backend yet; the panel still renders and reports "No results."
3. **The `SCM` Graph section is opt-in.** Implement `git.log` only when you want it.
4. **`IDEShell` keeps non-active panels mounted** (with `display: none`), so the FileTree's scroll position survives switching to Search and back. Same trick VS Code uses.
5. **Mobile drawer** — pass `mobileBreakpoint={600}` to switch the breakpoint for tablet-sized phones.

---

## Cross-platform

A React Native equivalent ships as [`@codeam/ide-native`](https://www.npmjs.com/package/@codeam/ide-native). Same prop shape, same adapter contracts — swap import paths.

```tsx
// web
import { IDEShell, FileTreeSidebar } from '@codeam/ide-web';

// native
import { IDEShell, FileTreeSidebar } from '@codeam/ide-native';
```

Native uses xterm.js + Monaco inside a WebView (loaded from a CDN at runtime), so the package keeps the npm tarball lean and your consumer's Metro bundle small.

---

## License

MIT © [Edgar Durand](https://github.com/edgar-durand)
