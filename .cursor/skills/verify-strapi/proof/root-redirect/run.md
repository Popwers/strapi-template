# root-redirect proof

baseUrl: http://127.0.0.1:1341

## Actions

- GET / --no-follow -> status 302 location /admin
- GET /index.html --no-follow -> status 302 location /admin
- GET / (follow) -> status 200 final http://127.0.0.1:1341/admin
- GET /admin -> status 200 markers Strapi
- GET /_health --no-follow -> status 204

## Checks

- PASS: GET / is 302 (302)
- PASS: GET / Location /admin (/admin)
- PASS: GET /index.html is 302 (302)
- PASS: GET /index.html Location /admin (/admin)
- PASS: GET /_health is 204 (204)
- PASS: GET /_health is not redirected to /admin ()
- PASS: GET /admin is 200 (200)
- PASS: GET /admin contains Strapi (Strapi)
- PASS: admin.png captured (True)
