# Users update

Users update lets a signed-in end user change their own account with `PUT /api/users/<numeric id>` and blocks everyone else, including anonymous callers.

## Sub-features

- `update-owner` lets the owner change `username`.
- `update-strip` drops `blocked`, `role`, `provider`, and `confirmed` from the body so the owner cannot set them.
- `update-other` returns 403 when a different authenticated user targets that id.
- `update-anonymous` returns 403 when no bearer token is sent.

## How to get to it (user POV)

- Sign in with `POST /api/auth/local` (`identifier` + `password`), then `PUT /api/users/<id>` with JSON.
- A consuming account page that updates the signed-in user by numeric id.

## Driving it with verify-strapi

Preconditions:

- Strapi is healthy at `http://127.0.0.1:<port>` from this run's `launch`.
- Two disposable users exist (see [Users register](./users-register.md)). Use numeric `user.id` from the register JSON, not `documentId`.
- An administrator has enabled `user.update` on the Authenticated role the same way [Users avatar](./users-avatar.md) enables `user.updateAvatar`: `PUT /users-permissions/roles/<authenticated-id>` with the full `permissions` object and `user.update.enabled` true. On a fresh database the PUT is 403 until that grant.

- **Before grant.** Run `verify-strapi http PUT /api/users/<owner-id> --header "Authorization: Bearer <owner-jwt>" --json '{"username":"renamed_live","blocked":true}'`. Status is `403`.
- **Grant.** Enable `user.update` without clearing other actions. PUT status is `200` and the body is `{"ok":true}`. That body is also what a wiping PUT returns. Re-read the role and require `user.update.enabled` and `user.me.enabled`, or rely on the owner PUT below returning `200` instead of `403`.
- **Owner update.** Repeat the owner PUT. Status is `200`. `username` is `renamed_live`. `blocked` is still `false`.
- **Read back.** Run `verify-strapi http GET /api/users/me --header "Authorization: Bearer <owner-jwt>"`. `username` is `renamed_live` and `blocked` is `false`.
- **Other user.** Run `verify-strapi http PUT /api/users/<owner-id> --header "Authorization: Bearer <other-jwt>" --json '{"username":"hijacked"}'`. Status is `403`. The owner's `GET /api/users/me` username is unchanged.
- **Anonymous.** Run `verify-strapi http PUT /api/users/<owner-id> --json '{"username":"anonymous"}'`. Status is `403`.
- **Proof.** Save the before-grant 403, the owner 200, `/api/users/me`, the other-user 403, the anonymous 403, and `manifest.json` under `proof/users-update/`. Redact JWTs.

## Gotchas

- The route is `PUT /api/users/:id`. `PUT /api/users/me` is not the update path (it is 403).
- `isOwnerOrAdmin` compares `authUser.id` to `Number.parseInt(id, 10)`. A `documentId` in the path does not match and is 403.
- Stripped keys are `provider`, `confirmed`, `blocked`, and `role` (`strapi-server.ts`). A 200 that echoes `blocked: true` means the strip did not run.
- The role PUT must include the existing `permissions` map at the top level of the body. Sending only the new action, or wrapping the body as `{ "data": ... }` or `{ "role": ... }`, omits that map. The response is still `{"ok":true}`, and grants such as `user.me` are gone.
- `verified-unreachable` applies only when the admin grant cannot be performed.
