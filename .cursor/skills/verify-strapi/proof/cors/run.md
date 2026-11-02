# cors run

Date: 2026-11-03. Isolated launch on 127.0.0.1:1341, CORS_ORIGINS unset in the app env, so the fallback http://localhost:4321 applies.
Second launch ran with CORS_ORIGINS=https://evil.example in the calling shell; the app still allowed only http://localhost:4321.
All checks in manifest.json passed.
