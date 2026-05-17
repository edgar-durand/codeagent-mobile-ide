# @codeam/ide-native

> VS Code–style IDE surface for **React Native** — activity bar, file explorer, source control, search, settings, tabs, breadcrumbs, inline editor, diff viewer, and terminal. Same prop shape as [`@codeam/ide-web`](https://www.npmjs.com/package/@codeam/ide-web). Bring your own backend.

[![npm](https://img.shields.io/npm/v/%40codeam%2Fide-native?label=%40codeam%2Fide-native)](https://www.npmjs.com/package/@codeam/ide-native)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/edgar-durand/codeagent-mobile-ide/blob/main/LICENSE)

## Quick install

```bash
npm install @codeam/ide-native @codeam/ide-core
# Peer deps the package expects you already have:
npm install react react-native react-native-webview react-native-safe-area-context @expo/vector-icons
```

The package works with Expo (managed or bare) and plain React Native ≥ 0.74. Monaco + xterm.js are loaded inside a WebView from a CDN at first use, so your app's Metro bundle stays small.

## What you get

| Component            | What it renders                                                      | Adapter it consumes             |
| -------------------- | -------------------------------------------------------------------- | ------------------------------- |
| `IDEShell`           | Activity bar + side panel + main + responsive drawer (< 600px width) | none                            |
| `ActivityBar`        | Vertical icon strip                                                  | none                            |
| `FileTreeSidebar`    | VS Code-style explorer using FlatList virtualisation                 | `FileTreeProvider`              |
| `SourceControlPanel` | Branch header, commit input, file list, Graph                        | `GitProvider`                   |
| `SearchPanel`        | Multi-file search                                                    | `SearchProvider`                |
| `SettingsPanel`      | Theme / font / wrap / minimap / line-numbers controls                | `SettingsStore` (optional)      |
| `TabsBar`            | Editor-tab strip with dirty markers                                  | none                            |
| `Breadcrumbs`        | Clickable path segments                                              | none                            |
| `FileViewerProvider` | Context + modal host (chat use case)                                 | `FileFetcher`                   |
| `FileViewerHost`     | Fullscreen Monaco editor modal                                       | reads from `FileViewerProvider` |
| `InlineEditor`       | Inline Monaco editor for the IDE main pane                           | `FileFetcher` + `SettingsStore` |
| `DiffViewer`         | Side-by-side Monaco diff                                             | `GitProvider` + `FileFetcher`   |
| `TerminalPanel`      | xterm.js terminal inside a WebView                                   | `TerminalProvider`              |

---

## Five-minute integration

```tsx
import { Button, View } from 'react-native';
import {
  FileViewerProvider,
  FileViewerHost,
  useFileViewer,
  type FileFetcher,
} from '@codeam/ide-native';

const fetcher: FileFetcher = {
  label: 'demo',
  canWrite: false,
  async read(path) {
    const r = await fetch(`https://api.example.com/files?path=${encodeURIComponent(path)}`);
    if (!r.ok) return { error: `HTTP ${r.status}` };
    return { content: await r.text() };
  },
  async write() {
    return { error: 'Read-only demo' };
  },
};

function OpenButton() {
  const { open } = useFileViewer();
  return <Button title="Open README" onPress={() => open({ path: 'README.md', op: 'Read' })} />;
}

export default function App() {
  return (
    <FileViewerProvider fetcher={fetcher}>
      <View style={{ flex: 1 }}>
        <OpenButton />
        <FileViewerHost />
      </View>
    </FileViewerProvider>
  );
}
```

---

## Full IDE shell

```tsx
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Breadcrumbs,
  DiffViewer,
  FileTreeSidebar,
  IDEShell,
  InlineEditor,
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
} from '@codeam/ide-native';

type View = 'files' | 'search' | 'scm' | 'settings';

export function IDEScreen({
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

  const iconColor = (id: string) => (view === id ? '#fff' : '#8a909c');

  const items: ActivityBarItem[] = [
    {
      id: 'files',
      label: 'Explorer',
      icon: <Ionicons name="document-outline" size={22} color={iconColor('files')} />,
    },
    {
      id: 'search',
      label: 'Search',
      icon: <Ionicons name="search" size={22} color={iconColor('search')} />,
    },
    {
      id: 'scm',
      label: 'Source Control',
      icon: <Ionicons name="git-branch" size={22} color={iconColor('scm')} />,
    },
  ];

  const tabs: EditorTab[] = openTabs.map((p) => ({
    id: p,
    label: p.split('/').pop() ?? p,
    dirty: buffers[p] !== undefined && saved[p] !== undefined && buffers[p] !== saved[p],
  }));

  const openFile = (path: string) => {
    setOpenTabs((p) => (p.includes(path) ? p : [...p, path]));
    setActiveTab(path);
    setDiff(null);
    setView(null); // auto-close the drawer on phones
  };

  return (
    <IDEShell
      activityItems={items}
      activityBottomItems={[
        {
          id: 'settings',
          label: 'Settings',
          icon: <Ionicons name="settings-outline" size={22} color={iconColor('settings')} />,
        },
      ]}
      activeView={view}
      onViewChange={(id) => setView(id as View | null)}
      panels={{
        files: <FileTreeSidebar provider={fileTree} selectedPath={activeTab} onSelect={openFile} />,
        search: <SearchPanel provider={search} onOpen={(h) => openFile(h.path)} />,
        scm: (
          <SourceControlPanel
            provider={git}
            onSelect={(e: GitStatusEntry) => {
              setDiff({ path: e.path, staged: e.staged });
              setView(null);
            }}
          />
        ),
        settings: <SettingsPanel store={settings} />,
      }}
    >
      <TabsBar
        tabs={tabs}
        activeId={activeTab}
        onSelect={setActiveTab}
        onClose={(p) => setOpenTabs((x) => x.filter((y) => y !== p))}
      />
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

## Persistence — AsyncStorage `SettingsStore`

The library's `SettingsStore` contract is platform-agnostic. For RN, back it with `AsyncStorage`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SettingsStore } from '@codeam/ide-native';

const PREFIX = 'codeam-ide:';
type Listener = (key: string, value: unknown) => void;
const listeners = new Set<Listener>();

export const settings: SettingsStore = {
  async get(key) {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : undefined;
  },
  async set(key, value) {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(value));
    for (const l of listeners) l(key, value);
  },
  watch(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
};
```

The `SettingsPanel` writes, the `InlineEditor` watches — the editor's theme / font / wrap / minimap / line-number options update live.

---

## Tips

1. **Memoise adapters with `useMemo`** keyed by workspace id. Allocating a fresh object on every render makes `FileTreeSidebar`'s load effect refire and the file list flickers.
2. **Mobile drawer** — `IDEShell` switches to a slide-over drawer below `mobileBreakpoint` (default 600px). On phones in portrait, picking a file auto-closes the drawer (`setView(null)`).
3. **The activity bar icon `color` is the consumer's responsibility.** Pass different colors for active vs inactive items — the library deliberately doesn't wrap your icon with `opacity` because some `@expo/vector-icons` builds hide the glyph when the parent has opacity < 1.
4. **Monaco + xterm.js are CDN-loaded inside WebViews.** First open requires network; subsequent opens hit the WebView cache.

---

## Cross-platform parity

Web equivalent: [`@codeam/ide-web`](https://www.npmjs.com/package/@codeam/ide-web). The two packages share `@codeam/ide-core` adapter types, so a single set of providers serves both surfaces.

---

## License

MIT © [Edgar Durand](https://github.com/edgar-durand)
