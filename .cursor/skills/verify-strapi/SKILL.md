---
name: verify-strapi
description: Drive the Strapi CMS template (admin SPA at /admin plus REST API) the way a user does. Isolated local instance, default ports 1341 (HTTP) and 5441 (Postgres). Use when proving a mapped feature, reproducing an admin or users-permissions bug, or checking the root redirect, first-admin wizard, login, register, or avatar upload before shipping.
---

# Verify strapi-template

Project-local control skill for **strapi-template** (`Popwers/strapi-template`). Primary surface is the Strapi 5 admin SPA at `/admin`. Secondary surface is the users-permissions REST API (`/api/auth/local/register`, `POST /api/users/avatar`). There is no end-user CLI. `src/api/` ships empty; there are no custom content-type routes until a consumer adds them.

Read `features/README.md` before driving. Drive one mapped feature per recipe. Do not invent entry points.

## Launch

Isolated native stack only. Default HTTP port is **1341** and default Postgres port is **5441** so a human `docker compose` on `1337`/`5432` and other local stacks that often sit on `1337`–`1340`, `5433`, `5437` are left alone.

```bash
.cursor/skills/verify-strapi/bin/verify-strapi launch
```

Ready when `verify-strapi doctor` exits 0: `GET /_health` is HTTP 204, `GET /` without following redirects is HTTP 302 with `Location: /admin`, and `GET /admin` is HTTP 200 with `Strapi` in the body.

What launch does:

1. Writes `/tmp/verify-strapi/state` and `run.env` (generated `APP_KEYS` / salts / JWT secrets, never committed, never printed).
2. Puts Postgres 18 binaries on `PATH` (`~/.local/opt/postgresql-*/bin` or `/usr/lib/postgresql/*/bin`).
3. Runs `npm ci` if `node_modules/@strapi/strapi` is missing. Package manager is npm (`package-lock.json`). The lockfile installs `@types/bun`. If that directory is still missing, launch copies `scaffolding/types-bun/` into `node_modules/@types/bun` with a `.verify-strapi-scaffold` marker so `strapi develop` can typecheck `tests/` (`bun:test`). Cleanup deletes that directory only when the marker is present. It does not change `package.json` or `package-lock.json`.
4. Starts a **native** Postgres on `VERIFY_PGPORT` (default `5441`) with user/db `strapi_verify` / `strapi_verify` in `/tmp/verify-strapi/pgdata`. Does not use `docker compose` (compose pins container names `strapi-cms` / `strapi-cms-db` and host ports `1337` / `5432`).
5. Unsets inherited `PORT` / `DATABASE_*` / `PUBLIC_URL` (agent or CI shells may inject another stack's values). Exports disposable env only — **does not write repo `.env`**.
6. Starts `vp run dev` (falls back to `npm run dev`) which runs `strapi develop` from the repo root with `HOST=127.0.0.1`, `PORT=<http>`, `PUBLIC_URL=http://127.0.0.1:<http>`, `NODE_ENV=development`. Do not use `node --run dev` on Node 20 — that flag needs Node 22+. Backup cron in `src/index.ts` returns immediately in development; dummy `S3_*` values are never used.
7. Waits until `GET /_health` is 204 (first boot compiles the admin SPA; budget 5 minutes).

Do not write `.env` in the repo. Do not run `docker compose` for verification. Do not use `vp dev` (that starts a bare Vite server). `vp run dev` is the documented product command and is what the helper starts after env is set.

Teardown is `verify-strapi cleanup`. It kills the PIDs recorded in the state file (Strapi + native Postgres). It does not kill by process name.

Manual equivalent (only when the CLI cannot run):

```bash
# Postgres 18 binaries: first match of ~/.local/opt/postgresql-*/bin, /usr/lib/postgresql/*/bin, or pg_config --bindir
for d in "$HOME"/.local/opt/postgresql-*/bin /usr/lib/postgresql/*/bin "$(pg_config --bindir 2>/dev/null)"; do
  [ -x "$d/initdb" ] && { export PATH="$d:$PATH"; break; }
done
initdb -D /tmp/verify-strapi/pgdata --auth-local=trust --auth-host=trust --username=strapi_verify --encoding=UTF8 --no-locale
postgres -D /tmp/verify-strapi/pgdata -p 5441 -k /tmp/verify-strapi/pg -c listen_addresses=127.0.0.1
createdb -h 127.0.0.1 -p 5441 -U strapi_verify strapi_verify
# then export APP_KEYS / salts (four comma-separated APP_KEYS) and:
HOST=127.0.0.1 PORT=1341 PUBLIC_URL=http://127.0.0.1:1341 \
DATABASE_CLIENT=postgres DATABASE_HOST=127.0.0.1 DATABASE_PORT=5441 \
DATABASE_NAME=strapi_verify DATABASE_USERNAME=strapi_verify DATABASE_PASSWORD=strapi_verify \
DATABASE_SSL=false NODE_ENV=development \
vp run dev
```

On a machine shared by several verify jobs, take that machine's shared lock (for example `flock` on its lock file) **before** this launch binds ports, and release it after cleanup. Do not kill foreign processes.

## Doctor

```bash
.cursor/skills/verify-strapi/bin/verify-strapi doctor
```

Doctor answers "is this instance worth driving?" It must be yes on all of:

- State file exists at `/tmp/verify-strapi/state` and was written by `launch`.
- Recorded Strapi PID is alive.
- Recorded HTTP port is listening on `127.0.0.1`.
- Recorded Postgres PID is alive and `pg_isready` succeeds on the recorded PG port as user/db `strapi_verify`.
- `GET /_health` is HTTP 204 (same probe as the Docker `HEALTHCHECK` in `Dockerfile`).
- `GET /` without following redirects is HTTP 302 and `Location` is `/admin` (`src/middlewares/admin-redirect.ts`).
- `GET /admin` is HTTP 200 and the body contains `Strapi`.

If anything looks off, stop. Do not attach to `localhost:1337` or any instance this run did not start.

## Drive

Harness is `verify-strapi` (HTTP + optional Chrome). Prefer HTTP for status, redirects, JSON, and HTML markers. Use Chrome when the proof needs a painted admin frame or a click the HTML dump cannot show.

```bash
.cursor/skills/verify-strapi/bin/verify-strapi http GET /
.cursor/skills/verify-strapi/bin/verify-strapi http GET / --no-follow
.cursor/skills/verify-strapi/bin/verify-strapi http GET /admin
.cursor/skills/verify-strapi/bin/verify-strapi http GET /admin/init
.cursor/skills/verify-strapi/bin/verify-strapi http POST /api/auth/local/register --json '{"email":"user@example.com","password":"VerifyPass1!"}'
.cursor/skills/verify-strapi/bin/verify-strapi http GET /api/users/me --header 'Authorization: Bearer <jwt>'
.cursor/skills/verify-strapi/bin/verify-strapi http POST /api/users/avatar --header 'Authorization: Bearer <jwt>' --form 'files.avatar=@.cursor/skills/verify-strapi/fixtures/avatar.png'
.cursor/skills/verify-strapi/bin/verify-strapi screenshot --path artifacts/admin.png --url /admin
.cursor/skills/verify-strapi/bin/verify-strapi drive root-redirect
```

Stable handles from this repo:

| Surface | Handle |
| --- | --- |
| Health probe | `GET /_health` → 204 (`Dockerfile` `HEALTHCHECK`) |
| Root redirect | `GET /` and `GET /index.html` → 302 `Location: /admin` (`src/middlewares/admin-redirect.ts`) |
| Admin SPA | `GET /admin` HTML contains `Strapi`; document is the admin shell |
| Admin init | `GET /admin/init` JSON; `data.hasAdmin` is `false` until the first administrator exists |
| First-admin wizard | `/admin` form fields firstname, lastname, email, password (Strapi 5 welcome screen) |
| First-admin API | `POST /admin/register-admin` with `email`, `password`, `firstname`, `lastname` |
| Admin login | `/admin` login after `hasAdmin` is true; `POST /admin/login` |
| Users register | `POST /api/auth/local/register` with `email` + `password`. The extension replaces the body with those two fields plus a generated username (`strapi-server.ts`) |
| Generated username | response `user.username` matches `username_<12 hex chars>` (`src/extensions/users-permissions/helper.ts`) |
| Extra register keys | `role`, `provider`, and a client `username` are dropped. The POST still returns 200 and a generated username. It does not return 400 |
| Avatar | `POST /api/users/avatar` multipart field `files.avatar`. Anonymous and ungranted calls are 403 until the Authenticated role has `user.updateAvatar` |
| Profile update | `PUT /api/users/:id` (numeric id). Owner may change `username`. `blocked`, `role`, `provider`, and `confirmed` are stripped. Other users and anonymous callers get 403 |
| User content-type label | Content-Manager display name `Utilisateur` |
| Admin locales | `fr`, `fr-FR`, `en` (`src/admin/app.tsx`) |
| Default REST page | `defaultLimit` 25, `maxLimit` 100 (`config/api.ts`) |

There are no `data-testid` attributes in this template. Do not use coordinates or tab order. Prefer `/admin/init`, `/_health`, and the redirect `Location` header.

Public `auth.register` and authenticated `user.me` are granted on a fresh Strapi install. `POST /api/users/avatar` and `PUT /api/users/:id` are 403 until an admin enables `user.updateAvatar` and `user.update` on the Authenticated role (`PUT /users-permissions/roles/:id` with the role's existing `permissions` object at the top level of the body, those actions `enabled: true`). A body wrapped as `{ "data": ... }` or `{ "role": ... }` still returns `{"ok":true}` and deletes every existing grant. A 403 before that grant is the fresh-database state, not a missing route. Anonymous avatar upload is also 403 (the permission layer runs before the controller's 401).

## Evidence

Default proof directory for a named drive:

```text
.cursor/skills/verify-strapi/proof/<feature-id>/
```

Ad-hoc runs may also write `/tmp/verify-strapi/artifacts/<run-id>/`. Cleanup deletes scratch under `/tmp/verify-strapi/` except copies already placed in the skill `proof/` directory.

Every proof includes:

- The user action (command + URL).
- The resulting state (status, redirect, JSON field, HTML marker, or screenshot).
- Side effects when the feature mutates data (second GET). Register proof re-reads `/api/users/me` with the returned JWT. First-admin proof re-reads `/admin/init` and requires `hasAdmin=true`.
- `manifest.json` with `feature`, `baseUrl`, `commands`, `checks`.

Standards:

- Exercise the real path (`/`, `/admin`, `/api/auth/local/register`), not a test-only setter or a direct DB write.
- Capture the action and the result, not only the last screen.
- A 200 on `/admin` is not enough for `root-redirect`. Assert the unfollowed `GET /` 302 and `Location: /admin`.
- A 204 on `/_health` is doctor, not a mapped feature.
- Do not POST register-admin or users-register against a shared or production CMS.
- Chrome screenshots must show the page identity (Strapi welcome / login chrome). Headless Chrome is `/usr/bin/google-chrome` or `google-chrome` when present. Chrome often writes the PNG and then hangs; `verify-strapi screenshot` treats a non-empty file as success and kills the process.

The first committed proof lives at `proof/root-redirect/`. Later runs may overwrite that folder only when re-proving the same feature.

## Cleanup

```bash
.cursor/skills/verify-strapi/bin/verify-strapi cleanup
```

Cleanup stops the Strapi PID and the native Postgres PID this launch started. It removes `/tmp/verify-strapi/state`, `run.env`, cookie jars, Chrome profiles, and `pgdata`. It never deletes `.cursor/skills/verify-strapi/proof/`.

If launch failed halfway, run cleanup anyway. The state file records whatever was started.

## Helpers

`bin/verify-strapi` is executable. Invoke it from the repo root.

| Command | Purpose |
| --- | --- |
| `launch [--port N] [--pg-port N]` | Start isolated Postgres + `strapi develop`, write state, wait for `/_health` |
| `doctor` | Read-only ownership + health check |
| `http METHOD PATH [--no-follow] [--json '{}'] [--header 'K: V'] [--form 'field=@file'] [--out-body FILE]` | Request against the owned origin. Repeat `--header` and `--form`. Do not combine `--json` and `--form`. `--out-body` copies the response body; redact tokens before committing proof |
| `screenshot --path FILE [--url /path]` | Headless Chrome PNG of a path |
| `drive root-redirect` | Scripted recipe + `proof/root-redirect/`. Other feature IDs are driven with `http` from their feature file |
| `cleanup` | Tear down what this run started |
| `self-check` | CLI smoke (help + doctor-without-instance). Does not start the app |

`--json` on `doctor` and `launch` prints the state object.

Env the helper reads: `VERIFY_STRAPI_PORT` (default `1341`), `VERIFY_PGPORT` (default `5441`), `VERIFY_STRAPI_TMP` (default `/tmp/verify-strapi`), `VERIFY_EVIDENCE_DIR` (default `<skill>/proof`), `VERIFY_EXTRA_PATH` (optional, colon-separated directories prepended to `PATH` when a tool such as `vp` lives somewhere non-standard). Proof files record paths relative to the repo (or to `VERIFY_EVIDENCE_DIR` when it lives elsewhere), never an absolute path.

## Isolation

Two verify stacks can run if HTTP and Postgres ports both differ. Launch refuses a port that is already listening unless the recorded PID owns it. Do not drive a teammate's `:1337`. Do not start `docker compose` while another stack holds `strapi-cms` / `strapi-cms-db`. Do not write production secrets, DNS, Coolify, or SSH. Do not merge from this skill.

On a machine shared by several verify jobs, take its shared lock (for example `flock -w 1200 <lock file>`) before binding ports. Pick free alternate ports. Do not kill foreign processes. Release the lock after cleanup.

## Maintenance

Keep the map honest with `/maintain-verification-skill` as routes, admin chrome, and users-permissions behavior change.
