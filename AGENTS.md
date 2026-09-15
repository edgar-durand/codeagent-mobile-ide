# AGENTS.md

Repository-wide guidance for coding agents. Read this file before changing code. More
detailed design context lives in `docs/ARCHITECTURE.md`; package-specific API notes live in
each package's `README.md`.

## Project overview

This is an npm-workspaces monorepo for `@codeam/ide`, an embeddable VS Code-style IDE component
library; the root package is marked private to prevent accidental publication. Node 20 or newer
is required (`.nvmrc` pins Node 20). The three publishable packages share one version:

- `packages/core` (`@codeam/ide-core`): framework-agnostic adapter contracts, public types,
  themes, and pure utilities. It must have no React or platform runtime dependency.
- `packages/web` (`@codeam/ide-web`): React DOM components; Monaco is loaded on demand through
  `@monaco-editor/react`.
- `packages/native` (`@codeam/ide-native`): React Native components; Monaco runs inside
  `react-native-webview` and is loaded at runtime.
- `docs/`: architecture and future roadmap. A roadmap describes intent, not necessarily the
  current implementation; verify claims against `packages/*/src` and package exports.
- `.github/workflows/`: CI and tag-driven npm release automation.

## Before making changes

1. Run `bd prime` to load the Beads workflow and repository context.
2. Use `bd ready`/`bd show <id>` to inspect existing work. Create and claim a Beads issue before
   implementation if the requested work does not already have one.
3. Read the affected package's `package.json`, `src/index.ts`, nearby implementation, and tests.
4. Check `git status --short`. Preserve unrelated user changes; never discard or overwrite them.
5. For a public API or architecture change, also read `docs/ARCHITECTURE.md` and the affected
   package README.

Use Beads for durable tasks, dependencies, blockers, follow-ups, and project memory. Do not
create markdown TODO or memory files. Use `bd remember` for durable discoveries. Do not run
`bd dolt push`, commit, or push Git changes unless the user or active repository profile gives
explicit authority.

## Architecture invariants

- Dependency direction is strict: consumer -> `web`/`native` -> `core`. `core` cannot import
  React or platform code; `web` and `native` cannot import each other.
- UI code must depend on backend-agnostic contracts from `core`, never a concrete backend.
  Adapter contracts are public API and require compatibility care.
- Keep adapters stable across React renders. Effects key off adapter identity; recreating an
  adapter each render causes repeated reads and visible flicker. Consumers should memoize or
  cache adapters by identity.
- Keep matching web/native components aligned in props and behavior. A change to a shared IDE
  surface normally requires inspecting both implementations, even when only one needs editing.
- Do not bundle Monaco into a consumer's main bundle. Preserve lazy/runtime loading and the
  external dependency configuration in each `tsup.config.ts`.
- Every intended public symbol must be exported from the package's `src/index.ts`. New core
  adapter contracts belong in `packages/core/src/types/` and, when applicable, in
  `types/adapters.ts`.
- Keep package boundaries intact: import core through `@codeam/ide-core`; never reach into a
  sibling package with relative source imports.
- All packages ship on the same fixed version line. Do not independently bump package versions.

## Implementation conventions

- TypeScript is strict and targets ES2022. Account for `noUncheckedIndexedAccess`; do not add
  `any` (ESLint treats explicit `any` as an error).
- Use type-only imports where appropriate and follow the existing component/hook patterns.
- Prettier is authoritative: 100 columns, two spaces, semicolons, single quotes, trailing commas.
- Only `console.warn` and `console.error` are allowed. Prefix intentionally unused values with
  `_`.
- Keep components backend-agnostic and handle adapter latency/failure as normal runtime states.
- Add focused Vitest coverage for behavior changes. Core tests are colocated as `*.test.ts`;
  native component tests use jsdom plus `packages/native/src/test/setup.tsx` stubs.
- Update the relevant package README and root README when a public API or documented default
  changes. Do not hand-edit package changelogs; release automation owns them.
- Keep edits scoped. Do not implement roadmap items merely because they are documented.

## Commands

Run commands from the repository root after `npm ci` (preferred for a clean, locked install) or
`npm install` when intentionally updating dependencies/lockfiles.

```bash
npm run build          # tsup: ESM, CJS, declarations, and source maps for all workspaces
npm run typecheck      # builds core first, then checks all workspaces
npm run lint           # shared ESLint v9 flat config
npm test               # Vitest in every workspace; packages without tests pass
npm run format:check   # verify Prettier without modifying files
npm run format         # format supported source/config/docs files
```

Target one package during iteration:

```bash
npm run build --workspace @codeam/ide-core
npm run dev --workspace @codeam/ide-web
npm run test --workspace @codeam/ide-native
```

Build `@codeam/ide-core` before diagnosing downstream declaration-resolution failures. Before
handoff, run the narrowest relevant tests while iterating, then run `npm run lint`,
`npm run typecheck`, `npm run build`, `npm test`, and `npm run format:check` for changes that can
affect the published packages. Documentation-only changes require at least `npm run format:check`.

## Commits and releases

Use Conventional Commits. Allowed scopes are `core`, `web`, `native`, `examples`, `workflow`,
`meta`, `deps`, `release`, `changelog`, and `docs`; subjects are limited to 100 characters.
Examples: `feat(web): add file tree filtering` and `fix(native): preserve editor state`.

Husky runs lint-staged plus the workspace typecheck before commits and commitlint on commit
messages. Do not add legacy `.eslintrc` files; this repository uses `eslint.config.mjs`.

Releases are triggered only by pushing a `vMAJOR.MINOR.PATCH[-prerelease]` tag. Never run
`npm publish` manually, hand-edit generated changelogs, or create/push release tags unless the
user explicitly requests a release. The workflow publishes core first, then web and native.

## Completion checklist

1. Run the appropriate quality gates and inspect their actual output.
2. Recheck `git diff` and `git status --short`; distinguish your changes from pre-existing ones.
3. Create Beads follow-up issues for real remaining work rather than leaving TODO files.
4. Close the claimed Beads issue only when its acceptance criteria are satisfied.
5. Report changed files, validation results, and anything not verified. Do not commit, push, or
   sync unless explicitly authorized.
