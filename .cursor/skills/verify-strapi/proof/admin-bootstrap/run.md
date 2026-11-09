# admin-bootstrap run

Date: 2026-11-09. Fresh isolated launch on 127.0.0.1:1341. An earlier launch of the same run also showed `password` -> 400 ValidationError (uppercase, number) and `Verify-Admin@Example.com` -> 400 `email must be a lowercase string`; that database was discarded before this recipe.
All checks in manifest.json passed. Tokens, JWTs and cookies are redacted.
