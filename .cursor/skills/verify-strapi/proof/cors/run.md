# cors run

Date: 2026-11-16. Isolated launch on 127.0.0.1:1341, CORS_ORIGINS unset in the app env, so the fallback http://localhost:4321 applies.
Second launch used `--cors-origins 'https://front.verify.test,https://admin.verify.test'` with `CORS_ORIGINS=https://evil.example` in the calling shell: both listed origins were echoed, the fallback and the shell value were not.
All checks in manifest.json passed. Header files keep the status line, `Vary` and `Access-Control-*` only.
