# users-update proof

## Checks

- PASS: before grant 403 (403)
- PASS: owner rename keeps blocked false (False)
- PASS: me after rename (renamed_live)
- PASS: other user 403 (403)
- PASS: username unchanged (renamed_live)
- PASS: anonymous 403 (403)
- PASS: PUT /api/users/me is 403 (403)
- PASS (2026-11-16): content manager edit with `role` is 200 and the user stays Authenticated (cm-role-dropped.json)
- PASS (2026-11-16): a user registered while `default_role` was `admin` updates another user's username; `blocked` stays false (admin-role-put.json)
