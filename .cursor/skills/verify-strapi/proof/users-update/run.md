# users-update proof

## Checks

- PASS: before grant 403 (403)
- PASS: owner rename keeps blocked false (False)
- PASS: me after rename (renamed_live)
- PASS: other user 403 (403)
- PASS: username unchanged (renamed_live)
- PASS: anonymous 403 (403)
- PASS: PUT /api/users/me is 403 (403)
