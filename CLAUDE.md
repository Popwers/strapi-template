# CLAUDE.md

This document provides guidance for AI assistants working with this Strapi template codebase.

## Project Overview

A production-ready **Strapi v5.11** CMS template with:
- Docker containerization
- MySQL/MariaDB database
- Automated S3 backups (Cloudflare R2)
- Pre-commit linting with Biome
- Semantic versioning with conventional commits
- User permissions extension with avatar support
- Sentry error tracking integration
- Email via Nodemailer

## Directory Structure

```
├── config/               # Strapi configuration files
│   ├── admin.ts         # Admin panel settings
│   ├── api.ts           # REST API settings (pagination)
│   ├── database.ts      # MySQL connection config
│   ├── middlewares.ts   # Middleware stack
│   ├── plugins.ts       # Plugin configs (email, users-permissions)
│   └── server.ts        # Server settings
├── src/
│   ├── admin/           # Admin panel customization
│   │   ├── app.tsx      # Admin config (locales, favicon)
│   │   └── extensions/  # Custom favicon
│   ├── api/             # Content-type API definitions (empty by default)
│   ├── extensions/      # Plugin extensions
│   │   └── users-permissions/  # Extended user system
│   ├── middlewares/     # Custom middlewares
│   │   └── admin-redirect.ts  # Redirects / to /admin
│   ├── index.ts         # Bootstrap with S3 backup cron job
│   └── sentry.ts        # Sentry error helper
├── database/migrations/ # Database migration files
├── public/uploads/      # Uploaded media files
└── types/generated/     # Auto-generated TypeScript types
```

## Development Commands

```bash
# Development server
npm run dev             # or: node --run develop

# Production build
npm run build

# Production start
npm run start

# Generate TypeScript types
npm run gen:types

# Upgrade Strapi
npm run upgrade
```

## Docker Development

```bash
# Production
docker-compose up -d

# Development (with hot reload)
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

The API runs at `http://localhost:1337` and admin at `http://localhost:1337/admin`.

## Code Style and Conventions

### Biome Configuration

This project uses **Biome** for linting and formatting:

- **Indentation**: Tabs (width: 4)
- **Line width**: 110 characters
- **Quotes**: Single quotes for JS, single quotes for JSX
- **Semicolons**: Always
- **Trailing commas**: ES5 style
- **Line endings**: LF

Run formatting manually:
```bash
npx @biomejs/biome check --write .
```

### TypeScript

- Uses `@strapi/typescript-utils/tsconfigs/server` base config
- Output to `dist/` directory
- Exclude: `node_modules/`, `build/`, `.cache/`, `src/admin/`, `types/generated/`

## Git Workflow

### Commit Message Convention

Uses **Conventional Commits** enforced by commitlint:

```
type(scope): description

Examples:
feat: add user avatar upload
fix(auth): correct password validation
chore(deps): update strapi to v5.11
docs: update README
```

Common types: `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `test`

### Pre-commit Hooks (Husky)

1. **pre-commit**: Runs Biome checks with auto-fix on staged files
2. **commit-msg**: Validates commit message format via commitlint

### Semantic Versioning

Automated via GitHub Actions on push to `main`:
- Analyzes commits to determine version bump
- Generates CHANGELOG.md
- Creates GitHub releases

## Key Features

### Automated Backups (src/index.ts)

Runs a cron job (default: every 6 hours) that:
1. Creates MySQL database dump
2. Exports Strapi data
3. Uploads both to S3/R2 storage

Disabled in development mode. Configure via `CRON_SCHEDULE` env var.

### Users-Permissions Extension

Custom user handling in `src/extensions/users-permissions/`:

- Auto-generates username on registration
- Sanitizes user input (prevents role/provider manipulation)
- Avatar upload endpoint: `POST /users/avatar`
- `isOwnerOrAdmin` policy for user updates
- Extended user schema with avatar field

### Admin Redirect Middleware

`src/middlewares/admin-redirect.ts` redirects `/` and `/index.html` to `/admin`.

### Sentry Integration

`src/sentry.ts` provides error reporting to Sentry in production.

## Environment Variables

Required variables (see `.env.example`):

```env
# Server
PUBLIC_URL=http://localhost:1337
HOST=0.0.0.0
PORT=1337

# Secrets (use generate-keys.sh to create)
APP_KEYS=
API_TOKEN_SALT=
JWT_SECRET=
ADMIN_JWT_SECRET=
TRANSFER_TOKEN_SALT=

# Database (MySQL/MariaDB)
DATABASE_CLIENT=mysql
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_NAME=
DATABASE_USERNAME=
DATABASE_PASSWORD=

# S3/R2 Backup
CRON_SCHEDULE=0 */6 * * *
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_ENDPOINT=https://ID.r2.cloudflarestorage.com
S3_BUCKET=

# SMTP Email
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USERNAME=
SMTP_PASSWORD=
```

Run `./generate-keys.sh` to auto-generate missing secrets.

## Adding New Content Types

1. Create API definition in `src/api/<content-type>/`:
   ```
   src/api/<name>/
   ├── content-types/<name>/schema.json
   ├── controllers/<name>.ts
   ├── routes/<name>.ts
   └── services/<name>.ts
   ```

2. Run `npm run gen:types` to generate TypeScript definitions

## Adding Custom Plugins

1. Create plugin in `src/plugins/<plugin-name>/`
2. Register in `config/plugins.ts`
3. For Docker builds, update the Dockerfile plugin section (commented template available)

## API Configuration

REST API defaults (config/api.ts):
- Default limit: 25 items
- Max limit: 100 items
- Count included in responses

## Important Notes for AI Assistants

1. **Never commit secrets** - Use environment variables from `.env`
2. **Run Biome before committing** - Pre-commit hook does this automatically
3. **Use conventional commits** - Required for semantic versioning
4. **Test with Docker** - Ensures production parity
5. **Generated types are gitignored** - Run `npm run gen:types` after schema changes
6. **MySQL only** - Database config only supports MySQL/MariaDB
7. **French locale default** - I18n defaults to `fr`, admin supports `fr`, `fr-FR`, `en`
8. **User extension is active** - Custom user creation/update logic in place
