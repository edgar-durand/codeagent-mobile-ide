# Security policy

## Reporting a vulnerability

Email **edgar@privacyhawk.com** with the details. **Do not open a public GitHub issue** for security reports — give us time to fix the issue before disclosure.

Include:

- A description of the vulnerability
- Steps to reproduce
- Impact assessment (who's affected, what an attacker can do)
- Suggested fix if you have one

We'll acknowledge within 72 hours and target a fix within 14 days for high-severity issues. After the fix ships we'll credit you in the release notes unless you ask us not to.

## Scope

In-scope:

- `@codeam/ide-core`, `@codeam/ide-web`, `@codeam/ide-native` packages
- The example apps in `examples/`
- The build / release pipeline (`.github/workflows/`)

Out of scope:

- Vulnerabilities in `monaco-editor` or `@monaco-editor/react` — report those upstream
- Bugs in extensions installed via the (future) marketplace — that's an extension author concern
- The CodeAgent Mobile backend at `codeagent-mobile-api.vercel.app` — that's a separate project with its own security contact

## Supported versions

Only the latest minor release line receives security patches. Older minors should upgrade.

| Version          | Supported        |
| ---------------- | ---------------- |
| 0.x latest       | ✅               |
| 0.x older minors | ❌               |
| 1.x (future)     | ✅ when released |

## Hardening notes

When designing extensions in Phase 3, we'll publish a separate `EXTENSIONS_SECURITY.md` covering the sandbox model and the permission boundaries.
