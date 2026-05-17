# @codeam/ide-native

React Native UI surface of [`@codeam/ide`](https://github.com/edgar-durand/codeagent-mobile-ide).

Drops into any Expo / RN app as React components. Bring your own backend
via the [`FileFetcher`](https://github.com/edgar-durand/codeagent-mobile-ide/tree/main/packages/core)
adapter contract — the package itself doesn't assume any particular API.

## Install

```bash
npm install @codeam/ide-native @codeam/ide-core
```

Peer dependencies:

```bash
npm install react react-native react-native-safe-area-context react-native-webview @expo/vector-icons
```

The Monaco editor is loaded on-demand from jsDelivr inside the WebView, so
no Monaco bundle is shipped with the package itself.

## Usage

```tsx
import {
  FileViewerProvider,
  FileViewerHost,
  useFileViewer,
  type FileFetcher,
} from '@codeam/ide-native';

// 1. Implement the FileFetcher contract for your backend.
const fetcher: FileFetcher = {
  label: 'session-abc',
  canWrite: true,
  async read(path) {
    const res = await myApi.readFile(path);
    return res.ok ? { content: res.body } : { error: res.error };
  },
  async write(path, content) {
    const res = await myApi.writeFile(path, content);
    return res.ok ? { bytesWritten: content.length } : { error: res.error };
  },
};

// 2. Wrap your screen with the provider and mount the host once.
function MyScreen() {
  return (
    <FileViewerProvider fetcher={fetcher}>
      <FileViewerHost />
      <YourContent />
    </FileViewerProvider>
  );
}

// 3. Anywhere inside the subtree, call open() to pop the editor.
function FileLink({ path }: { path: string }) {
  const { open } = useFileViewer();
  return <Button title={path} onPress={() => open({ path, op: 'Read' })} />;
}
```

## Stability tip

Make sure the `fetcher` you pass to `<FileViewerProvider>` has a stable
reference across renders. Allocating it inline in JSX
(`fetcher={createFetcher(sessionId)}`) re-creates it on every parent
render and forces the host to refetch the open file (visible flicker).
Recommended pattern: cache by id in a module-level `Map`, or memoise
with `useMemo`:

```ts
const fetcher = useMemo(() => createFetcher(sessionId), [sessionId]);
```

## What's NOT in here yet

Phase 1 ships the file viewer only. The file explorer, source control,
search, terminal, settings, themes, and extension surfaces are tracked in
the [roadmap](https://github.com/edgar-durand/codeagent-mobile-ide/tree/main/docs/roadmap).

## License

MIT
