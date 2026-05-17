# Changelog

Per-package changelogs are the source of truth:

- [`@codeam/ide-core`](./packages/core/CHANGELOG.md)
- [`@codeam/ide-web`](./packages/web/CHANGELOG.md)
- [`@codeam/ide-native`](./packages/native/CHANGELOG.md)

All three packages share a fixed version line — a single `git tag vX.Y.Z` push triggers a parallel publish of all three. Each package's CHANGELOG is updated automatically by the [Release](./.github/workflows/release.yml) workflow using [`git-cliff`](https://git-cliff.org/) over the Conventional Commits since the previous tag (see [`cliff.toml`](./cliff.toml)). Do not edit them by hand — make better commit messages instead.
