# Contributing

Thanks for considering a contribution. This is an MIT-licensed library — code, docs, and bug reports are all welcome.

## Local setup

```bash
git clone https://github.com/edgar-durand/codeagent-mobile-ide.git
cd codeagent-mobile-ide
npm install        # installs all workspaces
```

Node ≥ 20 is required (see `.nvmrc`).

## Workflow

1. **Branch** off `main`: `git checkout -b feat/your-thing`.
2. **Make your changes.** Keep each PR focused on one concern.
3. **Add a changeset** before committing:
   ```bash
   npm run changeset
   ```
   Pick the bump level (patch / minor / major) and write a one-line summary. Changesets are how the release pipeline knows what to publish.
4. **Run the checks locally:**
   ```bash
   npm run lint
   npm run typecheck
   npm test
   ```
5. **Commit** with a Conventional Commits message — `commitlint` enforces this in CI and via the `commit-msg` hook locally.
6. **Push + open a PR** to `main`. CI runs lint + typecheck + tests on every PR.

## Commit message format

Conventional Commits, with the scopes from `commitlint.config.mjs`:

```
<type>(<scope>): <subject>

<body>
```

Allowed scopes: `core`, `web`, `native`, `examples`, `workflow`, `meta`, `deps`, `release`, `changelog`, `docs`.

Examples:

```
feat(web): add file-tree sidebar
fix(native): safe-area insets for Android fullscreen modal
docs(meta): clarify adapter stability invariant in README
chore(deps): bump tsup to 8.4
```

Breaking changes: append `!` after type/scope, or add a `BREAKING CHANGE:` footer.

## Release flow

Releases are automated via [Changesets](https://github.com/changesets/changesets). You don't need to run `npm publish` yourself.

- Each PR with user-facing changes includes a changeset (one or more `.md` files in `.changeset/`).
- On merge to `main`, the Release workflow opens a "Version packages" PR that bumps versions + updates `CHANGELOG.md`.
- When that PR merges, the Release workflow publishes the bumped packages to npm.

## What goes in a PR

- **One concern per PR.** A feature, a bugfix, or a refactor — not all three.
- **Tests for new behaviour.** If you change adapter logic in `@codeam/ide-core`, add a vitest case. UI components are tested via `vitest` + `@testing-library/react` (or `@testing-library/react-native`).
- **README updates** if you change a public API or default behaviour.
- **Changeset** describing the user-visible impact.

## Code style

- Prettier handles formatting. Run `npm run format` to fix.
- ESLint catches the rest. Run `npm run lint` to check.
- Both run in `lint-staged` at commit time — you generally don't need to think about formatting.

## Architecture decisions

For non-trivial design changes (new adapter contract, new UI surface), open an issue first or write a short proposal in `docs/`. The principles in `docs/ARCHITECTURE.md` are load-bearing — please don't violate the dependency direction (`core` knows nothing about UI, etc.) without discussion.

## Questions

Open a discussion or issue on GitHub. We aim to respond within a week.
