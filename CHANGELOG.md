# Changelog

This file is maintained by [Changesets](https://github.com/changesets/changesets). Do not edit by hand — add a `.md` file in `.changeset/` instead.

Per-package changelogs live in `packages/*/CHANGELOG.md`.

## 0.1.0 — initial release

- **`@codeam/ide-core`** — adapter contracts (`FileFetcher`, `GitProvider`, `FileTreeProvider`, `SearchProvider`, `TerminalProvider`, `SettingsStore`), payload types, `detectLanguage` helper
- **`@codeam/ide-web`** — `FileViewerProvider` + `FileViewerHost` React components, Monaco editor via `@monaco-editor/react`
- **`@codeam/ide-native`** — `FileViewerProvider` + `FileViewerHost` React Native components, Monaco inside a WebView, safe-area-aware fullscreen modal
- Monorepo tooling: npm workspaces, tsup, vitest, ESLint v9, Prettier, husky, lint-staged, commitlint, Changesets
- CI + Release workflows
- Phase 2/3/4 roadmap published in `docs/roadmap/`
