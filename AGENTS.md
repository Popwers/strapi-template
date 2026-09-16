# AGENTS.md

Strapi 5 CMS template. PostgreSQL only. `packageManager` is npm (`package-lock.json`). Vite+ (`vp`) delegates to npm. There is no Tailwind, so do not add `@shadcn/lint` or `cn`.

Default branch is `master`.

## Commands

Type `make` for the list. Use these targets.

| Task | Command |
| --- | --- |
| Install deps and Git hooks | `make install` (`vp i` then `vp config`) |
| Lint, format, typecheck | `make check` (`vp check`) |
| Tests | `make test` (`vp test`) |
| Dev server | `make dev` (`vp run dev` → `strapi develop`) |
| Production build | `make build` (`vp run build` → `strapi build`) |
| Generate content-type types | `vp run gen:types` |

Never type `vp dev` or `vp build`. Those run the Vite+ app pipeline. This repo is Strapi. `dev` and `build` in `package.json` stay `strapi develop` and `strapi build`.

Do not type `npm i`, `npx`, or `bun add`. Use `vp i`, `vp add`, and `vpx`.

## Toolchain

- Lint, format, typecheck: Oxlint, Oxfmt, tsgo via `vp check`. Config lives in `vite.config.ts`.
- anti-slop is vendored from https://github.com/dmmulroy/anti-slop into `tools/oxlint/anti-slop/`. Do not register `@shadcn/lint`.
- Tests import `bun:test`. `vite.config.ts` aliases that to Vitest so `vp test` runs them.
- Git hooks: `vp config` writes `.vite-hooks/`. Staged files run `vp check --fix`.
- Commits: conventional commits via `cz` or `ga`.

## Layout

```
config/          Strapi config (admin, api, database, plugins, server)
src/admin/       Admin panel (locales, favicon)
src/api/         Content-type APIs (empty in the template)
src/extensions/  Plugin extensions (users-permissions)
src/middlewares/ Custom middlewares (admin-redirect)
src/index.ts     Bootstrap, S3 backup cron
tests/           Mirrors src/, `.test.ts`
tools/oxlint/anti-slop/  Vendored Oxlint plugin
```

Generated types in `types/generated/` are gitignored. Run `vp run gen:types` after schema changes.

## Conventions

- Interfaces over types. No `as any`. Keep a `// SAFETY:` comment on every remaining assertion.
- Guard clauses and early returns. Validate at system boundaries only.
- Auth check plus ownership check on every mutating endpoint. Ownership belongs in the query.
- Multi-step mutations must be transactional.
- Comments in English. JSDoc on exports.

## Project facts

- Secrets live in `.env`. Copy `.env.example`, then run `sh generate-keys.sh`. Never commit `.env`.
- i18n default locale is `fr`. Admin locales are `fr`, `fr-FR`, `en`.
- REST defaults in `config/api.ts`: limit 25, max 100, count included.
- Backup cron in `src/index.ts` is off in development. Configure it with `CRON_SCHEDULE`. Change the backup file prefix before first use.
- `strapi.uuid` in `package.json` is empty on purpose (telemetry off).
- Docker: `docker compose up -d` (prod) or overlay `docker-compose.dev.yml` (dev). API at `http://localhost:1337`, admin at `/admin`.
- Historical plans live in `plans/`. Do not treat them as current runbooks.
