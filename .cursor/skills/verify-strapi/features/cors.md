# CORS

CORS decides which browser origins may call the API with credentials. Only the front-end origins listed in `CORS_ORIGINS` get an `Access-Control-Allow-Origin` header, so a page on any other site cannot read API responses.

## Sub-features

- `cors-allowed` echoes an allowed `Origin` in `Access-Control-Allow-Origin` with `Access-Control-Allow-Credentials: true`.
- `cors-foreign` sends no `Access-Control-Allow-Origin` for an origin outside the list.
- `cors-preflight` answers an allowed `OPTIONS` preflight with 204 and the allowed methods and headers.
- `cors-fallback` allows only `http://localhost:4321` when `CORS_ORIGINS` is unset.

## How to get to it (user POV)

- The paired front-end (for example the Astro front on `http://localhost:4321`) calling `/api/*` from the browser.
- Any other website trying the same call from a visitor's browser.

## Driving it with verify-strapi

Preconditions:

- Strapi is healthy at `http://127.0.0.1:<port>` from this run's `launch`. Launch unsets an inherited `CORS_ORIGINS`, so the fallback `http://localhost:4321` applies.

- **Allowed origin.** Run `verify-strapi http GET /_health --header 'Origin: http://localhost:4321' --out-headers <dir>/allowed.headers`. Headers include `Access-Control-Allow-Origin: http://localhost:4321` and `Access-Control-Allow-Credentials: true`.
- **Foreign origin.** Run the same with `--header 'Origin: https://evil.example'`. Headers have `Vary: Origin` and no `Access-Control-Allow-Origin`.
- **Allowed preflight.** Run `verify-strapi http OPTIONS /api/auth/local --header 'Origin: http://localhost:4321' --header 'Access-Control-Request-Method: POST' --out-headers <dir>/preflight.headers`. Status is `204` with `Access-Control-Allow-Methods` and `Access-Control-Allow-Headers` (`Content-Type,Authorization,Origin,Accept`).
- **Foreign preflight.** Same with `Origin: https://evil.example`. There is no `Access-Control-Allow-Origin`; the browser blocks the call.
- **Proof.** Save the header files and `manifest.json` under `proof/cors/`.

## Gotchas

- The status code does not prove CORS. `GET /api/users` is 403 for anonymous callers and still carries the allowed-origin headers. Read the headers.
- The foreign preflight answers 200, not an error. The proof is the missing `Access-Control-Allow-Origin`.
- curl and server-to-server calls send no `Origin` and are never blocked by CORS. Always send an `Origin` header.
- To prove a configured list, launch with that value in the app env only. A value exported in the calling shell is dropped by `launch` on purpose.
