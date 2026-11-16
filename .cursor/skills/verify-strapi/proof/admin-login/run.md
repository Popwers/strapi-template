# admin-login proof

## Checks

- PASS: wrong password 400 (400)
- PASS: login 200 token (200)
- PASS: admin me email (verify-admin@example.com)
- PASS: login.png (bytes)
- PASS (2026-11-16): five wrong logins for one email are 400, the sixth is 429 RateLimitError; the operator email still logs in (rate-limit.json)
