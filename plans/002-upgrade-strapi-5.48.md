# Plan 002: Upgrade Strapi 5.33.3 → 5.48.0 to clear the critical CVEs in the dependency tree

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 262c1cc..HEAD -- package.json package-lock.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (but land plan 001 first so a future release isn't cut from a broken pipeline)
- **Category**: security
- **Planned at**: commit `262c1cc`, 2026-06-12

## Why this matters

`npm audit` at commit `262c1cc` reports **77 vulnerabilities (11 critical, 21 high)**, all transitive through the Strapi 5.33.3 dependency tree (`@casl/ability` CVSS 9.8, `handlebars`, `shell-quote`, `jws`, `lodash`, `webpack` SSRF advisories, `ws`, `yaml`, among others). npm's own resolution states the fix: `npm audit fix --force` "will install @strapi/strapi@5.48.0". There is no narrower fix — pinning individual transitive packages against Strapi's lockstep versioning is unmaintainable. Upgrading the four Strapi packages from 5.33.3 to 5.48.0 (same major, minor-only) clears the tree and also resolves the `react-router-dom` v6 XSS advisory gated on this upgrade.

## Current state

- `package.json:16-27` — the four Strapi packages are pinned exactly:

```json
"@strapi/plugin-sentry": "5.33.3",
"@strapi/plugin-users-permissions": "5.33.3",
"@strapi/provider-email-nodemailer": "5.33.3",
"@strapi/strapi": "5.33.3",
```

- `package.json:13` — the repo ships an upgrade helper script: `"upgrade": "npx @strapi/upgrade latest"`. Prefer it: it bumps all Strapi packages in lockstep and runs any codemods shipped for the range.
- The project customizes Strapi in three places the upgrade could interact with:
  - `src/extensions/users-permissions/strapi-server.ts` — overrides `auth.register`, `user.create/update`, `contentmanageruser.create/update`, adds an `updateAvatar` controller, an `isOwnerOrAdmin` policy, and mutates `plugin.routes['content-api'].routes`. This relies on internal users-permissions controller shapes — the #1 breakage candidate.
  - `config/plugins.ts` — `users-permissions` (jwt + `register.allowedFields`), nodemailer email provider, `upload.config.security.allowedTypes`.
  - `config/admin.ts` — `auth.sessions` lifespans, `preview` flag.
- Baseline at `262c1cc`: `npm run build` exits 0; `vp check` exits 0; `npm audit --omit=dev` ends with `77 vulnerabilities (9 low, 36 moderate, 21 high, 11 critical)`.

## Commands you will need

| Purpose   | Command                                              | Expected on success              |
|-----------|------------------------------------------------------|----------------------------------|
| Upgrade   | `npm run upgrade` (runs `npx @strapi/upgrade latest`) | Strapi deps bumped, exit 0       |
| Install   | `npm install`                                        | exit 0                           |
| Build     | `npm run build`                                      | exit 0 (TS compile + admin build)|
| Typecheck | `./node_modules/.bin/tsc -p tsconfig.json --noEmit`  | exit 0                           |
| Lint/fmt  | `vp check`                                           | exit 0                           |
| Audit     | `npm audit --omit=dev`                               | 0 critical, 0 high               |
| Smoke run | `npm run dev` (needs a reachable PostgreSQL; stop with Ctrl-C) | admin builds, server logs `http://localhost:1337` |

## Scope

**In scope** (the only files you should modify):
- `package.json` (the four `@strapi/*` versions; the upgrade tool may also adjust `react`/`react-dom`/`react-router-dom`/`styled-components` ranges if Strapi's peer deps moved — accept those)
- `package-lock.json`
- `.strapi-updater.json` (touched automatically by Strapi tooling — fine)
- Source files ONLY if a Strapi codemod run by `@strapi/upgrade` edits them — review and keep codemod output, but make no manual source edits.

**Out of scope** (do NOT touch, even though they look related):
- Manual edits to `src/extensions/users-permissions/strapi-server.ts` — if the upgrade breaks it, that's a STOP condition, not a thing to patch ad hoc.
- `config/*.ts` manual changes.
- Major-version bumps of react (stay on 18.x unless the codemod forces otherwise — Strapi 5.48 still supports React 18).

## Git workflow

- Branch: `chore/upgrade-strapi-5.48`
- One commit: `chore(dependencies): upgrade strapi to 5.48.0` (matches existing history, e.g. `44b1910 chore(dependencies): update to strapi V5.11`)
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Record the baseline

Run `npm audit --omit=dev | tail -3` and save the count line in your report. Run `npm run build` to confirm the baseline is green before changing anything.

**Verify**: `npm run build` → exit 0.

### Step 2: Run the Strapi upgrade tool

`npm run upgrade` — answer yes to bumping to the latest 5.x. If the tool is interactive in a way you cannot drive, fall back to editing `package.json` manually: set all four `@strapi/*` packages to `5.48.0`, then `npm install`.

**Verify**: `grep '"@strapi/strapi"' package.json` → shows `5.48.0`; `npm install` → exit 0.

### Step 3: Rebuild and typecheck

**Verify**:
- `./node_modules/.bin/tsc -p tsconfig.json --noEmit` → exit 0
- `npm run build` → exit 0
- `vp check` → exit 0

### Step 4: Confirm the audit is clean

**Verify**: `npm audit --omit=dev` → `0 critical` and `0 high` (moderate/low remainders are acceptable — record them in your report).

### Step 5: Smoke-test the users-permissions extension

If a PostgreSQL instance is reachable with the `.env` config (e.g. `docker compose up -d strapi-cms-db`), run `npm run dev` and confirm the server boots without errors mentioning `users-permissions`, `contentmanageruser`, or `routes`. The extension crashes at startup (not at request time) if controller shapes changed — `plugin.routes['content-api'].routes.find(...)` at `strapi-server.ts:219-221` throws if the `PUT /users/:id` route was renamed. If no database is available, state that explicitly in your report instead of claiming the smoke test passed.

**Verify**: server log shows the startup banner with `http://localhost:1337` and no stack trace.

## Test plan

No new unit tests in this plan (the repo has none yet — plan 005 establishes the baseline). The verification gates above (typecheck, build, audit, boot smoke test) are the test plan.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -c '5.48.0' package.json` ≥ 4 (the four @strapi packages)
- [ ] `npm run build` exits 0
- [ ] `./node_modules/.bin/tsc -p tsconfig.json --noEmit` exits 0
- [ ] `vp check` exits 0
- [ ] `npm audit --omit=dev` reports 0 critical and 0 high
- [ ] `git status` shows only package.json, package-lock.json, optionally `.strapi-updater.json` and codemod-touched files
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `npm run build` or `tsc --noEmit` fails after the bump and the error points into `src/extensions/users-permissions/strapi-server.ts` — the override contract changed; this needs a human/advisor decision, not a guess.
- `@strapi/upgrade` wants to cross a major version (6.x).
- `npm audit` still reports critical vulnerabilities after the upgrade — the fix claim no longer holds; report the remaining advisories.
- The dev-server smoke test crashes at bootstrap with anything referencing the cron job in `src/index.ts`.

## Maintenance notes

- Strapi pins exact versions across its packages; future bumps must move all four `@strapi/*` packages together (use `npm run upgrade`).
- Reviewer should scrutinize the `package-lock.json` diff for unexpected major bumps of `react`/`react-router-dom`.
- `5.48.0` was "latest" when this plan was written; if `npx @strapi/upgrade latest` lands on a newer 5.x, that is fine — the done criterion becomes that version, note it in the index.
- Deferred: react-router-dom v7 / React 19 alignment — only when Strapi's peer deps require it.
