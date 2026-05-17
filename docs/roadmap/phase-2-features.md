# Phase 2 — VS Code-like core features

**Goal:** match VS Code's "out of the box, no extensions" feature surface for the workspace UI. After Phase 2 the library is a usable IDE on its own — extensions (Phase 3) become a multiplier, not a prerequisite.

**Estimated effort:** 2–4 weeks of focused work, iterative.

**Versioning:** ships as `0.2.0`, `0.3.0`, etc. via Changesets — each feature milestone is a minor bump on its own merge.

---

## Milestones

Each milestone lists the surface area to implement, the adapter requirements (new contracts in `@codeam/ide-core`), and acceptance criteria. The order is the recommended implementation order — earlier milestones unblock later ones.

### M1 — File explorer

**Status:** not started.

**Adapter:** `FileTreeProvider` (already declared in `@codeam/ide-core/src/types/file-tree.ts`).

**UI surface:**

- Virtualised tree view (`react-virtuoso` on web, `FlashList` on native)
- Lazy-expand directories
- Right-click / long-press context menu: open, copy path, reveal in file system (when supported by provider), delete (when `provider.canWrite`)
- Drag-and-drop reorder (Phase 2 nice-to-have, can defer)
- Inline rename (double-tap on native, F2 / double-click on web)

**Acceptance:**

- 1,000-file repo renders smoothly (<16 ms / frame on a mid-tier Android)
- Tapping a file opens it in the `FileViewerHost`
- The provider's `truncated` flag surfaces a "Show more" affordance

**Extracted from:** [`apps/landing/src/pages/ide/FileTreeSidebar.tsx`](https://github.com/edgar-durand/codeagent-mobile/blob/main/apps/landing/src/pages/ide/FileTreeSidebar.tsx) — already shipping in the dashboard, just needs to move into the library + add a native equivalent.

---

### M2 — Source control panel

**Status:** not started.

**Adapter:** `GitProvider` (declared in `@codeam/ide-core/src/types/git.ts`).

**UI surface:**

- "Changes" tab listing staged + unstaged files with status codes
- "Graph" tab (optional, can defer) — minimal commit graph
- Diff viewer (Monaco's built-in `DiffEditor`) with side-by-side / inline toggle
- Stage / unstage / discard per-file controls
- Commit message input + Commit button
- Push button with sync-changes indicator (ahead/behind)
- "Publish to GitHub" CTA when `upstream === null` (carry over from current landing)

**Acceptance:**

- Open a file with conflicts; conflict-resolution toolbar surfaces (accept-current / accept-incoming / accept-both)
- Commit emoji + Conventional Commits prefix presets toggleable in settings

**Extracted from:** [`apps/landing/src/pages/ide/ChangesTab.tsx`](https://github.com/edgar-durand/codeagent-mobile/blob/main/apps/landing/src/pages/ide/ChangesTab.tsx) + [`CommitDialog.tsx`](https://github.com/edgar-durand/codeagent-mobile/blob/main/apps/landing/src/pages/ide/CommitDialog.tsx) — same pattern as M1, port + add native equivalent.

---

### M3 — Multi-file search

**Status:** not started.

**Adapter:** `SearchProvider` (declared in `@codeam/ide-core/src/types/search.ts`).

**UI surface:**

- Search input with regex / case / whole-word toggles
- Include / exclude glob inputs
- Results grouped by file with inline preview + match highlight
- Tap-to-open at exact line/column
- Replace input + "Replace All" / "Replace in File" buttons (when adapter is writeable)

**Acceptance:**

- Streams results as the provider yields them (no "loading…" wall for 10s on big repos)
- 10K-hit search degrades gracefully — pagination or virtualisation, never freeze

**No prior art in codeagent-mobile** — new code. Provider implementation suggested via `ripgrep` proxy in the CLI.

---

### M4 — Terminal panel

**Status:** not started.

**Adapter:** `TerminalProvider` (declared in `@codeam/ide-core/src/types/terminal.ts`).

**UI surface:**

- `xterm.js` (web) / a compatible RN component (mobile — `react-native-xterm` is the obvious choice but may need a fork)
- Tabbed terminals (open multiple shells)
- Resize handle / drag-to-resize on web; bottom-sheet on native
- Keybindings: `Ctrl+C`, `Ctrl+D`, paste from clipboard, copy selection

**Acceptance:**

- Survives backgrounding on Android without dropping the session
- The provider's pub/sub subscription is cleaned up on unmount (matches the shared-subscriber pool pattern from `@codeagent/api`)

**This is the most expensive milestone** — the React Native side of terminal rendering doesn't have a mature off-the-shelf component. Estimate 1–1.5 weeks alone.

---

### M5 — Settings + themes

**Status:** not started.

**Adapter:** none required. Settings live in the consumer's storage (passed in as a `SettingsStore` interface).

**UI surface:**

- Settings drawer with tabs: Editor, Appearance, Workspace, Extensions (Phase 3)
- JSON view for power users (Monaco-rendered, with schema validation)
- Theme picker — drop in any VS Code-format JSON theme
- Font family + size, tab size, word wrap, minimap, line numbers, etc.

**Acceptance:**

- All settings changes take effect without reload
- Bundled themes: `vs-dark` (current), `vs-light`, `github-dark`, `github-light`
- Theme JSON files from the VS Code marketplace work without modification

---

### M6 — Tabs + breadcrumbs

**Status:** not started.

**Adapter:** none required (pure UI on top of `FileFetcher`).

**UI surface:**

- Open files as tabs above the editor (web) / bottom strip (native)
- Tab actions: close, close others, close right, close all, split (web only)
- Breadcrumb path above the editor — clickable segments for parent directories
- Symbol breadcrumb (function/class within the file) — uses Monaco's `getSymbols`

**Acceptance:**

- Closing an unsaved tab prompts for save / discard / cancel
- Tab list persists across reloads (consumer's `SettingsStore` keys it)

---

## Adapter contract additions

Phase 2 doesn't change the existing `FileFetcher` contract. It implements the four already-declared types in `@codeam/ide-core`:

```ts
// @codeam/ide-core
export interface FileTreeProvider { ... }   // M1
export interface GitProvider     { ... }   // M2
export interface SearchProvider  { ... }   // M3
export interface TerminalProvider { ... }   // M4
```

Plus one new interface for M5:

```ts
export interface SettingsStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  watch(callback: (key: string, value: unknown) => void): () => void;
}
```

---

## Non-goals for Phase 2

To keep scope bounded, the following are explicitly **deferred** to Phase 3 or beyond:

- **Extensions** — see [Phase 3](./phase-3-extensions.md)
- **Language servers (LSP)** — partial typing support via Monaco's built-in (TS, JSON) only. Full LSP requires a server bridge and is a Phase 3 concern.
- **Debugging UI** — out of scope. Even VS Code-server doesn't ship this without an extension.
- **Notebook view (`.ipynb`)** — out of scope. Could be Phase 4.
- **Live share / collaborative editing** — out of scope.

---

## Acceptance for "Phase 2 complete"

- All six milestones merged + released (each as its own minor bump)
- Native + web demos in `examples/` exercise all six features
- README updated with the new APIs documented
- A side-by-side demo video / GIF in the README header showing the library matches VS Code's basic UX on both platforms
- Storybook (or equivalent) covering each component

After this, the library is positioned as a credible "VS Code lite" you can embed anywhere — Phase 3 (extensions) becomes the differentiator that moves it from "good IDE library" to "VS Code competitor on mobile."
