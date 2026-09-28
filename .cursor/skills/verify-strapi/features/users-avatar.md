# Users avatar

Users avatar lets a signed-in end user replace their profile image through `POST /api/users/avatar` and then see that media on `GET /api/users/me?populate=avatar`.

## Sub-features

- `avatar-auth` rejects an unauthenticated POST with 403.
- `avatar-upload` accepts multipart field `files.avatar` once `user.updateAvatar` is enabled.
- `avatar-replace` removes the previous file when a new one is uploaded.
- `avatar-me` returns the new media on `GET /api/users/me?populate=avatar`.

## How to get to it (user POV)

- Sign in via `POST /api/auth/local`, then `POST /api/users/avatar` with multipart `files.avatar`.
- A consuming front-end account page that posts to that path.

## Driving it with verify-strapi

Preconditions:

- Strapi is healthy at `http://127.0.0.1:<port>` from this run's `launch`.
- A disposable user exists (see [Users register](./users-register.md)) with JWT `VERIFY_USER_JWT`.
- An administrator from [Admin login](./admin-login.md) can `PUT /users-permissions/roles/<authenticated-id>`. Send the role object returned by `GET /users-permissions/roles/<id>` (`name`, `description`, `permissions`) with `permissions["plugin::users-permissions"].controllers.user.updateAvatar.enabled` set to `true`. Keep every other action's `enabled` flag. A body that omits `permissions` deletes the role's existing grants.

- **Unauthenticated.** POST without a token. Run `verify-strapi http POST /api/users/avatar --form 'files.avatar=@.cursor/skills/verify-strapi/fixtures/avatar.png'`. Status is `403`.
- **Before grant.** Repeat the POST with `--header "Authorization: Bearer $VERIFY_USER_JWT"`. Status is `403` on a fresh database.
- **Grant.** Enable `user.updateAvatar` as in the precondition. Status of the PUT is `200` and the body is `{"ok":true}`.
- **Upload.** Run `verify-strapi http POST /api/users/avatar --header "Authorization: Bearer $VERIFY_USER_JWT" --form 'files.avatar=@.cursor/skills/verify-strapi/fixtures/avatar.png'`. Status is `200`. This response is `user.me` and does not include `avatar` unless the query is `?populate=avatar`.
- **Wrong field.** POST `--form 'avatar=@.cursor/skills/verify-strapi/fixtures/avatar.png'` with the same bearer. Status is `400` and the message is `No avatar provided`.
- **Read back.** Run `verify-strapi http GET '/api/users/me?populate=avatar' --header "Authorization: Bearer $VERIFY_USER_JWT"`. `avatar.documentId` and `avatar.url` are set. `GET /api/users/me` without `populate` omits `avatar`.
- **Replace.** POST a second `files.avatar`. The new `avatar.documentId` differs. The previous file is gone from `public/uploads`; `.gitkeep` remains.
- **Proof.** Save the 403 statuses, the grant status, both upload statuses, both populated `/api/users/me` bodies (no tokens), and `manifest.json` under `proof/users-avatar/`. Keep the fixture PNG; do not commit user uploads.

## Gotchas

- The multipart field name must be `files.avatar`. `avatar` alone is `No avatar provided` only after `user.updateAvatar` is granted. Before the grant every POST is 403, including a bad field name.
- The upload plugin allows jpeg, png, webp, pdf, zip, csv, and plain text (`config/upload-limits.ts`). SVG and HTML are not in that list. This recipe proves a png. The user schema restricts the `avatar` media field to images.
- Size cap is 15 MB. A larger fixture is not a proof of the happy path.
- Anonymous 403 is the permission check, not `verified-unreachable`. `verified-unreachable` applies only when the admin grant itself cannot be performed.
- `verify-strapi http` sends multipart with `--form` and the JWT with `--header`. Do not combine `--form` and `--json`.
- Cleanup must not delete `public/uploads/.gitkeep`. Uploaded files under `public/uploads/` are gitignored. Delete those files after the proof; do not commit them.
