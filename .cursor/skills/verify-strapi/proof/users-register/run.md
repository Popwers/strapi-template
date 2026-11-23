# users-register run

Date: 2026-11-09. Isolated launch on 127.0.0.1:1341, fresh database, Public role defaults.
All checks in manifest.json passed. Tokens, JWTs and cookies are redacted.

2026-11-23 re-proof on a fresh database: the checks above passed again. Added `register-disabled.json`: with
`allow_register` turned off through `PUT /users-permissions/advanced`, a register of only `email` and
`password` is `400` `Register action is currently disabled`. The original settings were put back and
re-read (`allow_register` true).
