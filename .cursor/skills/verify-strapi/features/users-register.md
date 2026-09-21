# Users register

Users register creates an end-user account from email and password, assigns a generated `username_<hex>` username, and rejects extra fields such as `role`.

## Sub-features

- `register-email` creates a user from `email` and `password` only.
- `register-username` stores a generated `username_<12 hex chars>` and ignores a client-supplied username.
- `register-reject-extra` returns 400 when the body includes `role` or `provider`.
- `register-me` returns the same user from `GET /api/users/me` with the issued JWT.

## How to get to it (user POV)

- `POST /api/auth/local/register` with JSON `email` and `password`.
- A consuming front-end's sign-up form that posts to that path.

## Driving it with verify-strapi

Preconditions:

- Strapi is healthy at `http://127.0.0.1:<port>` from this run's `launch`.
- Public role still allows `auth.register` (true on a fresh template database).
- Email `verify-user@example.com` does not already exist.

- **Happy path.** Register with email and password. Run `verify-strapi http POST /api/auth/local/register --json '{"email":"verify-user@example.com","password":"VerifyUser1!"}'`. Status is `200`. JSON has `jwt` and `user.email=verify-user@example.com`. `user.username` matches `^username_[0-9a-f]{12}$`.
- **Username ignored.** Register a second address with a client username. Run `verify-strapi http POST /api/auth/local/register --json '{"email":"verify-user-2@example.com","password":"VerifyUser1!","username":"i-picked-this"}'`. Status is `200`. `user.username` still matches `^username_[0-9a-f]{12}$` and is not `i-picked-this`.
- **Role rejected.** Try to self-assign a role. Run `verify-strapi http POST /api/auth/local/register --json '{"email":"evil@example.com","password":"VerifyUser1!","role":1}'`. Status is `400` and the body mentions `Invalid parameters`.
- **Persistence.** Call `GET /api/users/me` with `Authorization: Bearer <jwt>` from the first register. Email is `verify-user@example.com` and username matches the first response.
- **Proof.** Save the three POST bodies (redact `jwt` in `run.md`), the `/api/users/me` body, and `manifest.json` under `proof/users-register/`.

## Gotchas

- `allowedFields` is `[]` in `config/plugins.ts`. Extra keys are 400 before the extension runs. The extension still overwrites `username` on the allowed body.
- Public `auth.register` can be turned off in the admin. If the POST is 403, report `verified-unreachable` with that permission missing — do not flip permissions on a shared CMS.
- Username uniqueness is off in the extended user schema; uniqueness is not the proof. The `username_` prefix is.
- Do not register against production.
