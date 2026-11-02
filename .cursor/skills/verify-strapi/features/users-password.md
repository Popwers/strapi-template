# Users password

Users password lets a signed-in end user change their password. The change signs that user out everywhere else: every JWT issued before it gets 401, while the token the change returns keeps working.

## Sub-features

- `password-change` accepts `POST /api/auth/change-password` with `currentPassword`, `password`, and `passwordConfirmation`, and returns a new `jwt`.
- `password-wrong-current` refuses a wrong `currentPassword` with 400 and leaves the old JWT valid.
- `password-revoke` returns 401 on `GET /api/users/me` for a JWT issued in an earlier second than the change.
- `password-put-revoke` does the same when the owner sends `password` through `PUT /api/users/<id>`, which returns no new token.
- `password-hidden` keeps the change timestamp out of `GET /api/users/me`.

## How to get to it (user POV)

- A consuming front-end's "change password" form that posts to `/api/auth/change-password` with the user's JWT.
- An account page that sends `password` in `PUT /api/users/<id>`.
- The "forgot password" flow (`POST /api/auth/forgot-password`, then `POST /api/auth/reset-password` with the emailed code). Driving it needs that code; see Gotchas.

## Driving it with verify-strapi

Preconditions:

- Strapi is healthy at `http://127.0.0.1:<port>` from this run's `launch`.
- The Authenticated role still allows `auth.changePassword` (true on a fresh database).
- A disposable user registered by this run (see [Users register](./users-register.md)), for example `verify-pw@example.com` / `VerifyUser1!`, with its JWT as `<jwt1>` and numeric `user.id`.
- For the PUT variant only: `user.update` granted as in [Users update](./users-update.md).

- **Wait.** Run `sleep 1.2` after the register. A JWT issued in the same second as the change is not revoked.
- **Wrong current password.** Run `verify-strapi http POST /api/auth/change-password --header "Authorization: Bearer <jwt1>" --json '{"currentPassword":"WrongPass1!","password":"VerifyUser2!","passwordConfirmation":"VerifyUser2!"}'`. Status is `400` and `error.message` is `The provided current password is invalid`. `GET /api/users/me` with `<jwt1>` is still `200`.
- **Change.** Run the same POST with `"currentPassword":"VerifyUser1!"`. Status is `200` with a new `jwt` (`<jwt2>`) and the `user` object.
- **Old token revoked.** Run `verify-strapi http GET /api/users/me --header "Authorization: Bearer <jwt1>"`. Status is `401` (`Missing or invalid credentials`).
- **New token works.** Run the same GET with `<jwt2>`. Status is `200` and the body has no `passwordChangedAt`.
- **Old password refused.** Run `verify-strapi http POST /api/auth/local --json '{"identifier":"verify-pw@example.com","password":"VerifyUser1!"}'`. Status is `400`.
- **PUT variant.** After `sleep 1.2`, run `verify-strapi http PUT /api/users/<id> --header "Authorization: Bearer <jwt2>" --json '{"password":"VerifyUser3!"}'`. Status is `200` and the body has no `jwt`. `GET /api/users/me` with `<jwt2>` is now `401`. `POST /api/auth/local` with `VerifyUser3!` is `200` and its JWT reads `/api/users/me`.
- **Proof.** Save every status, the redacted change response, both `/api/users/me` reads, and `manifest.json` under `proof/users-password/`. Redact JWTs.

## Gotchas

- Revocation compares whole seconds. Without the 1-second wait, `<jwt1>` can survive the change and the recipe looks broken when it is not.
- The change-password and reset-password responses carry the only token that stays valid. Keep `<jwt2>` before checking `<jwt1>`.
- Reset needs the code Strapi emails. The local launch has no mailbox and the map does not write the code into the database, so report the reset path as `verified-unreachable` (prerequisite: a delivered reset email) unless a mailbox is wired in. The repo's e2e suite (`tests/e2e/password-reset.e2e.ts`) covers it by writing the code directly.
- `passwordChangedAt` sent by a client is dropped (see [Users update](./users-update.md)). A JWT that turns 401 after a PUT without `password` is a bug.
