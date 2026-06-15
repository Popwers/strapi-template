# Plan 003: Harden the backup cron — streamed uploads, non-blocking exports, encrypted archives, configurable enablement

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 262c1cc..HEAD -- src/index.ts .env.example package.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (independent of plans 001/002; if plan 002 ran first, re-read `src/index.ts` — codemods may have touched imports)
- **Category**: security / perf / bug
- **Planned at**: commit `262c1cc`, 2026-06-12

## Why this matters

The backup cron in `src/index.ts` has four real problems. (1) `fs.readFileSync` loads both backup archives fully into memory before upload — on a grown database this is an OOM crash inside the production process. (2) `execSync` for `strapi export` blocks the Node event loop for up to 5 minutes; every HTTP request to the CMS stalls while the export runs. (3) The Strapi archive is exported with `--no-encrypt` and uploaded to S3 in cleartext — it contains the full database content including user PII and hashed credentials. (4) The cron is gated on `NODE_ENV === 'development'`, which makes it impossible to test in any non-prod environment and silently enables it everywhere else, even when S3 vars are placeholders. This plan fixes all four plus two minor issues (per-run `S3Client` construction, hardcoded company-name file prefix).

## Current state

- `src/index.ts` (155 lines) — the whole backup cron lives in `bootstrap()`. Key excerpts at `262c1cc`:

```ts
// src/index.ts:1-2
import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
```

```ts
// src/index.ts:33-39
task: async ({ strapi }) => {
    // Disable on dev mode
    if (process.env.NODE_ENV === 'development') return;

    const EXPORT_FILE_NAME = `name-of-your-company-strapi-backup-${Date.now()}`;
```

```ts
// src/index.ts:97-108
// Export Strapi data
strapi.log.info('Exporting Strapi data...');

execSync(`strapi export --no-encrypt -f ${EXPORT_FILE_NAME}`, {
    stdio: 'inherit',
    timeout: 300000,
});

// Upload both files to S3
strapi.log.info('Uploading backups to S3...');
const strapiBackup = fs.readFileSync(BACKUP_FILE);
const dbBackup = fs.readFileSync(DB_BACKUP_FILE);
```

- The `pg_dump` step (lines 76–95) already uses `execFileSync` with an argument array and `PGPASSWORD` via env — keep that argument-array pattern; only its sync-ness changes.
- `new S3Client(S3_CONFIG)` is constructed inside the task (line 69), every run.
- Error handling: try/catch with `strapi.log.error` + `sendError(strapi, error)` (Sentry helper in `src/sentry.ts`), `finally` block deletes both temp files. Keep this structure.
- `.env.example` has an `S3` section (S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET) and a `CRON_SCHEDULE` entry. No `BACKUP_*` vars yet.
- `package.json` deps include `@aws-sdk/client-s3` `^3.969.0`. It does NOT include `@aws-sdk/lib-storage` (needed for streamed multipart uploads).
- Repo conventions: tabs (width 4), single quotes, semicolons; comments in English explaining *why*; `vp check` must pass (a Stop hook enforces it).

## Commands you will need

| Purpose   | Command                                              | Expected on success |
|-----------|------------------------------------------------------|---------------------|
| Add dep   | `npm install @aws-sdk/lib-storage`                   | exit 0              |
| Typecheck | `./node_modules/.bin/tsc -p tsconfig.json --noEmit`  | exit 0              |
| Build     | `npm run build`                                      | exit 0              |
| Lint/fmt  | `vp check`                                           | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `src/index.ts`
- `.env.example` (add `BACKUP_ENABLED`, `BACKUP_FILE_PREFIX`, `BACKUP_ENCRYPTION_KEY` to the existing S3/backup section)
- `package.json` + `package-lock.json` (the `@aws-sdk/lib-storage` dependency only)
- `README.md` (the backup paragraph, if one exists — otherwise skip)

**Out of scope** (do NOT touch, even though they look related):
- `src/sentry.ts` — keep calling `sendError` as today.
- `Dockerfile` / `docker-compose.yml` — `postgresql-client` is already installed in the image.
- The `pg_dump` argument list (credentials handling is already correct).
- Backup retention/rotation on the S3 side — bucket lifecycle policy territory, not app code.

## Git workflow

- Branch: `fix/harden-backup-cron`
- One commit: `fix(backup): stream uploads, async exports, encrypted archive, BACKUP_ENABLED flag`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the streaming-upload dependency

`npm install @aws-sdk/lib-storage`

**Verify**: `grep '"@aws-sdk/lib-storage"' package.json` → one match; `npm run build` still exits 0.

### Step 2: Switch the enablement gate and externalize the file prefix

In `src/index.ts`, replace the dev-mode guard and hardcoded prefix:

```ts
task: async ({ strapi }) => {
    // Opt-in: the cron only runs when explicitly enabled, so dev/staging
    // environments and fresh template clones never attempt a backup.
    if (process.env.BACKUP_ENABLED !== 'true') return;

    const EXPORT_FILE_NAME = `${process.env.BACKUP_FILE_PREFIX || 'strapi-backup'}-${Date.now()}`;
```

Add to `.env.example` next to the S3 section (commented values, matching the file's existing style):

```
BACKUP_ENABLED=false
BACKUP_FILE_PREFIX=my-project-strapi-backup
BACKUP_ENCRYPTION_KEY=
```

**Verify**: `grep -n 'NODE_ENV' src/index.ts` → no match; `grep -n 'BACKUP_ENABLED' src/index.ts .env.example` → one match in each.

### Step 3: Make both child processes asynchronous

Replace the sync child-process calls with promisified `execFile` so the event loop is never blocked:

```ts
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
```

- `pg_dump`: same argument array and `env: { ...process.env, PGPASSWORD: ... }` as today, but `await execFileAsync('pg_dump', [...], { timeout: 300000 })`. Drop `stdio: 'inherit'` (not supported by promisified execFile); log stdout/stderr via `strapi.log` if non-empty.
- `strapi export`: replace the `execSync` string-interpolated command with an argument array pointing at the local binary, and encrypt when a key is provided:

```ts
const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY;
const exportArgs = ['export', '-f', EXPORT_FILE_NAME];
if (encryptionKey) {
    exportArgs.push('--key', encryptionKey);
} else {
    // Cleartext archive: only acceptable if the bucket itself is private + encrypted at rest.
    strapi.log.warn('BACKUP_ENCRYPTION_KEY not set — exporting unencrypted archive');
    exportArgs.push('--no-encrypt');
}
await execFileAsync('node_modules/.bin/strapi', exportArgs, { timeout: 300000 });
```

IMPORTANT: an encrypted Strapi export is written as `<name>.tar.gz.enc`, not `.tar.gz`. Derive the upload filename accordingly:

```ts
const BACKUP_FILE = encryptionKey ? `${EXPORT_FILE_NAME}.tar.gz.enc` : `${EXPORT_FILE_NAME}.tar.gz`;
```

(`BACKUP_FILE` is currently computed at line 38 before the key check — move/derive it after `encryptionKey` is read, and make sure the `finally` cleanup uses the same derived name.)

**Verify**: `grep -n 'execSync\|execFileSync' src/index.ts` → no matches; `./node_modules/.bin/tsc -p tsconfig.json --noEmit` → exit 0.

### Step 4: Stream the uploads instead of buffering

Replace the two `fs.readFileSync` + `PutObjectCommand` uploads with `Upload` from `@aws-sdk/lib-storage` fed by `fs.createReadStream` (multipart, constant memory):

```ts
import { Upload } from '@aws-sdk/lib-storage';

const uploadToS3 = (key: string, filePath: string, contentType: string) =>
    new Upload({
        client: s3Client,
        params: {
            Bucket: process.env.S3_BUCKET,
            Key: key,
            Body: fs.createReadStream(filePath),
            ContentType: contentType,
        },
    }).done();

await Promise.all([
    uploadToS3(BACKUP_FILE, BACKUP_FILE, 'application/gzip'),
    uploadToS3(DB_BACKUP_FILE, DB_BACKUP_FILE, 'application/sql'),
]);
```

Remove the now-unused `PutObjectCommand` import (keep `S3Client`).

**Verify**: `grep -n 'readFileSync\|PutObjectCommand' src/index.ts` → no matches; `tsc --noEmit` → exit 0.

### Step 5: Hoist the S3 client out of the task

Construct `s3Client` once per cron run is wasteful but harmless; the real fix is constructing it lazily once. Move the env-var validation loop and client construction so the client is created on first successful validation and cached in a module-level `let s3Client: S3Client | undefined`. Keep the validation inside the task (env vars may legitimately be absent until the operator configures them — the task must keep throwing the clear "Missing required environment variable" error).

**Verify**: `grep -c 'new S3Client' src/index.ts` → 1; the construction is guarded so it runs at most once across runs.

### Step 6: Final gates

**Verify**: `vp check` → exit 0; `npm run build` → exit 0.

## Test plan

The cron body is I/O-bound glue around external binaries — unit-testing it requires heavier seams than this plan introduces (full testability is deferred; plan 005 establishes the repo test baseline). Manual exercise instead:

1. With `BACKUP_ENABLED` unset: start `npm run dev` (DB required), confirm the log NEVER shows "Starting backup process".
2. With `BACKUP_ENABLED=true` but S3 vars empty: temporarily set `CRON_SCHEDULE='* * * * *'`, run dev, confirm within a minute the log shows `Backup failed: ... Missing required environment variable: S3_ENDPOINT` and the process keeps serving (no crash).
3. If no database is available in your environment, say so explicitly in the report rather than claiming these ran.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n 'execSync\|execFileSync\|readFileSync\|PutObjectCommand\|NODE_ENV\|name-of-your-company' src/index.ts` → zero matches
- [ ] `grep -n 'BACKUP_ENABLED\|BACKUP_FILE_PREFIX\|BACKUP_ENCRYPTION_KEY' .env.example` → three matches
- [ ] `./node_modules/.bin/tsc -p tsconfig.json --noEmit` exits 0
- [ ] `vp check` exits 0; `npm run build` exits 0
- [ ] `git status` shows only in-scope files modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `src/index.ts` no longer matches the excerpts (drift — plan 002's codemods may have rewritten imports).
- `strapi export --key` rejects the flag in the installed Strapi version (check `node_modules/.bin/strapi export --help`); report the actual flag name instead of guessing.
- `@aws-sdk/lib-storage` pulls a different major than `@aws-sdk/client-s3` (peer mismatch at install).
- The manual exercise in the test plan shows the cron firing when `BACKUP_ENABLED` is unset.

## Maintenance notes

- `BACKUP_ENCRYPTION_KEY` is a secret: it must live in the deployment env, never in committed files. Restoring an encrypted export requires the same key (`strapi import --key`). Losing the key = losing the backups; the operator must store it in a password manager.
- If S3-side retention is added later (lifecycle rules), the `Date.now()` filename suffix is what makes objects unique — don't remove it.
- Reviewer should scrutinize: the derived `.tar.gz.enc` filename actually matching what `strapi export` writes (run it once to confirm), and the `finally` cleanup deleting the derived name, not the old constant.
