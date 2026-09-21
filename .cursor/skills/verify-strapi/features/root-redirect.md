# Root redirect

Root redirect sends a visitor who opens the CMS origin or `/index.html` to the admin panel at `/admin`, which is the only public HTML surface this template ships.

## Sub-features

- `redirect-root` sends `GET /` to `/admin` without serving a marketing page.
- `redirect-index` sends `GET /index.html` to `/admin`.
- `admin-shell` serves the Strapi admin SPA at `/admin` after the redirect.
- `health-alongside` keeps `GET /_health` as 204 so probes are not redirected.

## How to get to it (user POV)

- Open `http://127.0.0.1:<port>/` in a browser.
- Open `http://127.0.0.1:<port>/index.html`.
- Follow a bookmark that points at the CMS origin with no path.

## Driving it with verify-strapi

Preconditions:

- Strapi is healthy at `http://127.0.0.1:<port>` from this run's `launch`.
- `verify-strapi doctor` reports the expected origin, `/_health` 204, and owned PIDs.

- **Root entry.** Request the origin without following redirects. Run `verify-strapi http GET / --no-follow`. Status is `302` and `location=/admin`.
- **Index entry.** Request the static index path without following redirects. Run `verify-strapi http GET /index.html --no-follow`. Status is `302` and `location=/admin`.
- **Followed landing.** Follow the redirect. Run `verify-strapi http GET /`. Final URL ends with `/admin` and the body contains `Strapi`.
- **Admin shell.** Open the admin path directly. Run `verify-strapi http GET /admin`. Status is `200` and the body contains `Strapi`.
- **Health stays put.** Probe health without following redirects. Run `verify-strapi http GET /_health --no-follow`. Status is `204` and there is no `Location: /admin`.
- **Painted frame.** Capture the admin chrome. Run `verify-strapi screenshot --path proof/root-redirect/admin.png --url /admin`. The PNG shows the Strapi welcome or login screen.
- **Proof.** Save unfollowed `/` headers, unfollowed `/index.html` headers, `/admin` excerpt, `/_health` status, the screenshot, and `manifest.json` under `proof/root-redirect/`. The artifacts show 302 `/admin` for both HTML entry points and 204 for health.

## Gotchas

- Following redirects on `GET /` yields 200 `/admin` and hides the 302. Always capture `--no-follow` for the redirect itself.
- `GET /_health` must remain 204. A redirect there would break the Docker healthcheck.
- Port `1337` on this machine is often a foreign Strapi. Doctor must match this run's state file.
- First boot compiles the admin SPA; `/admin` 200 with an empty body is a miss — require the `Strapi` marker.
