# Admin bootstrap

Admin bootstrap is the first-run wizard that creates the only Super Admin on a fresh database, after which `/admin` shows the login screen instead of the welcome form.

## Sub-features

- `bootstrap-open` shows the welcome form while `hasAdmin` is false.
- `bootstrap-submit` creates the first administrator from the form or `POST /admin/register-admin`.
- `bootstrap-locked` refuses a second register-admin once `hasAdmin` is true.
- `bootstrap-init` exposes `hasAdmin` on `GET /admin/init`.

## How to get to it (user POV)

- Open `/admin` on a database that has never had an administrator.
- Submit first name, last name, email, password, and confirm password on the Strapi welcome screen (`Let's start`). Last name is optional on the form and in the API. The API body takes `email`, `password`, `firstname`, and an optional `lastname`.
- Call `POST /admin/register-admin` with the same fields (API equivalent of the form).

## Driving it with verify-strapi

Preconditions:

- Strapi is healthy at `http://127.0.0.1:<port>` from this run's `launch`.
- `GET /admin/init` JSON has `data.hasAdmin` equal to `false`.
- The email `verify-admin@example.com` does not already exist.

- **Init before.** Read bootstrap state. Run `verify-strapi http GET /admin/init`. Body JSON has `"hasAdmin":false` (or `hasAdmin` false under `data`).
- **Open wizard.** Open the admin SPA. Run `verify-strapi http GET /admin` and `verify-strapi screenshot --path proof/admin-bootstrap/wizard.png --url /admin`. The painted frame is the welcome / create-admin screen, not the login screen.
- **Submit first admin.** Create the administrator. Run `verify-strapi http POST /admin/register-admin --json '{"email":"verify-admin@example.com","password":"VerifyAdmin1!","firstname":"Verify","lastname":"Admin"}'`. Status is `200`. JSON has `data.token` (`data.accessToken` repeats it) and `data.user`, and the response sets the `strapi_admin_refresh` cookie. Redact the token and the cookie in proof.
- **Init after.** Re-read bootstrap state. Run `verify-strapi http GET /admin/init`. JSON now has `hasAdmin` true.
- **Second create fails.** Repeat the POST with a different email. Run `verify-strapi http POST /admin/register-admin --json '{"email":"second@example.com","password":"VerifyAdmin1!","firstname":"Second","lastname":"Admin"}'`. Status is `400` and `error.message` is `You cannot register a new super admin`.
- **Proof.** Save both `/admin/init` bodies, the register-admin status, and the wizard screenshot under `proof/admin-bootstrap/`. The second init read is required.

## Gotchas

- This mutation is one-shot per database. Re-proving it needs a new Postgres data dir (`cleanup` then `launch`).
- Do not reuse a leftover `/tmp/verify-strapi/pgdata` if you need `hasAdmin=false`.
- Password policy is at least 8 characters with one uppercase letter, one lowercase letter, and one digit (the wizard prints it under the field). `VerifyAdmin1!` meets it. `password` is `400` `ValidationError` with one message per missing class.
- The email must already be lowercase. `Verify-Admin@Example.com` is `400` `email must be a lowercase string` and creates nothing. Users register lowercases instead.
- A 200 on `/admin` alone does not prove bootstrap. Assert `hasAdmin` flipped.
- Never run this against a shared CMS that already has operators.
