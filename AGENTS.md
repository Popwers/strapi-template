# Strapi template

Strapi 5 CMS template on PostgreSQL. Email via Nodemailer. Media and backups on Cloudflare R2 (EU jurisdiction). Sentry in production. The lockfile is `package-lock.json`, so `vp` delegates to npm. There is no Tailwind. Never run `vp dev` or `vp build`. Those start the Vite+ app pipeline. `dev` and `build` stay `strapi develop` and `strapi build`.

## Commands

Type `make` for the list.

| Need | Command | What it runs |
| --- | --- | --- |
| Install + hooks | `make install` | `vp i` then `make hooks` |
| Git hooks only | `make hooks` | `vp config` |
| Strapi develop | `make dev` | `vp run dev` → `strapi develop` |
| Lint + fmt + types | `make check` | `vp check` |
| Tests | `make test` | `vp test` |
| Pre-push checks | `make verify` | `vp check` then `vp test run` |
| E2E (HTTP + admin) | `make e2e` | `vp run test:e2e:ci` → e2e without agent tests, `tests/e2e/` |
| E2E incl. agent test | `vp run test:e2e` | `e2e run`, needs `npx e2e login spacexai` |
| Admin + server build | `make build` | `vp run build` → `strapi build` |
| Generate TS types | `vp run gen:types` | `strapi ts:generate-types --debug` |
| Create missing secrets | `./generate-keys.sh` | fills empty secret vars in `.env` |

API: `http://localhost:1337`. Admin: `http://localhost:1337/admin`.

Default branch is `master`. Conventional commits via `cz` / `ga`. `vp config` points Git at `.vite-hooks/`. Commit runs `vp staged` (`vp check --fix`). Push runs `.vite-hooks/pre-push` (see Checks).

## E2E

Tests run with [e2e](https://e2e.tester.army) from `tests/e2e/*.e2e.ts`, configured in `e2e.config.mts`. `make e2e` (`vp run test:e2e:ci`) skips the `agent` tag. `vp run test:e2e` runs everything. Needs Docker, Node >= 24.8 and a Chromium (`npx @e2e-dev/web install chromium` once). The e2e runner starts `tests/e2e/serve.sh`, which starts a throwaway `postgres:18-alpine` on port 5447 and an `adobe/s3mock` standing in for the R2 backups bucket on port 5448, builds Strapi, creates an admin and serves on port 1347 in production mode with the backup cron every 10 s. Its `EXIT` trap removes both containers and their volumes. Override ports with `E2E_PORT`, `E2E_DB_PORT` and `E2E_S3_PORT`. `backup.e2e.ts` waits for a Strapi archive in the mock bucket and checks the server still answers; the host usually has no `pg_dump`, so the dump step logs `spawn pg_dump ENOENT` there and only runs for real in the image. `E2E_REUSE_SERVER=1` attaches to a server already on the port. `roles.setup.e2e.ts` grants the authenticated role `user.update` and `user.updateAvatar` and creates an `admin` type role: API tests take only `app`, use `fetch` (`support.ts`) and declare `{ session: ROLES }` so it runs first, even for a single file. `admin.setup.e2e.ts` saves the admin session. Browser tests import `test` from `fixtures.ts`, whose guard fails them on any `console.error`, uncaught error, failed same-origin asset or 4xx/5xx response, or CSP violation recorded by `page-errors.js` (push a pattern into `allowedPageErrors` to expect one). `password-reset.e2e.ts` writes a reset code straight into the database (`docker exec` on the Postgres container; no mailbox) and checks the earlier JWT gets 401. `agent-admin.e2e.ts` is the one agent test (admin creates a user in the Content Manager). Strapi rate-limits admin logins to 5 per 5 minutes per address, so a reused server blocks after a few runs. `tests/e2e/` is ESM with its own `tsconfig.json`, excluded from the Strapi build. Report: `.e2e/report.json`, `.e2e/junit.xml`. Agent steps use SuperGrok (`npx e2e login spacexai`). The MCP server `e2e` is registered globally by the agent harness (`e2e-mcp`), not in this repo.

## Checks

There is no CI workflow. Checks run on your machine in the `pre-push` hook (`.vite-hooks/pre-push`): `make verify`, then `make e2e` when the pushed commits touch what the e2e suite builds or runs (`src/`, `config/`, `database/`, `public/`, `tests/e2e/`, `e2e.config.mts`, `favicon.png`, `tsconfig.json`, `package.json`, `package-lock.json`, `.npmrc`). A push that only touches docs, markdown or editor config skips the gate. Hooks install themselves with the dependencies (`prepare` runs `vp config`); `make hooks` reinstalls them. `git push --no-verify` bypasses the gate once. Projects started from this template inherit the hook.

`.github/workflows/versionning.yml` is the only workflow: semantic-release on `master`, on `ubuntu-latest`.

## Docker

```bash
docker compose up -d
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

The second form is local hot reload.

## Layout

```
config/                 Strapi config (admin, api, database, middlewares, plugins, server)
src/admin/              Admin panel (locales, favicon)
src/api/                Content-type APIs (empty in the template)
src/extensions/users-permissions/   Custom user create/update
src/middlewares/admin-redirect.ts   `/` and `/index.html` → `/admin`
src/index.ts            Bootstrap. Schedules the backup cron
src/backup.ts           Backup run: pg_dump + Strapi export to R2
src/backup-monitor.ts   Sentry cron check-ins around a backup run
src/sentry.ts           Sentry helper
src/sentry-noise.ts     Pure predicates behind the Sentry `beforeSend` filter
src/sentry-scrub.ts     Strips personal data from Sentry events
database/migrations/    SQL migrations
public/uploads/         Media on local storage (dev, e2e, docker compose)
generate-keys.sh        Secret generator
tests/                  Vitest
tests/e2e/              e2e suite (real Strapi + throwaway Postgres)
e2e.config.mts          e2e config
vite.config.mts         Lint, fmt, staged, test
```

PostgreSQL only. `config/database.ts` does not support other clients.

## Features

### Backups (`src/backup.ts`)

A cron (default every 6 hours, `CRON_SCHEDULE`, scheduled in `src/index.ts`) runs `pg_dump` and a Strapi export, and uploads both to the `<name>-backups` R2 bucket as `<BACKUP_KEY_PREFIX>db-<ts>.sql` and `<BACKUP_KEY_PREFIX>strapi-<ts>.tar.gz` (prefix `backup-`, the one the 3-day lifecycle rule expires). The export runs inside the server through `@strapi/data-transfer`, with `autoDestroy: false` (the default destroys the live instance), because the `strapi` CLI is not on the image's PATH and would boot a second Strapi. Files go to a private dir under `os.tmpdir()`, removed after each run. The two steps are independent: one failing is logged and sent to Sentry, the other still uploads. A run that overlaps the previous one is skipped. It is off in development.

The Strapi archive holds the media library too: the export streams every upload-plugin file, fetched from `<name>-files` through its URL when uploads are on R2, so the files bucket is backed up with the database (`backup.e2e.ts` uploads a file and finds it in the next archive).

Each run checks in to the Sentry cron monitor `strapi-backup` (`src/backup-monitor.ts`): `in_progress`, then `ok`, or `error` when a step failed or the run threw. The check-in upserts the monitor from `CRON_SCHEDULE` in the server's timezone, with one failure or missed run enough to raise an issue; a six-field rule sends no config, so such a monitor is set up by hand. A check-in that fails is logged and never stops the backup. Sentry off (development, no DSN) means no check-ins.

### Uploads (`config/upload-storage.ts`)

With `S3_UPLOAD_BUCKET` set, media goes to that R2 bucket through `@strapi/provider-upload-aws-s3` (no ACL header, R2 has none) and file URLs use `S3_UPLOAD_PUBLIC_URL`, whose origin is added to the admin's `img-src` and `media-src`. Without it, media stays in `public/uploads`. Production refuses to boot on local storage unless `UPLOAD_LOCAL=true` (set by `tests/e2e/serve.sh` and `docker-compose.yml`), since a container's disk is wiped on every deploy.

### Security headers (`config/middlewares.ts`)

`strapi::security` sends no `Strict-Transport-Security`: the Cloudflare zone is the only HSTS source.

### Users-permissions

`src/extensions/users-permissions/`:

- Username is generated on registration
- Role and provider fields are stripped from client input
- Avatar upload: `POST /users/avatar`
- `isOwnerOrAdmin` policy on user updates
- A password change revokes the user's earlier JWTs (`password-change.ts`): a database lifecycle stamps the private, hidden `passwordChangedAt` on every write that sets a password (reset, change, `PUT /users/:id`, the admin), and the wrapped `jwt` service refuses a token whose `iat` falls in an earlier second. The token `reset-password` and `change-password` return stays valid; a password set through `PUT /users/:id` signs the user out. Clients cannot write the field. In `jwtManagement: 'refresh'` mode the session manager does this instead and the check is skipped.
- User schema includes an avatar field

There is no Turnstile check in this CMS: the paired Astro front (`astrojs-template`, `src/actions/`) verifies the token server-side before it calls `/api/auth/*`, and a Turnstile token is single-use, so Strapi cannot verify it again. A client that calls Strapi's public auth routes directly skips the captcha; only the Cloudflare rate-limit rule on `/api/auth/*` stands in front of them.

### Admin redirect

`src/middlewares/admin-redirect.ts` sends `/` and `/index.html` to `/admin`.

### Sentry

`@strapi/plugin-sentry` (`config/plugins.ts`) runs in production when `SENTRY_DSN` is set. Events carry `SENTRY_RELEASE`, falling back to `SOURCE_COMMIT`, which Coolify passes as a build argument (*Include source commit in build*) and the Dockerfile keeps in the image. `sendDefaultPii` is off and `beforeSend` ends with `scrubEvent` (`src/sentry-scrub.ts`): the request keeps only its method and path (no headers, cookies, body or query string), the user only its id, breadcrumbs lose their query. Tracing is off (no `tracesSampleRate`). `src/sentry.ts` forwards caught errors to it. Its `beforeSend` drops the answers Strapi gives a visitor, with exact matches from `src/sentry-noise.ts`: the refusal classes (`UnauthorizedError`, `ForbiddenError`, `RateLimitError`, `PolicyError`), any `ValidationError` raised out of a request (the plugin attaches `event.request`; `sendError` from the backup cron or a service has none, so it still reports), and a short list of exact `ApplicationError` and `BadRequestError` messages (blocked account, taken email, `Invalid credentials`, `Already confirmed`, `Malicious Path`). Never match by substring. When adding a filter, add the noise sample and a real bug close to its text in `tests/sentry-noise.test.ts`, which runs the real plugin on Koa with the config's `beforeSend`.

### REST defaults (`config/api.ts`)

Default page size 25. Max 100. Count included.

### i18n

Default locale is `fr` (`STRAPI_PLUGIN_I18N_INIT_LOCALE_CODE`). Admin locales: `fr`, `fr-FR`, `en`.

## Environment

Copy `.env.example` to `.env`. Run `./generate-keys.sh` for empty secrets. Never commit `.env`.

| Group | Variables |
| --- | --- |
| Server | `PUBLIC_URL`, `HOST`, `PORT` |
| Secrets | `APP_KEYS`, `API_TOKEN_SALT`, `JWT_SECRET`, `ADMIN_JWT_SECRET`, `TRANSFER_TOKEN_SALT` |
| Database | `DATABASE_CLIENT=postgres`, `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, `DATABASE_SCHEMA` |
| R2 | `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT` (`https://<account>.eu.r2.cloudflarestorage.com`) |
| R2 backup | `CRON_SCHEDULE`, `S3_BUCKET` (`<name>-backups`), `BACKUP_KEY_PREFIX` (default `backup-`) |
| R2 uploads | `S3_UPLOAD_BUCKET` (`<name>-files`), `S3_UPLOAD_PUBLIC_URL` (its CDN domain), `UPLOAD_LOCAL` |
| SMTP | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USERNAME`, `SMTP_PASSWORD` |
| i18n | `STRAPI_PLUGIN_I18N_INIT_LOCALE_CODE` |

Generated types are gitignored. Run `vp run gen:types` after schema changes.

## Add a content type

Create `src/api/<name>/` with `content-types/<name>/schema.json`, `controllers`, `routes`, and `services`. Then `vp run gen:types`.

## Add a plugin

Create `src/plugins/<name>/` and register it in `config/plugins.ts`. Docker builds need the plugin copied. The Dockerfile has a commented template.

## Lint

Vendored anti-slop lives in `tools/oxlint/anti-slop/`. This template has no `@shadcn/lint`.
