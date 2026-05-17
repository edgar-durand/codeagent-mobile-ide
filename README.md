# @codeam/ide

> A VS Code–style IDE component library for **React Native** and **React (DOM)**, designed to be embedded into any app. Pluggable backend via a small adapter contract — bring your own filesystem, Git, search and terminal providers.

[![npm version (core)](https://img.shields.io/npm/v/%40codeam%2Fide-core?label=%40codeam%2Fide-core)](https://www.npmjs.com/package/@codeam/ide-core)
[![npm version (web)](https://img.shields.io/npm/v/%40codeam%2Fide-web?label=%40codeam%2Fide-web)](https://www.npmjs.com/package/@codeam/ide-web)
[![npm version (native)](https://img.shields.io/npm/v/%40codeam%2Fide-native?label=%40codeam%2Fide-native)](https://www.npmjs.com/package/@codeam/ide-native)
[![CI](https://github.com/edgar-durand/codeagent-mobile-ide/actions/workflows/ci.yml/badge.svg)](https://github.com/edgar-durand/codeagent-mobile-ide/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## What is this?

`@codeam/ide` is the IDE surface that originally shipped inside [CodeAgent Mobile](https://www.codeagent-mobile.com), extracted into a standalone, framework-agnostic library so it can be embedded anywhere:

- A **mobile app** (Expo / bare React Native) that pairs to a remote workspace
- A **web dashboard** that exposes a hosted editor over a REST/WebSocket bridge
- A **VS Code extension** WebView panel that needs a portable editor
- An **Electron / Tauri** desktop app
- An **online code playground** that runs the IDE entirely in the browser

The library is **headless about the backend.** You implement a handful of small adapters (`FileFetcher`, `GitProvider`, `SearchProvider`, etc.) and the UI components do the rest. Same components on web and native; same adapter contract on both sides.

---

## Why?

|                                             | Existing options                                                                                   | `@codeam/ide`                                                  |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Want a VS Code-style editor in a mobile app | Roll your own around Monaco-in-a-WebView; or use Acode/Code Editor (local-only, no remote backend) | Drop-in `<FileViewerHost />` over your adapter                 |
| Want the same IDE on web and native         | Build twice, maintain twice                                                                        | Shared `@codeam/ide-core` contract + matched UI surfaces       |
| Want extensions                             | code-server / Theia (desktop-class, not mobile-friendly)                                           | (Phase 3, see [roadmap](./docs/roadmap/phase-3-extensions.md)) |
| Want a custom backend                       | Monaco docs ship a sample — the rest is up to you                                                  | The adapter contract IS the API                                |

---

## Packages

The repo is an `npm workspaces` monorepo. Three packages publish to npm under the `@codeam` scope:

| Package                                   | Description                                                                                                                          | Bundles                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| [`@codeam/ide-core`](./packages/core)     | Headless types + adapter contracts + `detectLanguage()`. UI-framework-agnostic — depend on this alone if you only need the contract. | ~3 KB gzipped                            |
| [`@codeam/ide-web`](./packages/web)       | React (DOM) UI: file viewer (Monaco via `@monaco-editor/react`), and (Phase 2) explorer, source control, search, terminal.           | TBD — Monaco lazy-loaded                 |
| [`@codeam/ide-native`](./packages/native) | React Native UI: same surfaces, Monaco hosted in a `react-native-webview`.                                                           | TBD — Monaco fetched from CDN at runtime |

All three ship on **one fixed version line**, identical to the
[codeagent-mobile-clients](https://github.com/edgar-durand/codeagent-mobile-clients)
release pipeline: a single `git tag vX.Y.Z` push triggers parallel publishes
of all three packages to npm, with release notes generated from the
Conventional Commits between tags.

---

## Install

### Web (React DOM)

```bash
npm install @codeam/ide-web @codeam/ide-core
```

Peer deps: `react >=18`, `react-dom >=18`.

### Native (React Native / Expo)

```bash
npm install @codeam/ide-native @codeam/ide-core
npm install react-native-safe-area-context react-native-webview @expo/vector-icons
```

Peer deps: `react >=18`, `react-native >=0.74`, `react-native-safe-area-context >=4`, `react-native-webview >=13`, `@expo/vector-icons >=14`.

### Headless (Node / server / TypeScript-only)

```bash
npm install @codeam/ide-core
```

No React, no DOM, no platform runtime. Useful if you're writing a backend that implements the adapter interface and wants the types.

---

## Quick start

### 1. Implement the adapter for your backend

The `FileFetcher` is the minimum contract for Phase 1 — read/write a file by path. Plug it into the workspace, Git host, or proxy your CLI:

```ts
import type { FileFetcher } from '@codeam/ide-core';

export const myFetcher: FileFetcher = {
  label: 'session-abc',
  canWrite: true,
  async read(path) {
    const r = await fetch(`/api/files/${encodeURIComponent(path)}`);
    if (!r.ok) return { error: r.statusText };
    return { content: await r.text() };
  },
  async write(path, content) {
    const r = await fetch(`/api/files/${encodeURIComponent(path)}`, {
      method: 'PUT',
      body: content,
    });
    return r.ok ? { bytesWritten: content.length } : { error: r.statusText };
  },
};
```

### 2. Mount the provider + host

#### Web

```tsx
import { FileViewerProvider, FileViewerHost, useFileViewer } from '@codeam/ide-web';

export function MyPage() {
  return (
    <FileViewerProvider fetcher={myFetcher}>
      <FileViewerHost />
      <FileLink path="src/index.ts" />
    </FileViewerProvider>
  );
}

function FileLink({ path }: { path: string }) {
  const { open } = useFileViewer();
  return <button onClick={() => open({ path, op: 'Read' })}>{path}</button>;
}
```

#### Native

```tsx
import { FileViewerProvider, FileViewerHost, useFileViewer } from '@codeam/ide-native';
import { Button } from 'react-native';

export function MyScreen() {
  return (
    <FileViewerProvider fetcher={myFetcher}>
      <FileViewerHost />
      <FileLink path="src/index.ts" />
    </FileViewerProvider>
  );
}

function FileLink({ path }: { path: string }) {
  const { open } = useFileViewer();
  return <Button title={path} onPress={() => open({ path, op: 'Read' })} />;
}
```

That's it. Tapping the link pops a fullscreen editor with Monaco syntax highlighting, dirty-state detection, save button, and `Cmd/Ctrl+S` keybinding.

---

## API reference (Phase 1)

### Types (`@codeam/ide-core`)

```ts
interface FileFetcher {
  label: string;
  canWrite: boolean;
  read(path: string): Promise<FileReadResult>;
  write(path: string, content: string): Promise<FileWriteResult>;
}

interface FileReadResult {
  content?: string;
  error?: string;
}

interface FileWriteResult {
  bytesWritten?: number;
  error?: string;
}

interface FileViewerRequest {
  path: string;
  op: 'Read' | 'Write';
}

function detectLanguage(path: string): string;
```

Plus the future-facing contracts already declared but not wired into UI yet: `GitProvider`, `FileTreeProvider`, `SearchProvider`, `TerminalProvider`, `IdeAdapters`. See `packages/core/src/types/` for the full surface.

### Components (`@codeam/ide-web` and `@codeam/ide-native`)

```tsx
<FileViewerProvider fetcher={FileFetcher | null}>{children}</FileViewerProvider>
<FileViewerHost />
useFileViewer(): { request, fetcher, open, close }
```

The host is a no-op until `request !== null`. The provider returns a safe no-op surface when used without a wrapping provider (so code that lazy-mounts an IDE doesn't crash on cold render).

---

## Stability invariants (read this before integrating)

### `fetcher` identity must be stable

The host's `useEffect` keys off `fetcher` identity. Allocating a fresh adapter on every render — e.g. `<FileViewerProvider fetcher={createFetcher(sessionId)}>` — re-fires the effect and re-fetches the file on every parent re-render. Visible symptom: the open file flickers / re-loads constantly while the parent updates.

**Fix:** cache by id in a module-level `Map`, or memoise with `useMemo(() => createFetcher(sessionId), [sessionId])`.

The internal pattern we use in CodeAgent Mobile lives in [`createSessionFileFetcher`](https://github.com/edgar-durand/codeagent-mobile/blob/main/apps/mobile/src/components/fileViewer/FileViewerContext.tsx) — feel free to copy.

### Adapter `read` / `write` must be idempotent-safe

The host calls `read` once per `open()`. Implementations should not have side effects on read. Writes are user-initiated (Save button or `Cmd/Ctrl+S`).

### Monaco loads from CDN on `@codeam/ide-native`

Bundling Monaco into a React Native bundle would add 5+ MB to cold-start. We fetch it from jsDelivr inside the WebView on first open. Consumers who need offline operation can override this in a later release via a `monacoLoader` prop (Phase 2, see roadmap).

---

## Roadmap

Phase 1 (this release, **v0.1.0**) ships the file viewer alone. The library is designed to grow into a full VS Code–style IDE — the spec for that work is in [`docs/roadmap/`](./docs/roadmap):

- **[Phase 2 — VS Code-like core features](./docs/roadmap/phase-2-features.md)** _(2–4 weeks)_: file explorer with tree view, multi-file search, source control panel with diff & commit, terminal panel, settings, themes, tabs and breadcrumbs.
- **[Phase 3 — Extensions runtime](./docs/roadmap/phase-3-extensions.md)** _(2–3 months)_: VS Code-compatible extension manifest, Web Worker sandbox, `vscode.*` API shim, Open VSX marketplace integration. The product moat.
- **[Phase 4 — Go-to-market & monetisation](./docs/roadmap/phase-4-gtm.md)** _(ongoing)_: pricing tiers, App Store policy, paid extensions, revshare with extension authors.

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the layered model and design constraints; [`CONTRIBUTING.md`](./CONTRIBUTING.md) for how to work on the library.

---

## Local development

```bash
# Clone + install once at the repo root (installs all workspaces).
git clone https://github.com/edgar-durand/codeagent-mobile-ide.git
cd codeagent-mobile-ide
npm install

# Build all packages.
npm run build

# Build a single package in watch mode.
npm run dev --workspace @codeam/ide-core

# Typecheck / lint / test.
npm run typecheck
npm run lint
npm test

# Release flow — tag-triggered, same pattern as codeagent-mobile-clients.
# When the maintainer is ready to cut a release:
git tag v0.2.0
git push origin v0.2.0
# → GitHub Actions builds + publishes @codeam/ide-core, -web, -native
#   to npm in parallel, then generates release notes from the
#   conventional commits since the previous tag (git-cliff), prepends
#   them to each package's CHANGELOG.md, and drafts a GitHub Release.
```

A `husky` pre-commit hook runs `lint-staged` against your staged files, plus `commitlint` enforces Conventional Commits with the scope set defined in [`commitlint.config.mjs`](./commitlint.config.mjs).

---

## Comparison with similar projects

|                           | This                            | code-server            | Theia                   | Acode                 | Monaco alone |
| ------------------------- | ------------------------------- | ---------------------- | ----------------------- | --------------------- | ------------ |
| Embeddable as components  | ✅                              | ❌ (full app)          | ❌ (full app)           | ❌ (full app)         | ✅           |
| Web                       | ✅                              | ✅                     | ✅                      | ❌                    | ✅           |
| React Native / mobile     | ✅                              | ❌                     | ❌                      | ❌ (own native shell) | ❌           |
| Pluggable backend adapter | ✅                              | ❌ (file-system bound) | ⚠️ (Theia plugin layer) | ❌                    | n/a          |
| VS Code extensions        | 🟡 (Phase 3)                    | ✅                     | ✅                      | ❌                    | ❌           |
| Bundle size               | Small (Monaco loaded on demand) | Heavy                  | Heavy                   | Native binary         | Small        |

Acode is the closest "mobile IDE" but it's Android-only and local-filesystem-only. code-server is great on desktop but doesn't ship as a library you can drop into your app. Monaco alone is just the editor — no file viewer, no Git, no extensions UI.

---

## Frequently asked

### Can I use this without React?

Not yet. `@codeam/ide-core` is framework-agnostic, but the UI surfaces both target React. A vanilla / web-component wrapper around `@codeam/ide-web` is a possible follow-up if there's demand — the host doesn't depend on React anywhere except its lifecycle, which can be wrapped.

### Does it work with Next.js / Remix / Nuxt?

`@codeam/ide-web` is ESM + CJS dual and tree-shakeable. It works with any modern React-supporting framework. Monaco's WebWorker setup is handled by `@monaco-editor/react`, which has good documentation for these frameworks if you need to customise the worker URL.

### Does the editor work offline?

Phase 1 fetches Monaco from `cdn.jsdelivr.net` on first use. If your app must work without network access, see the Phase 2 milestone where we add a `monacoLoader` prop for self-hosted assets.

### What's the App Store story for extensions?

Apple is strict about apps that download and execute arbitrary JS. The Phase 3 design constrains extensions to a Web Worker sandbox with a curated `vscode.*` API surface — same model that pass-review apps like Replit / CodeSandbox use. The full design notes are in [`docs/roadmap/phase-3-extensions.md`](./docs/roadmap/phase-3-extensions.md).

### Can I use VS Code themes?

Phase 1 ships a single dark theme. Phase 2 adds theme support via JSON files compatible with VS Code's theme format — drop in any theme from the VS Code marketplace and it should render correctly.

---

## Contributing

PRs and issues welcome. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the development workflow, commit-message rules (Conventional Commits, allowed scopes are listed in `commitlint.config.mjs`), and the tag-triggered release flow.

Security issues: please email instead of opening a public issue — see [`SECURITY.md`](./SECURITY.md).

---

## Acknowledgements

- [Monaco Editor](https://github.com/microsoft/monaco-editor) by Microsoft — the editor heart
- [`@monaco-editor/react`](https://github.com/suren-atoyan/monaco-react) — the React binding we lean on for the web surface
- [VS Code](https://github.com/microsoft/vscode) — the reference design we're tracking for Phases 2-3
- [CodeAgent Mobile](https://www.codeagent-mobile.com) — where this codebase started life

---

## License

MIT — see [`LICENSE`](./LICENSE).
