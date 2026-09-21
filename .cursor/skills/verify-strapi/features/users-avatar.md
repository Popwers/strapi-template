# Users avatar

Users avatar lets a signed-in end user replace their profile image through `POST /api/users/avatar` and then see that media on `GET /api/users/me`.

## Sub-features

- `avatar-auth` rejects an unauthenticated POST with 401.
- `avatar-upload` accepts multipart field `files.avatar` as an image.
- `avatar-replace` removes the previous file when a new one is uploaded.
- `avatar-me` returns the new media on `GET /api/users/me`.

## How to get to it (user POV)

- Sign in via `POST /api/auth/local`, then `POST /api/users/avatar` with multipart `files.avatar`.
- A consuming front-end account page that posts to that path.

## Driving it with verify-strapi

Preconditions:

- Strapi is healthy at `http://127.0.0.1:<port>` from this run's `launch`.
- A disposable user exists (see [Users register](./users-register.md)) with JWT `VERIFY_USER_JWT`.
- Authenticated role includes `user.updateAvatar`. If the POST is 403, stop and report `verified-unreachable`.

- **Unauthenticated.** POST without a token. Run `curl -sS -o /tmp/avatar-unauth.json -w '%{http_code}' -F 'files.avatar=@.cursor/skills/verify-strapi/fixtures/avatar.png' http://127.0.0.1:<port>/api/users/avatar`. Status is `401`.
- **Upload.** POST the same file with the JWT. Run `curl -sS -H "Authorization: Bearer $VERIFY_USER_JWT" -F 'files.avatar=@.cursor/skills/verify-strapi/fixtures/avatar.png' http://127.0.0.1:<port>/api/users/avatar`. Status is `200`. JSON `avatar` (or populated media) is present.
- **Read back.** Run `verify-strapi http GET /api/users/me` with the JWT. `avatar` is non-null.
- **Replace.** POST a second image. `GET /api/users/me` shows the new `documentId`. The previous upload is gone from `public/uploads` except `.gitkeep`.
- **Proof.** Save unauthenticated status, upload JSON, `/api/users/me` before and after, and `manifest.json` under `proof/users-avatar/`. Keep the fixture PNG; do not commit user uploads.

## Gotchas

- The multipart field name must be `files.avatar`. `avatar` alone is `No avatar provided`.
- Allowed image types are jpeg, png, webp (`config/upload-limits.ts`). SVG and HTML are rejected.
- Size cap is 15 MB. A larger fixture is not a proof of the happy path.
- Custom route permissions are not always granted on a blank database. 403 means the map path is unreachable, not that the handler is missing.
- Cleanup must not delete `public/uploads/.gitkeep`. Uploaded files under `public/uploads/` are gitignored.
