# @codeam/ide-core

All notable changes to this package are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and entries
are generated automatically from the [Conventional Commits](https://www.conventionalcommits.org/)
between release tags via the [Release](../../.github/workflows/release.yml)
workflow.

## [0.11.3] — 2026-06-06

### Fixed

- **native:** Static SvgUri import + visible folder + log resolver failures

## [0.11.2] — 2026-05-31

### CI

- **workflow:** Make publish steps idempotent on tag retries

### Fixed

- **native:** Render SVG file icons + lift ActivityBar above WebView

## [0.11.1] — 2026-05-18

### Fixed

- **web,native:** Icon theme persisted state survives reload

## [0.11.0] — 2026-05-18

### Added

- **core,web,native:** File icon themes marketplace

## [0.10.1] — 2026-05-18

### Fixed

- **core,web,native:** Jsonc parsing for vs code marketplace themes

## [0.10.0] — 2026-05-18

### Added

- **core,web,native:** Vs code-style themes marketplace browser

## [0.9.2] — 2026-05-18

### Added

- **core,web,native:** Curated marketplace themes list + monacolike type fix

## [0.9.1] — 2026-05-18

### Added

- **web,native:** Inlineeditor renders conflictbanner automatically
- **core,web,native:** Push and pull buttons in source control panel

## [0.9.0] — 2026-05-18

### Added

- **core,web,native:** M1/m2/m3/m5/m6 polish

## [0.8.0] — 2026-05-18

### Added

- **core,web,native:** M2 conflict-resolution toolbar + m5 marketplace themes

## [0.7.1] — 2026-05-18

### Added

- **web,native:** Split pane + onaftersave + toggle inline-styled

### Fixed

- **native:** Activity bar invisible on android

## [0.7.0] — 2026-05-17

### Added

- **web,native:** Xterm.js terminal panel + recent commands chip + comprehensive docs
- **web,native:** Split pane + onaftersave + toggle inline-styled

## [0.6.0] — 2026-05-17

### Added

- **web,native:** Xterm.js terminal panel + recent commands chip + comprehensive docs

### Fixed

- **native:** Activity bar icons hidden by parent opacity on some expo-vector-icons builds

## [0.4.2] — 2026-05-17

### Added

- **web,native:** Breadcrumbs + side-by-side diff viewer (monaco)

### Fixed

- **native:** Activity bar icons hidden by parent opacity on some expo-vector-icons builds

## [0.5.0] — 2026-05-17

### Added

- **web,native:** Breadcrumbs + side-by-side diff viewer (monaco)

## [0.4.1] — 2026-05-17

### Added

- **native:** Phase 2 parity for activity bar, file tree, scm, search, settings, shell, tabs, editor

## [0.4.0] — 2026-05-17

### Added

- **web:** Ide shell keeps inactive panels mounted (vs code parity)

## [0.3.3] — 2026-05-17

### Added

- **web:** Ide shell keeps inactive panels mounted (vs code parity)

### Fixed

- **web:** Ide shell uses h-screen so consumers don't need a height wrapper

## [0.3.2] — 2026-05-17

### Fixed

- **web:** Ide shell uses h-screen so consumers don't need a height wrapper

## [0.3.1] — 2026-05-17

### Added

- **web:** Vs code parity for source control + ideshell + graph

### Fixed

- **web:** Search input — switch to flex layout so the lupa always renders

## [0.3.0] — 2026-05-17

### Fixed

- **web:** Search input — switch to flex layout so the lupa always renders

## [0.2.6] — 2026-05-17

### Fixed

- **workflow:** Purge nested @codeam copies so tsc resolves the workspace symlink

## [0.1.0] — 2026-05-17

### Added

- Initial release of @codeam/ide v0.1.0

### CI

- **workflow:** Force trigger run after migration

### Changed

- **workflow:** Migrate release pipeline from Changesets to tag-triggered git-cliff

### Fixed

- **workflow:** Build core before typecheck + drop stale changeset ignore

## [Unreleased]
