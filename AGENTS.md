# Strapi template

Strapi 5 CMS template on PostgreSQL. Email via Nodemailer. Backups to Cloudflare R2. Sentry in production. The lockfile is `package-lock.json`, so `vp` delegates to npm. There is no Tailwind. Never run `vp dev` or `vp build`. Those start the Vite+ app pipeline. `dev` and `build` stay `strapi develop` and `strapi build`.

## Commands

Type `make` for the list.

| Need | Command | What it runs |
| --- | --- | --- |
| Install + hooks | `make install` | `vp i` then `vp config` |
| Strapi develop | `make dev` | `vp run dev` → `strapi develop` |
| Lint + fmt + types | `make check` | `vp check` |
| Tests | `make test` | `vp test` |
| Admin + server build | `make build` | `vp run build` → `strapi build` |
| Generate TS types | `vp run gen:types` | `strapi ts:generate-types --debug` |
| Create missing secrets | `./generate-keys.sh` | fills empty secret vars in `.env` |

API: `http://localhost:1337`. Admin: `http://localhost:1337/admin`.

Default branch is `master`. Conventional commits via `cz` / `ga`. `vp config` writes hooks into `.vite-hooks/`. Staged check is `vp check --fix`.

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
src/index.ts            Bootstrap. Starts the backup cron
src/sentry.ts           Sentry helper
database/migrations/    SQL migrations
public/uploads/         Media
generate-keys.sh        Secret generator
tests/                  Vitest
vite.config.ts          Lint, fmt, staged, test
```

PostgreSQL only. `config/database.ts` does not support other clients.

## Features

### Backups (`src/index.ts`)

A cron (default every 6 hours, `CRON_SCHEDULE`) runs `pg_dump`, exports Strapi data, and uploads both to R2. It is off in development.

### Users-permissions

`src/extensions/users-permissions/`:

- Username is generated on registration
- Role and provider fields are stripped from client input
- Avatar upload: `POST /users/avatar`
- `isOwnerOrAdmin` policy on user updates
- User schema includes an avatar field

### Admin redirect

`src/middlewares/admin-redirect.ts` sends `/` and `/index.html` to `/admin`.

### Sentry

`src/sentry.ts` reports errors in production.

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
| R2 backup | `CRON_SCHEDULE`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT`, `S3_BUCKET` |
| SMTP | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USERNAME`, `SMTP_PASSWORD` |
| i18n | `STRAPI_PLUGIN_I18N_INIT_LOCALE_CODE` |

Generated types are gitignored. Run `vp run gen:types` after schema changes.

## Add a content type

Create `src/api/<name>/` with `content-types/<name>/schema.json`, `controllers`, `routes`, and `services`. Then `vp run gen:types`.

## Add a plugin

Create `src/plugins/<name>/` and register it in `config/plugins.ts`. Docker builds need the plugin copied. The Dockerfile has a commented template.

## Lint

Vendored anti-slop lives in `tools/oxlint/anti-slop/`. This template has no `@shadcn/lint`.
