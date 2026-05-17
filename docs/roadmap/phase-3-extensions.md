# Phase 3 — Extensions runtime

**Goal:** load and run VS Code-format extensions inside `@codeam/ide-web` and `@codeam/ide-native`. This is the product moat — once a few popular extensions (Prettier, ESLint, GitLens, Copilot-style assistants) work, the library stops being "another IDE component" and starts being "VS Code on your phone."

**Estimated effort:** **2–3 months minimum**, multi-engineer if possible. The hardest engineering work in the whole project — security sandboxing on mobile, API surface compatibility, marketplace integration. This document captures the design we'll build against; **execution is iterative** and will need its own series of detailed design docs as we hit specific surfaces.

**Versioning:** ships under `0.x.y` until the extension API is stable enough to commit to. Promoted to `1.0.0` when we accept the API as public commitment.

---

## Design constraints

1. **Apple App Store compliance.** Apps that download + execute arbitrary code are subject to extra scrutiny (4.7.x review). Mitigation: extensions run in a **constrained Web Worker sandbox** with a curated `vscode.*` API surface — no `eval` of arbitrary strings, no dynamic `require`. We submit a description of the runtime to Apple as part of every release.
2. **Bundle size.** Extension code is not bundled with the host. It's fetched from Open VSX (or a private registry) on user installation and cached in the consumer-provided `SettingsStore`.
3. **Surface compatibility.** The `vscode.*` shim implements the **most used 20–30 APIs**, not all 200+. Extensions that use beyond-shim APIs fail gracefully (`activate` throws) with a clear "unsupported API: vscode.foo.bar" surface in the UI.
4. **Marketplace.** Use **Open VSX** (Eclipse Foundation), not Microsoft's VS Code Marketplace — Microsoft restricts the latter to VS Code itself. Open VSX is the de facto standard for non-Microsoft VS Code distributions (Gitpod, Theia, Cursor, code-server).
5. **No native code from extensions.** Browser/RN sandbox only. Extensions that ship a `.node` native binary (very rare in the JS ecosystem these days) are unsupported.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Host (@codeam/ide-web | -native)      │
│                                                              │
│  ┌──────────────────┐    postMessage    ┌─────────────────┐ │
│  │ Extension Manager│ ◀────────────────▶│ Extension Worker│ │
│  │ - Install / load │                   │ (one per ext)   │ │
│  │ - Lifecycle hooks│                   │ vscode shim     │ │
│  │ - Permissions    │                   │ activate(ctx)   │ │
│  └──────────────────┘                   │ deactivate()    │ │
│           │                              └─────────────────┘ │
│           ▼                                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Adapter API (existing @codeam/ide-core contracts)     │   │
│  │ FileFetcher | GitProvider | SearchProvider | ...      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

- **Extension Manager** lives in the main thread. Owns the list of installed extensions, their activation events, and the permission grants.
- **Extension Worker** is a Web Worker (web) or a `WebView`-hosted iframe-style sandbox (native, since RN doesn't ship Web Workers). One worker per active extension — isolated heap, isolated globals.
- **Bridge** is a typed `postMessage` channel implemented in `@codeam/ide-extensions-host` (new package). The shim inside the worker translates `vscode.window.showMessage(msg)` into `port.postMessage({ kind: 'window.showMessage', args: [msg] })` and back.

---

## The vscode shim — minimum viable subset

Target the APIs used by the **most-installed extensions on Open VSX**. Rough priority list (compiled from a sample of the top 50 extensions):

| API namespace                                                            | Methods covered (v1)                                                                                                                           | Priority                             |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `vscode.window`                                                          | `showInformationMessage`, `showWarningMessage`, `showErrorMessage`, `showInputBox`, `showQuickPick`, `createOutputChannel`, `activeTextEditor` | 🔴 must                              |
| `vscode.workspace`                                                       | `getConfiguration`, `onDidChangeConfiguration`, `workspaceFolders`, `openTextDocument`, `applyEdit`                                            | 🔴 must                              |
| `vscode.commands`                                                        | `registerCommand`, `executeCommand`                                                                                                            | 🔴 must                              |
| `vscode.languages`                                                       | `registerCodeActionsProvider`, `registerCompletionItemProvider`, `registerHoverProvider`, `registerDocumentFormattingEditProvider`             | 🔴 must                              |
| `vscode.Uri`                                                             | `file`, `parse`, `toString`                                                                                                                    | 🔴 must                              |
| `vscode.Position`, `vscode.Range`, `vscode.Selection`, `vscode.TextEdit` | full classes                                                                                                                                   | 🔴 must                              |
| `vscode.EventEmitter`                                                    | full class                                                                                                                                     | 🔴 must                              |
| `vscode.Diagnostic`, `vscode.DiagnosticCollection`                       | full                                                                                                                                           | 🟡 should                            |
| `vscode.tasks`                                                           | `executeTask`, `registerTaskProvider`                                                                                                          | 🟡 should                            |
| `vscode.debug`                                                           | —                                                                                                                                              | ⚪ defer                             |
| `vscode.terminal`                                                        | `createTerminal`, `sendText`                                                                                                                   | 🟡 should (depends on Phase 2 M4)    |
| `vscode.notebooks`                                                       | —                                                                                                                                              | ⚪ defer                             |
| `vscode.scm`                                                             | —                                                                                                                                              | 🟡 should (overlaps with Phase 2 M2) |

The shim is implemented in `@codeam/ide-extensions-shim` (new package, ships into the worker bundle). Each API is a thin wrapper that posts a message to the manager and (for return-value APIs) awaits the response Promise.

---

## Extension manifest

VS Code's `package.json` manifest format is the standard. We support the subset needed for the v1 shim:

```json
{
  "name": "my-extension",
  "version": "1.0.0",
  "engines": { "vscode": "^1.80.0" },
  "activationEvents": [
    "onLanguage:typescript",
    "onCommand:myext.format",
    "onStartupFinished"
  ],
  "contributes": {
    "commands": [{ "command": "myext.format", "title": "Format with MyExt" }],
    "configuration": { ... },
    "keybindings": [{ "command": "myext.format", "key": "ctrl+shift+m" }],
    "menus": { ... },
    "languages": [...]
  },
  "main": "./dist/extension.js"
}
```

Unsupported manifest fields fall back to no-op at load time — they don't break the install, they just don't do anything.

---

## Installation flow

1. User taps "Install" on an extension listing in the in-app marketplace UI.
2. Manager downloads the `.vsix` from Open VSX (a `.vsix` is just a zip with the extension + manifest).
3. Manager validates the manifest (engine compat, declared permissions).
4. Manager prompts the user with a permission summary:
   - "MyExtension wants to read your files"
   - "MyExtension wants to register the command 'format'"
   - "MyExtension wants to run on TypeScript files"
5. On consent, the extension is stored in `SettingsStore` keyed by `<author>.<name>@<version>`.
6. On the next workspace open, the manager evaluates activation events and spawns workers for matching extensions.

---

## Open questions / decisions to make

These are the design decisions we need to lock in before the implementation stage:

1. **Native sandbox technology.** Web Worker doesn't exist in RN. Options:
   - `react-native-webview` with an isolated HTML hosting the extension code — proven (we already use it for Monaco). Risk: each extension is a new WebView, expensive RAM-wise.
   - `react-native-jsi-quickjs` — embed QuickJS as a JSI module, run extensions in a separate JS context. Cleaner, but immature ecosystem.
   - `Hermes` workers — Hermes (RN's default JS engine since 0.70) does NOT support workers natively. Workaround: spin up a second RN bridge — invasive.
   - **Decision:** start with `react-native-webview` (Approach A) for v1 to get something shipping, plan to migrate to QuickJS in v2 once we know the API surface.

2. **Permission model granularity.** VS Code itself doesn't have per-extension permissions (all extensions get all APIs). We need at least filesystem / network granularity since mobile users are more privacy-conscious. Reference model: browser extension permissions (manifest-declared, surfaced at install).

3. **Storage layer for extensions.** Extensions need persistent state (`Memento` API in `vscode`). We pass through to consumer's `SettingsStore` namespaced per extension.

4. **Networking from extensions.** `fetch()` inside an extension worker — allow? Restrict to declared hosts in manifest (Chrome extension model)? **Recommendation:** restrict to declared `permissions.host` glob list, surface in install prompt.

5. **Extension activation perf.** Spinning up 10 WebViews on workspace open is too slow. Lazy-activate on first matching event; serialise activation worker pool to 2 concurrent.

---

## Compatibility tier

We document each extension's "compat tier" in the in-app marketplace UI based on what fraction of its declared API surface our shim implements:

- **Tier 1 ("Green")** — uses only v1 shim APIs. Works as expected.
- **Tier 2 ("Yellow")** — uses some APIs we haven't implemented, but has fallback paths. Degraded but functional.
- **Tier 3 ("Red")** — uses APIs we explicitly reject (e.g. `child_process`, `fs` outside the workspace). Cannot install.

The tier is computed at install time from a static analysis of the extension bundle (search for `vscode.foo.bar` API calls). Same model the Cursor team uses for their compat layer.

---

## Acceptance for "Phase 3 v1 complete"

- 10 extensions from the top-50 Open VSX list install + activate + run their main user-facing flow without errors:
  - Prettier · ESLint · GitLens · Tailwind CSS IntelliSense · Live Server · Auto Rename Tag · Path Intellisense · Code Spell Checker · Material Icon Theme · Error Lens
- Permission prompt UI surfaces at install
- Marketplace UI in the IDE lets users browse Open VSX, search, install, manage installed
- Extension API surface (the v1 shim) is documented at `docs/extensions-api.md`
- Apple TestFlight build accepted for review (key compliance milestone)

Reach Tier-2+ compatibility on 80%+ of the top 100 Open VSX extensions before we call Phase 3 "complete" and ship `1.0.0`.

---

## Resources for the implementer

- [VS Code Extension API docs](https://code.visualstudio.com/api/references/vscode-api) — the contract we're emulating
- [Open VSX REST API](https://github.com/eclipse/openvsx/wiki/Server-API) — for the marketplace integration
- [`vscode-codicons`](https://github.com/microsoft/vscode-codicons) — icon set extensions expect to be available
- [Theia's extension host](https://github.com/eclipse-theia/theia/tree/master/packages/plugin-ext) — reference impl of a vscode shim, although desktop-flavoured
- [vscode-test](https://github.com/microsoft/vscode-test) — the official VS Code extension test harness; we'd need a compatible runner

This phase is a research + execution project. Plan to spike each milestone before committing to a quarter.
