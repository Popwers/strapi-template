# Plan 006: Template polish — safe key generation, valid YAML editorconfig, and a "new project" checklist in the README

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 262c1cc..HEAD -- generate-keys.sh .editorconfig README.md .gitignore`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (if plan 003 is DONE, the checklist references `BACKUP_FILE_PREFIX` instead of the hardcoded prefix — see Step 3)
- **Category**: dx / docs / security
- **Planned at**: commit `262c1cc`, 2026-06-12

## Why this matters

This repo is a **template**: every flaw it ships is copied into every project cloned from it. Three concrete issues: (1) `generate-keys.sh` echoes the generated secrets to the terminal (line 35) — they end up in shell history and CI logs — and mixes bashisms (`[[`, `local`) under a `#!/bin/sh` shebang, so it breaks on Linux systems where `sh` is dash; it also generates a single value for `APP_KEYS`, where Strapi expects a comma-separated list (conventionally 4 keys). (2) `.editorconfig` forces tabs for `*.yml`, but YAML forbids tabs for indentation — an editor honoring it produces invalid YAML. (3) The template is full of placeholders (`name-of-your-company` in `src/index.ts`, `not-reply@your-project.fr` in `config/plugins.ts`, `https://github.com/your-repo` in `package.json`, empty `strapi.uuid`) with **no checklist telling a new user what to rename** — plus undocumented quirks (duplicate favicon, `*.csv` gitignored while uploads accept CSV, `vp config` hook install, `gen:types` script).

## Current state

- `generate-keys.sh` (46 lines) — POSIX-ish key generator. Problem lines:

```sh
#!/bin/sh                                            # line 1
    local KEY_NAME=$1                                # line 5  ('local' is not POSIX)
            if [[ "$OSTYPE" == "darwin"* ]]; then    # line 23 (bashism under sh)
    echo "Generated ${KEY_NAME}=${NEW_VALUE}"        # line 35 (prints the secret)
```

Keys generated (lines 42–46): `APP_KEYS`, `API_TOKEN_SALT`, `JWT_SECRET`, `ADMIN_JWT_SECRET`, `TRANSFER_TOKEN_SALT` — each as a single `openssl rand -base64 16` value.

- `.editorconfig:11-13`:

```ini
[{package.json,*.yml}]
indent_style = tabs
indent_size = 4
```

(The actual YAML files in the repo — docker-composes, workflow — are space-indented, so the config contradicts the codebase too.)

- Placeholders to document (verify each still exists before listing — plan 003 removes the `src/index.ts` one):
  - `package.json:50` — `"repositoryUrl": "https://github.com/your-repo"`; `package.json:2` — `"name": "strapi-template"`; `package.json:46` — `"strapi": { "uuid": "" }` (empty = telemetry disabled; document, don't change)
  - `config/plugins.ts:25-26` — `defaultFrom`/`defaultReplyTo: 'not-reply@your-project.fr'`
  - `src/index.ts:37` — `name-of-your-company-strapi-backup-` (pre-plan-003 only; post-003 it's the `BACKUP_FILE_PREFIX` env var)
  - `favicon.png` exists at repo root AND `src/admin/extensions/` (the admin build uses the latter)
  - `.gitignore:40` — `*.csv` (note: uploads accept `text/csv` via `config/plugins.ts`; the ignore only affects committing CSVs to git — worth a checklist line so nobody is surprised)
- `README.md` — has Vite+ Tooling and PostgreSQL sections; no checklist, no mention of `generate-keys.sh`, `vp config`, or `npm run gen:types`.
- Repo conventions: README uses `##` sections with short intro lines; 4-space YAML; English.

## Commands you will need

| Purpose   | Command                                   | Expected on success                       |
|-----------|-------------------------------------------|-------------------------------------------|
| Script syntax (POSIX) | `sh -n generate-keys.sh`     | exit 0, no output                          |
| Script run | `cp .env.example /tmp/imp-test.env && (cd /tmp && cp imp-test.env .env && sh /Users/path-to-repo/generate-keys.sh)` — adapt; or run in a scratch dir with a copied `.env` | keys filled, no secret values printed |
| Lint/fmt  | `vp check`                                | exit 0                                     |

## Scope

**In scope** (the only files you should modify):
- `generate-keys.sh`
- `.editorconfig`
- `README.md`

**Out of scope** (do NOT touch, even though they look related):
- The placeholders themselves (`package.json`, `config/plugins.ts`, `src/index.ts`) — they are *intentional* template variables; this plan documents them, it does not rename them.
- `.gitignore` — the `*.csv` line is a defensible default; document it instead of changing it.
- `favicon.png` duplication — document which one matters; deleting the root one risks breaking an undocumented reference.

## Git workflow

- Branch: `chore/template-polish`
- One commit: `chore(template): harden generate-keys.sh, fix yml editorconfig, add new-project checklist`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Harden generate-keys.sh

Rewrite with these exact requirements, keeping the existing structure and comments style:

1. Keep `#!/bin/sh` but remove all bashisms so the script is genuinely POSIX: replace `local` with plain assignments (the function is only called sequentially — name collisions are acceptable, or prefix variables), and replace the `[[ "$OSTYPE" == "darwin"* ]]` test with a portable check: `case "$(uname)" in Darwin) ... ;; *) ... ;; esac`.
2. Line 35: never print the value. Replace with `echo "Generated ${KEY_NAME} (value written to .env)"`.
3. `APP_KEYS` must be a comma-separated list of 4 keys. Generate it specially:

```sh
generate_app_keys() {
    K1=$(openssl rand -base64 16); K2=$(openssl rand -base64 16)
    K3=$(openssl rand -base64 16); K4=$(openssl rand -base64 16)
    echo "${K1},${K2},${K3},${K4}"
}
```

and use it for the `APP_KEYS` entry only (the sed replacement must handle `/` and `+` in base64 — the existing `s|...|...|` delimiter form already does; `,` is safe).

**Verify**: `sh -n generate-keys.sh` → exit 0. Then functional check in a scratch directory: create a `.env` containing empty `APP_KEYS=`, `JWT_SECRET=` lines, run the script, and confirm (a) output contains no base64 values (`! sh generate-keys.sh | grep -E '=[A-Za-z0-9+/]{8,}'` after re-priming the .env), (b) `.env`'s `APP_KEYS` value contains exactly 3 commas: `grep '^APP_KEYS=' .env | tr -cd ',' | wc -c` → 3.

### Step 2: Fix the YAML editorconfig section

In `.editorconfig`, split the combined section — `package.json` keeps the repo's existing 2-space JSON? No: `package.json` is currently 2-space-indented (check: `sed -n '2p' package.json` shows two leading spaces). Make the config match reality:

```ini
[package.json]
indent_style = space
indent_size = 2

[*.{yml,yaml}]
indent_style = space
indent_size = 4
```

**Verify**: `grep -n 'tabs' .editorconfig` → only the `[*]` section (line 4) remains; the `*.yml` section says `space`.

### Step 3: Add the "New project checklist" to README.md

Add a `## New project checklist` section near the top (after the intro/requirements section). Content — adjust the backup line depending on whether plan 003 is DONE (check `grep -n 'BACKUP_FILE_PREFIX' src/index.ts`):

```markdown
## New project checklist

After cloning this template:

1. **Rename the project** — `name` in `package.json`, and `repositoryUrl` in the `release` block (currently `https://github.com/your-repo`).
2. **Generate secrets** — `cp .env.example .env && sh generate-keys.sh` (fills `APP_KEYS`, `API_TOKEN_SALT`, `JWT_SECRET`, `ADMIN_JWT_SECRET`, `TRANSFER_TOKEN_SALT`; values are written to `.env` only, never printed).
3. **Set the sender address** — `defaultFrom` / `defaultReplyTo` in `config/plugins.ts`.
4. **Name your backups** — set `BACKUP_FILE_PREFIX` in `.env` (or edit the prefix in `src/index.ts` if the backup plan hasn't landed).
5. **Install the git hooks** — `vp config` (writes `.vite-hooks/`; staged files get `vp check --fix` on commit).
6. **Generate content types** — after creating content types, run `npm run gen:types`.

Notes:
- `strapi.uuid` is empty on purpose (telemetry disabled). Set one only if you want telemetry.
- The admin favicon used at build time is `src/admin/extensions/favicon.png`; the root `favicon.png` is the public one.
- `.gitignore` excludes `*.csv` from version control; uploaded CSVs are unaffected (uploads accept `text/csv`).
```

Also add one line to the existing scripts/tooling section documenting `generate-keys.sh` if it is not yet mentioned.

**Verify**: `grep -n 'New project checklist' README.md` → one match; every file/key referenced in the checklist exists (`grep -n 'your-repo' package.json`, `grep -n 'your-project.fr' config/plugins.ts`).

### Step 4: Final gate

**Verify**: `vp check` → exit 0 (markdown/format pass).

## Test plan

No unit tests (shell + docs + editor config). The functional script check in Step 1 is the behavioral verification; record its output in your report.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `sh -n generate-keys.sh` exits 0; `grep -n '\[\[\|local ' generate-keys.sh` → no matches
- [ ] Script output contains no secret values (Step 1 functional check)
- [ ] Scratch-run `.env` has `APP_KEYS` with 4 comma-separated values
- [ ] `.editorconfig` no longer applies tabs to `*.yml`
- [ ] `grep -n 'New project checklist' README.md` → one match
- [ ] `vp check` exits 0
- [ ] `git status` shows only the three in-scope files modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `generate-keys.sh` has drifted from the excerpt (someone may have already fixed it).
- The scratch-run shows `sed` mangling base64 values containing `|` — openssl base64 never emits `|`, so if you see this, something else is wrong; report.
- A checklist item references a placeholder that no longer exists (e.g. plan 003 removed the prefix) — update the item to the new reality, and note the deviation in your report.

## Maintenance notes

- Anyone adding a new placeholder to the template must add a checklist line — the checklist is now the contract for "what to rename".
- Reviewer should run the script once in a scratch dir; shell quoting bugs don't show up in `sh -n`.
- Deferred (direction option, operator's call): an interactive `init.sh`/`npm run init` that performs the whole checklist (prompts for project name, email, prefix, and rewrites the files). High template-UX value, ~M effort; do it only if the operator confirms.
