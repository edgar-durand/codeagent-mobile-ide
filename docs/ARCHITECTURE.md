# Architecture

High-level design notes for `@codeam/ide`. Pairs with the per-phase roadmap docs in `docs/roadmap/`.

---

## Layered model

```
┌──────────────────────────────────────────────────────┐
│  Consumer app (CodeAgent Mobile, your app, …)        │
│  - Owns the backend (REST / SSE / WebSocket / local) │
│  - Provides adapters that implement the contracts    │
│  - Mounts the IDE UI components inside its routes    │
└──────────────────────────────────────────────────────┘
                          ▲
                          │ adapters in
                          │
┌──────────────────────────────────────────────────────┐
│  @codeam/ide-web   │   @codeam/ide-native             │
│  React DOM UI      │   React Native UI                │
│                                                       │
│  FileViewerProvider, FileViewerHost, (Phase 2:        │
│  FileTreeSidebar, SourceControlPanel, SearchPanel,    │
│  TerminalPanel, SettingsDrawer, ExtensionMarketplace) │
└──────────────────────────────────────────────────────┘
                          ▲
                          │ imports types from
                          │
┌──────────────────────────────────────────────────────┐
│  @codeam/ide-core                                    │
│  - Adapter interfaces                                │
│    FileFetcher, GitProvider, FileTreeProvider,        │
│    SearchProvider, TerminalProvider, SettingsStore    │
│  - Payload types                                     │
│  - Pure helpers (detectLanguage)                     │
│  - Zero runtime dependencies on a UI framework       │
└──────────────────────────────────────────────────────┘
```

The dependency direction is **strictly downward**. `@codeam/ide-core` knows nothing about React. `@codeam/ide-web` and `@codeam/ide-native` know about React but not about each other. Consumer apps know about everything and own the wiring.

---

## Design principles

1. **Backend-agnostic by construction.** No UI component imports anything from a specific backend (CodeAgent CLI, GitHub Codespaces, etc.). The contract is the API. Consumers swap backends without touching the library.

2. **Stable identity for adapters.** All components key their `useEffect` lifecycles off adapter identity. Adapter factories must return the same instance for the same id — module-level `Map` cache or `useMemo` on the consumer side. This is documented in every consumer-facing README to avoid the flicker class of bugs.

3. **Same surface on web and native.** When a component exists in both `@codeam/ide-web` and `@codeam/ide-native`, the props are identical and the behaviour matches. Cross-platform consumers can swap the import path without touching call sites.

4. **No tooling lock-in for consumers.** No required Tailwind config, no required babel plugin, no required webpack loader. The packages ship with inline styles or framework-native equivalents (StyleSheet on RN). Themes are JSON.

5. **Monaco loaded lazily.** Bundling 5+ MB of editor code into a consumer's main bundle is a non-starter. Web uses `@monaco-editor/react`'s on-demand loader; native fetches Monaco from a CDN inside a WebView on first open. Phase 2 adds a `monacoLoader` prop for self-hosted assets.

6. **Phase-gated feature delivery.** Phase 1 ships file viewer + the adapter contracts. Phases 2/3/4 add features incrementally — each phase has explicit acceptance criteria so we never claim "done" without measuring it.

---

## Repo layout

```
codeagent-mobile-ide/
├── packages/
│   ├── core/                 # @codeam/ide-core
│   ├── web/                  # @codeam/ide-web
│   └── native/               # @codeam/ide-native
├── examples/                 # consumer examples — runnable, used as smoke tests
├── docs/
│   ├── ARCHITECTURE.md       # this file
│   └── roadmap/
│       ├── phase-2-features.md
│       ├── phase-3-extensions.md
│       └── phase-4-gtm.md
├── .changeset/               # Changesets-managed release pipeline
├── .github/workflows/        # CI + Release
├── .husky/                   # pre-commit / commit-msg hooks
├── eslint.config.js          # ESLint v9 flat config (shared by all packages)
├── tsconfig.base.json        # shared compiler options
├── commitlint.config.mjs     # Conventional Commits with library-specific scopes
└── package.json              # workspace root
```

Each package owns:

- Its own `package.json` (independent publishable unit)
- Its own `tsconfig.json` (extends `../../tsconfig.base.json`)
- Its own `tsup.config.ts` (build config — ESM + CJS + d.ts)
- Its own `README.md` (per-package npm landing page)

---

## Build pipeline

- **`tsup`** for builds. Fast (esbuild under the hood), produces ESM + CJS + `.d.ts` in one pass, plays nice with monorepos.
- **`vitest`** for tests. Lighter than Jest, faster startup, native ESM support — good fit for a library.
- **ESLint v9 flat config** at the repo root, shared by all packages.
- **Prettier** for formatting. Standard config: 100 col, 2 spaces, single quotes, trailing commas.
- **`husky` + `lint-staged`** runs ESLint on staged files at commit time.
- **`commitlint`** enforces Conventional Commits with the scope list in `commitlint.config.mjs`.
- **`changesets`** for versioning + publishing. All three packages share a fixed version line via the `fixed` config in `.changeset/config.json` — a `vX.Y.Z` release moves all three at once.

---

## CI / release flow

### CI (`.github/workflows/ci.yml`)

Runs on every push and PR to `main`:

1. `commitlint` — PR commit messages
2. `npm run lint`
3. `npm run typecheck`
4. `npm run build` (all packages)
5. `npm test`

### Release (`.github/workflows/release.yml`)

Runs on every push to `main`. Uses the `changesets/action`:

- If there are pending changesets, opens (or updates) a "Version packages" PR
- When that PR merges, the next run publishes the bumped packages to npm

Secrets required (set in GitHub repo settings → Secrets):

- `NPM_TOKEN` — npmjs.com automation token with publish scope on the `@codeam` org

---

## Cross-repo coordination

The library lives in this repo (public). Consumer apps live elsewhere:

- `codeagent-mobile` (private) — the mobile + landing + backend, depends on `@codeam/ide-web` + `@codeam/ide-native`
- `codeagent-mobile-clients` (public) — the CLI + VS Code/JetBrains plugins, depends on `@codeam/ide-core` for the adapter contracts

When the adapter contract changes:

1. Land the contract change here as a `minor` bump (or `major` if it's breaking)
2. Update consumers to the new version
3. If the change is breaking, give consumers a deprecation window via overload-compatible additions before removing the old surface

Adapter contracts are public API. Treat changes accordingly.

---

## Adapter pattern recap

Every IDE surface depends on at most one adapter. The adapter is a small interface — no inheritance, no class hierarchies, just an object with the methods declared in the contract.

```ts
// You write this:
const fetcher: FileFetcher = {
  label: 'session-abc',
  canWrite: true,
  read: async (path) => { ... },
  write: async (path, content) => { ... },
};

// We render this:
<FileViewerProvider fetcher={fetcher}>
  <FileViewerHost />
</FileViewerProvider>
```

Same model for `GitProvider`, `FileTreeProvider`, `SearchProvider`, `TerminalProvider`. Each component receives only the adapter it needs — no "god object" with every capability. This makes testing trivial (mock the adapter) and lets consumers ship without a feature they haven't implemented yet (skip the adapter, the component renders an empty state).

---

## What this architecture optimises for

- **Adoption.** Drop into any React-based app with a 5-line wiring.
- **Iteration.** Each phase adds adapter contracts + UI surfaces independently — no big-bang releases.
- **Compatibility.** VS Code's mental model is preserved (Monaco editor, VS Code-format manifest, Open VSX marketplace) so users and extension authors don't need to learn new concepts.

## What it deliberately doesn't optimise for

- **No-React consumers.** Phase 1+ targets React only. Webcomponent wrapper is possible later but not in scope.
- **Local-only file systems.** All flows assume an adapter that can fail / be slow. Local file access is just one possible adapter.
- **Desktop-class extensions.** Phase 3 supports the most-used VS Code extension APIs, not all 200+. Extensions requiring `child_process`, debugger UI, or notebook view are out of scope for v1.
