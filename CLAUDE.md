# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working inside this repository.

## Overview

This repo is **`@codeam/ide`** — a VS Code-style IDE component library for React Native and React (DOM), designed to be embedded into any app. Three packages publish under one fixed-version line:

- **`@codeam/ide-core`** — headless types + adapter contracts + pure helpers. Zero deps on a UI framework.
- **`@codeam/ide-web`** — React DOM UI surface. Monaco editor via `@monaco-editor/react`.
- **`@codeam/ide-native`** — React Native UI surface. Monaco hosted in `react-native-webview`.

The IDE library was extracted from [CodeAgent Mobile](https://www.codeagent-mobile.com)'s in-app file viewer (`apps/mobile/src/components/fileViewer/` + `apps/landing/src/pages/session/fileViewer/`). Phase 1 ships the file viewer; Phases 2-4 are documented but not implemented — see [`docs/roadmap/`](./docs/roadmap).

## Monorepo structure

```
codeagent-mobile-ide/
├── packages/
│   ├── core/                 # @codeam/ide-core
│   ├── web/                  # @codeam/ide-web
│   └── native/               # @codeam/ide-native
├── examples/                 # (empty, populated in Phase 2)
├── .github/workflows/        # CI (lint+build+typecheck+test on PR/push) + Release (tag-triggered)
├── .husky/                   # pre-commit + commit-msg hooks
├── cliff.toml                # git-cliff config — Conventional Commits → CHANGELOG sections
├── commitlint.config.mjs     # Conventional Commits with library-specific scopes
├── eslint.config.mjs         # ESLint v9 flat config (shared by all packages)
├── tsconfig.base.json        # shared compiler options
└── package.json              # workspace root (npm workspaces)
```

## Commands

### Root

```bash
npm install        # installs all workspaces
npm run build      # builds all packages (tsup → ESM + CJS + d.ts)
npm run typecheck  # builds core first (so its dts is available), then typechecks all
npm run lint       # ESLint v9 flat config, max-warnings=0
npm test           # vitest run (--passWithNoTests in each package)
npm run format     # prettier --write across the repo
```

### Per package

```bash
npm run build --workspace @codeam/ide-core      # one-off build
npm run dev   --workspace @codeam/ide-core      # tsup --watch
npm run test  --workspace @codeam/ide-web       # vitest run
```

## Architecture invariants — non-negotiable

1. **Dependency direction is strictly downward.** `@codeam/ide-core` knows nothing about React. `@codeam/ide-web` and `@codeam/ide-native` know about React but never about each other. Consumer apps know about everything and own the wiring.

2. **Adapter pattern is the public API.** Every UI surface depends on at most one adapter (`FileFetcher`, `GitProvider`, `FileTreeProvider`, `SearchProvider`, `TerminalProvider`). All declared in `@codeam/ide-core/src/types/`. New surfaces add a new adapter contract there first — UI code never imports a specific backend.

3. **Adapter identity must be stable across renders.** Components key their `useEffect` lifecycles off adapter identity. Allocating a fresh adapter every render (e.g. `<FileViewerProvider fetcher={createFetcher(id)}>`) causes the host to re-fetch on every parent re-render — the user-visible "FileViewer flickers" bug. Pattern: cache by id in a module-level `Map`, or memoise with `useMemo(() => createFetcher(id), [id])`.

4. **No Monaco bundled into the consumer's main bundle.** Web uses `@monaco-editor/react`'s on-demand loader; native fetches Monaco from a CDN inside a WebView on first open. Consumers who need offline operation will be served by a Phase 2 `monacoLoader` prop, not by pre-bundling.

5. **Same surface on web and native.** When a component exists in both `@codeam/ide-web` and `@codeam/ide-native`, the props are identical and the behaviour matches. Cross-platform consumers swap the import path without touching call sites.

6. **CHANGELOGs are auto-generated.** Do NOT hand-edit `packages/*/CHANGELOG.md`. The Release workflow runs git-cliff and prepends a new section per tag. Write better commit messages instead.

## Commit conventions

[Conventional Commits](https://www.conventionalcommits.org/) — enforced by `commitlint` via the `commit-msg` hook locally and CI in PRs.

```
<type>(<scope>): <subject>

<body>
```

**Allowed scopes** (defined in `commitlint.config.mjs`): `core`, `web`, `native`, `examples`, `workflow`, `meta`, `deps`, `release`, `changelog`, `docs`.

Examples:

```
feat(web): add file-tree sidebar
fix(native): safe-area insets for Android fullscreen modal
docs(meta): clarify adapter stability invariant in README
chore(deps): bump tsup to 8.4
refactor(core): split SearchProvider streaming interface from snapshot
```

Breaking changes: append `!` after type/scope (`feat(core)!: rename FileFetcher.canWrite to readonly`) or add a `BREAKING CHANGE:` footer.

## Release flow — non-negotiable

**Tag-triggered, identical pattern to `codeagent-mobile-clients`.** Never run `npm publish` manually.

```bash
git tag v0.2.0
git push origin v0.2.0
```

The Release workflow (`.github/workflows/release.yml`):

1. **`setup`** validates the tag matches `vMAJOR.MINOR.PATCH[-prerelease]`
2. **`publish-core`** patches `packages/core/package.json` version, builds, publishes to npm
3. **`publish-web`** + **`publish-native`** run in parallel after core; each patches its own version AND the `@codeam/ide-core` dependency pin to match, builds, publishes
4. **`release`** runs `git-cliff` over commits between the previous and current tag (config: [`cliff.toml`](./cliff.toml)), prepends notes to each package's `CHANGELOG.md`, commits back to `main` with `chore(changelog): notes for vX.Y.Z [skip ci]`, creates a GitHub Release using the same notes

A pre-release tag (`vX.Y.Z-rc.N`) follows the same path but the GitHub Release is marked `prerelease: true`.

All three packages move together — there's no per-package versioning. A semver-significant change in any one of them moves all three.

**Secrets required** (set in repo Settings → Secrets):

- `NPM_TOKEN` — npmjs.com automation token with publish scope on the `@codeam` org

## Local development guards

- **Husky pre-commit** runs `lint-staged`: ESLint on staged `*.{ts,tsx}` (with `--max-warnings=0`) and Prettier on staged `*.{json,md,yml}`. To bypass in emergency: `git commit --no-verify` — but it WILL fail CI, so prefer fixing the issue.
- **Husky commit-msg** runs `commitlint` against your message. Scope must be in the enum above.
- **Pre-commit, ESLint v9 only:** the lint config is flat (`eslint.config.mjs`). Don't add an `.eslintrc.*` file.

## Cross-repo coordination

This repo is consumed by:

- **`codeagent-mobile`** (private) — the iOS / Android / web dashboard. Depends on `@codeam/ide-web` (landing) and `@codeam/ide-native` (mobile). Will migrate its in-app `fileViewer/` to this library in a future Phase 2 cleanup.
- **`codeagent-mobile-clients`** (public) — the `codeam-cli` + VS Code / JetBrains plugins. Depends on `@codeam/ide-core` for the adapter contracts they implement on the server side.

When the adapter contract changes:

1. Land the contract change here as a `feat`/`fix` (or `feat!`/`fix!` if breaking).
2. Cut a new release (tag).
3. Update consumers to depend on the new version.
4. If breaking, give consumers a deprecation window via overload-compatible additions before removing the old surface.

Adapter contracts are public API. Treat changes accordingly.

## Code style

- **Prettier**: 100-char line width, 2-space indent, semicolons, single quotes, trailing commas.
- **TypeScript**: ES2022 target, `Bundler` moduleResolution, `strict: true`, `noUncheckedIndexedAccess: true`.
- **ESLint**: TypeScript parser + react-hooks + react. Rules: `@typescript-eslint/no-explicit-any: error` (no `any`), `no-console` allows only `warn` / `error`, unused vars OK if prefixed with `_`.

## Adding a new package

1. Create `packages/<name>/` with `package.json`, `tsconfig.json`, `tsup.config.ts`, `src/index.ts`, `README.md`.
2. Name it `@codeam/<name>` and publish-access `public`.
3. Add it to the fixed-version line in `cliff.toml` and the workflow's publish topology.
4. Per-package `tsconfig.json` should `extend` `../../tsconfig.base.json` and set its own `outDir` / `rootDir`.

## Adding a new adapter contract

1. Define the contract in `packages/core/src/types/<name>.ts` as a `interface XxxProvider`.
2. Re-export it from `packages/core/src/index.ts` so consumers can `import type { XxxProvider } from '@codeam/ide-core'`.
3. Add it to `IdeAdapters` in `packages/core/src/types/adapters.ts` if it's part of the aggregate convenience type.
4. Document the contract in the per-package README under "API surface".

## What NOT to do

- **Don't hand-edit `packages/*/CHANGELOG.md`.** git-cliff owns those files.
- **Don't add a `.eslintrc.*` file.** Flat config only.
- **Don't run `npm publish` manually.** Tag → push → workflow handles it.
- **Don't add a runtime dependency on `react` to `@codeam/ide-core`.** That package must stay UI-framework-agnostic.
- **Don't import from another sibling package directly via relative path** (e.g. `import { x } from '../../web/src/...'`). Go through `@codeam/ide-core` so the dependency direction is enforced.
- **Don't bundle Monaco into the package dist.** It loads at runtime (web: `@monaco-editor/react`, native: jsDelivr CDN inside WebView).

## Roadmap shortcuts

- Phase 2 — VS Code-like features (file explorer, source control, search, terminal, settings, tabs): [`docs/roadmap/phase-2-features.md`](./docs/roadmap/phase-2-features.md)
- Phase 3 — Extension runtime: [`docs/roadmap/phase-3-extensions.md`](./docs/roadmap/phase-3-extensions.md)
- Phase 4 — Monetisation + GTM: [`docs/roadmap/phase-4-gtm.md`](./docs/roadmap/phase-4-gtm.md)

Architecture overview: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).
