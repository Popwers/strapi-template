# Strapi template verification map

This directory is the maintained source for verifying the user-facing behavior of strapi-template. Read the index before driving the app, then use the matching feature file as the recipe.

## Baseline preconditions

- Launch an isolated stack with `.cursor/skills/verify-strapi/bin/verify-strapi launch`.
- HTTP origin is `http://127.0.0.1:<VERIFY_STRAPI_PORT>` (default `1341`).
- Postgres is user/db `strapi_verify` on `VERIFY_PGPORT` (default `5441`).
- Run `verify-strapi doctor` and require `/_health` 204, `/` → `/admin`, and `/admin` containing `Strapi`.
- Never drive an instance that was not started by this verification run.
- Do not write repo `.env`. Do not point at production.

## Driving conventions

- Start every recipe from the baseline state unless its preconditions say otherwise.
- Prefer HTTP status, `Location`, and JSON fields over CSS selectors. Admin UI clicks use accessible names when Chrome is required.
- Treat every command as literal. Keep quoted names and flags unchanged.
- Run HTTP through `verify-strapi http`. Run screenshots through `verify-strapi screenshot`.
- Restore disposable users after a mutation. Do not remove proof artifacts during cleanup.

## Proof and skip reporting

- Capture the user action and the resulting state, not only the final screen.
- UI proof includes headers/JSON plus a screenshot with Strapi identity visible when Chrome is used.
- Mutation proof includes a read-only second view of the stored value (`/admin/init`, `/api/users/me`).
- Record the feature ID and entry point used with every artifact.
- Report an unreachable path with the attempted command and the unmet precondition.
- Do not report a skipped entry point as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with verify-strapi` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command and observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

Keep implementation details out of the map. Name only user paths, stable handles, required state, commands, and observable proof.

## Features

- [Root redirect](./root-redirect.md) covers `GET /` and `GET /index.html` sending the browser to `/admin`.
- [Admin bootstrap](./admin-bootstrap.md) covers the first-administrator wizard and `hasAdmin`.
- [Admin login](./admin-login.md) covers signing in after the first administrator exists.
- [Users register](./users-register.md) covers public registration, generated usernames, and rejected extra fields.
- [Users avatar](./users-avatar.md) covers authenticated avatar upload on `POST /api/users/avatar`.
