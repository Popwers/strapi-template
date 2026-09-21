# Strapi template

Strapi 5 CMS template with Docker, Vite+ tooling, semantic versioning, and S3 backup.

Type `make` for the command list. `vp` delegates to npm (`package-lock.json`).

## New project checklist

After you clone this template, replace the placeholders before you go further.

1. Rename the project. Set `name` in `package.json` and `repositoryUrl` in the `release` block (currently `https://github.com/your-repo`).
2. Generate secrets. `cp .env.example .env && sh generate-keys.sh` (fills `APP_KEYS`, `API_TOKEN_SALT`, `JWT_SECRET`, `ADMIN_JWT_SECRET`, `TRANSFER_TOKEN_SALT`; values are written to `.env` only, never printed).
3. Set the sender address. `defaultFrom` / `defaultReplyTo` in `config/plugins.ts` (currently `not-reply@your-project.fr`).
4. Name your backups. Change the backup file prefix in `src/index.ts` (currently `name-of-your-company-strapi-backup-`).
5. Install deps and Git hooks. `make install` (`vp i` then `vp config`; staged files get `vp check --fix` on commit).
6. Generate content types. After you create content types, run `vp run gen:types`.

Notes:

- `strapi.uuid` in `package.json` is empty on purpose (telemetry disabled). Set one only if you want telemetry.
- The admin favicon used at build time is `src/admin/extensions/favicon.png`. The root `favicon.png` is the public one.
- `.gitignore` excludes `*.csv` from version control. Uploaded CSVs are unaffected (uploads accept `text/csv`).

## Get started

### Prerequisites

- [Vite+](https://vite.dev/plus) (`vp`)
- Node.js LTS (`vp env use lts`)
- npm (comes with Node; `vp` calls it because `packageManager` is npm)
- PostgreSQL

### Local (no Docker)

1. Clone the repository:

   ```bash
   git clone https://github.com/Popwers/strapi-template.git
   cd strapi-template
   ```

2. Install dependencies and Git hooks:

   ```bash
   make install
   ```

3. Copy `.env.example` to `.env` and run `sh generate-keys.sh`.

4. Start the development server:

   ```bash
   make dev
   ```

The API is at `http://localhost:1337`. The admin panel is at `http://localhost:1337/admin`.

`make dev` runs `vp run dev`, which runs `strapi develop`. Do not type `vp dev`.

## Docker

This project ships a multi-stage Dockerfile and Compose files.

### Prerequisites

- Docker
- Docker Compose

### Run

1. Clone the repository:

   ```bash
   git clone https://github.com/Popwers/strapi-template.git
   cd strapi-template
   ```

2. Copy `.env.example` to `.env` and run `sh generate-keys.sh`.

3. Start the stack.

   Production:

   ```bash
   docker compose up -d
   ```

   Development (hot reload):

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
   ```

The API is at `http://localhost:1337`. The admin panel is at `http://localhost:1337/admin`.

## Tooling

| Task | Command |
| --- | --- |
| Install deps and hooks | `make install` |
| Lint, format, typecheck | `make check` |
| Auto-fix | `vp check --fix` |
| Tests | `make test` |
| Dev server | `make dev` |
| Production build | `make build` |

Lint, format, and typecheck are Vite+ (`vite-plus`), configured in `vite.config.ts`. anti-slop is vendored from https://github.com/dmmulroy/anti-slop. This template has no Tailwind, so it does not use `@shadcn/lint` or `cn`.
