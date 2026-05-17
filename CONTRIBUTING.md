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
3. **Run the checks locally:**
   ```bash
   npm run lint
   npm run typecheck
   npm test
   ```
4. **Commit** with a Conventional Commits message — `commitlint` enforces this in CI and via the `commit-msg` hook locally.
5. **Push + open a PR** to `main`. CI runs lint + typecheck + tests on every PR.

The commit messages themselves drive the changelog at release time (via `git-cliff`), so a good `feat(web): add file tree sidebar` is worth more than any separate changelog edit.

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

Tag-triggered, identical pattern to [codeagent-mobile-clients](https://github.com/edgar-durand/codeagent-mobile-clients):

```bash
git tag v0.2.0
git push origin v0.2.0
```

The Release workflow (`.github/workflows/release.yml`) takes over:

1. **Validates** the tag matches `vMAJOR.MINOR.PATCH[-prerelease]`.
2. **Patches** the version in `packages/{core,web,native}/package.json` (no commit, just for the publish step).
3. **Publishes** all three packages to npm in parallel. `@codeam/ide-core` goes first, then `@codeam/ide-web` and `@codeam/ide-native` (which both depend on core at the same version).
4. **Generates** release notes via [`git-cliff`](https://git-cliff.org/) over the conventional commits between the previous and current tag — see [`cliff.toml`](./cliff.toml).
5. **Prepends** the notes to each package's `CHANGELOG.md` and commits back to `main` with `chore(changelog): notes for vX.Y.Z [skip ci]`.
6. **Creates** a GitHub Release with the same notes, marked `prerelease: true` when the tag has a `-rc.N` suffix.

You never run `npm publish` manually. Tag → push → done.

## What goes in a PR

- **One concern per PR.** A feature, a bugfix, or a refactor — not all three.
- **Tests for new behaviour.** If you change adapter logic in `@codeam/ide-core`, add a vitest case. UI components are tested via `vitest` + `@testing-library/react` (or `@testing-library/react-native`).
- **README updates** if you change a public API or default behaviour.
- A clear Conventional Commit message — that's what becomes the changelog entry at release time. No separate changelog edit needed.

## Code style

- Prettier handles formatting. Run `npm run format` to fix.
- ESLint catches the rest. Run `npm run lint` to check.
- Both run in `lint-staged` at commit time — you generally don't need to think about formatting.

## Architecture decisions

For non-trivial design changes (new adapter contract, new UI surface), open an issue first or write a short proposal in `docs/`. The principles in `docs/ARCHITECTURE.md` are load-bearing — please don't violate the dependency direction (`core` knows nothing about UI, etc.) without discussion.

## Questions

Open a discussion or issue on GitHub. We aim to respond within a week.
