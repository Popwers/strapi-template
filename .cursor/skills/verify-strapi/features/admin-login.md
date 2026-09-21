# Admin login

Admin login lets an existing Super Admin sign in at `/admin` and reach the Content Manager home.

## Sub-features

- `login-open` shows the login form once `hasAdmin` is true.
- `login-success` accepts the first administrator's email and password.
- `login-reject` rejects a wrong password without creating a session.
- `login-session` keeps the admin home after a reload.

## How to get to it (user POV)

- Open `/admin` after the first administrator exists.
- Submit email and password on the Strapi login screen.
- Call `POST /admin/login` with `email` and `password`.

## Driving it with verify-strapi

Preconditions:

- Strapi is healthy at `http://127.0.0.1:<port>` from this run's `launch`.
- `GET /admin/init` JSON has `hasAdmin` true. If false, finish [Admin bootstrap](./admin-bootstrap.md) first.
- Credentials are the disposable `verify-admin@example.com` / `VerifyAdmin1!` created by this run.

- **Open login.** Open the admin SPA. Run `verify-strapi http GET /admin` and `verify-strapi screenshot --path proof/admin-login/login.png --url /admin`. The painted frame is the login screen (email + password), not the welcome wizard.
- **Wrong password.** Attempt a bad login. Run `verify-strapi http POST /admin/login --json '{"email":"verify-admin@example.com","password":"WrongPass1!"}'`. Status is `400` or `401`.
- **Good login.** Sign in. Run `verify-strapi http POST /admin/login --json '{"email":"verify-admin@example.com","password":"VerifyAdmin1!"}'`. Status is `200` and the JSON includes a token or session payload.
- **Home.** Use the returned cookie/JWT against `GET /admin/users/me` (or the session cookie on `/admin`). Status is `200` and the email is `verify-admin@example.com`.
- **Proof.** Save the rejected login status, the successful login JSON (redact the token in `run.md`), `/admin/users/me`, and the login screenshot under `proof/admin-login/`.

## Gotchas

- Login is unreachable until bootstrap. Do not treat the welcome form as login.
- Admin sessions in Strapi 5 use cookies plus refresh tokens (`config/admin.ts` session lifespans). A JSON token in the login body is not the only proof — hit `/admin/users/me`.
- Locales include `fr`. Labels may be French (`Se connecter`) or English depending on the browser `Accept-Language`.
- Do not paste real operator passwords into proof files.
