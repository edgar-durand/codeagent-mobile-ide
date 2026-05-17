# @codeam/ide-core

Headless types, adapter interfaces, and pure helpers shared by
[`@codeam/ide-web`](https://www.npmjs.com/package/@codeam/ide-web) and
[`@codeam/ide-native`](https://www.npmjs.com/package/@codeam/ide-native).

Zero runtime dependencies on any UI framework. If you only need to wire a
backend up to the IDE's adapter contract, depend on this package and nothing
else — your bundle will pick up just the types + the `detectLanguage` helper.

## Install

```bash
npm install @codeam/ide-core
```

## What's in here

- **Adapter contracts** — `FileFetcher`, `GitProvider`, `FileTreeProvider`,
  `SearchProvider`, `TerminalProvider`. Implementations on the consumer side
  decide whether they talk to the CodeAgent CLI, a Codespaces workspace, a
  local filesystem bridge, or anything else.
- **`detectLanguage(path)`** — maps a file path to the Monaco language id
  the editor needs to enable syntax highlighting. Same table the web /
  native packages use internally, exposed here so tabs and breadcrumbs in
  consumer code can avoid duplicating it.
- **Shared payload types** — `FileReadResult`, `GitStatusEntry`, `SearchHit`,
  `TerminalEvent`. The wire shapes the UI surfaces consume from any adapter.

See the top-level [`README.md`](../../README.md) for the full architectural
overview and roadmap.

## License

MIT
