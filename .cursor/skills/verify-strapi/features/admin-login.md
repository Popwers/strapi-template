# Admin login

Admin login lets an existing Super Admin sign in at `/admin`. A successful `POST /admin/login` returns `data.token`, and that bearer token reads the same admin from `GET /admin/users/me`.

## Sub-features

- `login-open` shows the login form once `hasAdmin` is true.
- `login-success` accepts the first administrator's email and password.
- `login-reject` rejects a wrong password with 400 and no token.
- `login-session` returns the same admin from `GET /admin/users/me` when the login bearer token is sent.

## How to get to it (user POV)

- Open `/admin` after the first administrator exists.
- Submit email and password on the Strapi login screen.
- Call `POST /admin/login` with `email` and `password`.

## Driving it with verify-strapi

Preconditions:

- Strapi is healthy at `http://127.0.0.1:<port>` from this run's `launch`.
- `GET /admin/init` JSON has `hasAdmin` true. If false, finish [Admin bootstrap](./admin-bootstrap.md) first.
- Credentials are the disposable `verify-admin@example.com` / `VerifyAdmin1!` created by this run.

- **Open login.** Open the admin SPA. Run `verify-strapi http GET /admin` and `verify-strapi screenshot --path proof/admin-login/login.png --url /admin`. The painted frame is the login screen (Email, Password, Login), not the welcome wizard.
- **Wrong password.** Attempt a bad login. Run `verify-strapi http POST /admin/login --json '{"email":"verify-admin@example.com","password":"WrongPass1!"}'`. Status is `400` and the body message is `Invalid credentials`.
- **Good login.** Sign in. Run `verify-strapi http POST /admin/login --json '{"email":"verify-admin@example.com","password":"VerifyAdmin1!"}'`. Status is `200`. JSON `data.token` is present (`data.accessToken` repeats it).
- **Session.** Run `verify-strapi http GET /admin/users/me --header "Authorization: Bearer <data.token>"`. Status is `200` and `data.email` is `verify-admin@example.com`.
- **Proof.** Save the rejected login status, the successful login JSON with the token redacted, `/admin/users/me`, and the login screenshot under `proof/admin-login/`.

## Gotchas

- Login is unreachable until bootstrap. Do not treat the welcome form as login.
- `GET /admin/users/me` accepts `Authorization: Bearer <data.token>`. The `strapi_admin_refresh` cookie alone is 401 on that route, so a cookie jar is not the session proof.
- `config/admin.ts` only sets session lifespans (30 days refresh, 24 hours session). It does not name the cookie.
- Headless Chrome without a French `Accept-Language` paints English (`Login`). `fr` is in `src/admin/app.tsx` locales; switch the locale before expecting `Se connecter`.
- Do not paste real operator passwords or tokens into proof files.
