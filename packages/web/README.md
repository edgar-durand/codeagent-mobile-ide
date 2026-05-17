# @codeam/ide-web

React (DOM) UI surface of [`@codeam/ide`](https://github.com/edgar-durand/codeagent-mobile-ide).

Drops into any React web app as components. Bring your own backend via the
[`FileFetcher`](https://github.com/edgar-durand/codeagent-mobile-ide/tree/main/packages/core)
adapter contract — the package itself doesn't assume any particular API.

## Install

```bash
npm install @codeam/ide-web @codeam/ide-core
```

Peer dependencies:

```bash
npm install react react-dom
```

`@monaco-editor/react` ships as a regular dependency, so Monaco is bundled
on first use without you wiring it up. The package is ESM + CJS dual; works
with Vite, Next.js, Create React App, Remix, etc.

## Usage

```tsx
import {
  FileViewerProvider,
  FileViewerHost,
  useFileViewer,
  type FileFetcher,
} from '@codeam/ide-web';

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

function MyPage() {
  return (
    <FileViewerProvider fetcher={fetcher}>
      <FileViewerHost />
      <YourContent />
    </FileViewerProvider>
  );
}

function FileLink({ path }: { path: string }) {
  const { open } = useFileViewer();
  return <button onClick={() => open({ path, op: 'Read' })}>{path}</button>;
}
```

## Stability tip

Same as the native package: the `fetcher` prop's identity needs to be
stable across renders. Module-level cache by id is the simplest approach;
`useMemo` works for component-scoped fetchers.

## What's NOT in here yet

Phase 1 ships the file viewer only. The file explorer, source control,
search, terminal, settings, themes, and extension surfaces are tracked in
the [roadmap](https://github.com/edgar-durand/codeagent-mobile-ide/tree/main/docs/roadmap).

## License

MIT
