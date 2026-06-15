# Strapi template

This is a Strapi template to start your project. It includes Docker, Vite+ tooling (lint, format, pre-commit hooks), auto semantic versioning and S3 backup.

## ✅ New project checklist

After cloning this template, replace the placeholders before going further:

1. **Rename the project** — `name` in `package.json`, and `repositoryUrl` in the `release` block (currently `https://github.com/your-repo`).
2. **Generate secrets** — `cp .env.example .env && sh generate-keys.sh` (fills `APP_KEYS`, `API_TOKEN_SALT`, `JWT_SECRET`, `ADMIN_JWT_SECRET`, `TRANSFER_TOKEN_SALT`; values are written to `.env` only, never printed).
3. **Set the sender address** — `defaultFrom` / `defaultReplyTo` in `config/plugins.ts` (currently `not-reply@your-project.fr`).
4. **Name your backups** — change the backup file prefix in `src/index.ts` (currently `name-of-your-company-strapi-backup-`).
5. **Install the git hooks** — `vp config` (writes `.vite-hooks/`; staged files get `vp check --fix` on commit).
6. **Generate content types** — after creating content types, run `npm run gen:types`.

Notes:

- `strapi.uuid` in `package.json` is empty on purpose (telemetry disabled). Set one only if you want telemetry.
- The admin favicon used at build time is `src/admin/extensions/favicon.png`; the root `favicon.png` is the public one.
- `.gitignore` excludes `*.csv` from version control; uploaded CSVs are unaffected (uploads accept `text/csv`).

## 🚀 Getting Started

## 🐳 Docker Setup

This project is fully containerized using Docker, which simplifies the setup process and ensures consistency across different environments.

### Prerequisites

- Docker
- Docker Compose

### Running the Application

1. Clone the repository:
   ```bash
   git clone https://github.com/Popwers/strapi-template.git
   cd strapi-template
   ```

2. Create a `.env` file in the root directory and configure your environment variables (see `.env.example` for required variables).

3. Run the `generate-keys.sh` script to get fresh keys for Strapi

4. Start the application:

   For production:
   ```bash
   docker-compose up -d
   ```

   For development:
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
   ```

The api will be available at `http://localhost:1337`, and the admin panel at `http://localhost:1337/admin`.

## Development

For local development without Docker, you can still use npm:

### Prerequisites

- npm (latest version only LTS)
- Node.js (latest version only LTS)
- PostgreSQL database

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Popwers/strapi-template.git
   cd strapi-template
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up your environment variables in a `.env` file (see `.env.example` for required variables).

4. Run the development server:
   ```bash
   node --run dev
   ```

The admin panel will be available at `http://localhost:1337/admin`.

## Tooling

Lint, format and typecheck are handled by Vite+ (`vite-plus`), configured in `vite.config.ts`:

```bash
vp check --fix   # lint + fmt + typecheck
vp fmt           # format only
vp lint          # lint only
```

Install the Git pre-commit hook once per clone (runs `vp check --fix` on staged files):

```bash
vp config
```
