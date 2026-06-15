# Plan 005: Establish the test baseline — first unit tests for the users-permissions extension

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 262c1cc..HEAD -- src/extensions/users-permissions/ package.json vite.config.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding — note
> that plan 004 *intentionally* rewrites `helper.ts`; if 004 is DONE, test
> the rewritten helper (its target shape is excerpted below), not the
> original.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/004-users-permissions-hardening.md (preferred order — tests then target the final helper; executable before it if needed, see drift note)
- **Category**: tests
- **Planned at**: commit `262c1cc`, 2026-06-12

## Why this matters

The repo has **zero tests** — `npm test` is a no-op shim (`test -d tests && bun test || echo 'no tests found...'`). The only custom logic in this template is the users-permissions extension (registration body sanitization, ownership policy, multipart file parsing), which is exactly the code a template consumer relies on without reading. This plan creates the `tests/` directory, wires the runner that the toolchain already supports, and covers the pure logic — establishing the pattern every future test in repos cloned from this template will follow.

## Current state

- No `tests/` directory exists.
- `package.json:11` — `"test": "test -d tests && bun test || echo 'no tests found, skipping'"`. The runtime convention is Bun for tests.
- `vite.config.ts` (repo root) — Vite+ config; it contains an alias mapping `bun:test` → `vitest`, so test files written against `bun:test` imports run under BOTH `bun test` and `vp test` (Vitest). Confirm the alias exists before relying on it: `grep -n "bun:test" vite.config.ts`.
- Code under test, `src/extensions/users-permissions/helper.ts`. At `262c1cc` it exports `parseFiles` and `generateUser` (lodash-based, `Math.random` username). **After plan 004** it has this shape instead (test THIS shape if 004 is DONE):

```ts
// helper.ts after plan 004
const toPathSegments = (key: string): string[] =>
	key.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);

const parseFiles = (files) => { /* same contract: keep only keys whose first
	segment is 'files' and that have ≥2 segments; result maps the remaining
	segments joined by '.' to the file value */ };

const generateUser = () => `username_${randomBytes(6).toString('hex')}`;
```

Contract of `parseFiles` (identical before/after plan 004 — black-box test it):
- `{ 'files.avatar': F }` → `{ avatar: F }`
- `{ 'files.docs.cv': F }` → `{ 'docs.cv': F }`
- `{ 'files[0]': F }` → `{ '0': F }`
- `{ avatar: F }` → `{}` (first segment not `files`)
- `{ files: F }` → `{}` (single segment)

Contract of `generateUser`: returns a string starting with `username_`; two consecutive calls differ. (Do NOT assert the exact suffix length unless plan 004 is DONE — the pre-004 `Math.random` suffix can be 1–8 chars; post-004 it is exactly 12 hex chars.)

- `sanitizeUser` and the `isOwnerOrAdmin` policy live as closures inside `src/extensions/users-permissions/strapi-server.ts` and depend on the global `strapi` — they are not importable in isolation. Testing them requires invoking the default export with a mock `plugin` object (shape: `{ controllers: { contentmanageruser: {...}, user: {...}, auth: fn }, policies: {}, routes: { 'content-api': { routes: [{ method: 'PUT', path: '/users/:id', config: {} }] } } }`) and a stubbed global `strapi`. Cover only the policy this way (smallest surface); leave controller-flow tests deferred.
- Repo conventions: tests live in root `tests/` mirroring `src/` (per repo rules), `.test.ts` suffix, Arrange-Act-Assert, one behavior per test.

## Commands you will need

| Purpose   | Command          | Expected on success                    |
|-----------|------------------|----------------------------------------|
| Tests     | `vp test`        | all tests pass, exit 0                 |
| Tests (bun path) | `npm test` | runs `bun test` (tests/ now exists), all pass |
| Lint/fmt  | `vp check`       | exit 0                                 |
| Typecheck | `./node_modules/.bin/tsc -p tsconfig.json --noEmit` | exit 0 |

## Scope

**In scope** (the only files you should create/modify):
- `tests/extensions/users-permissions/helper.test.ts` (create)
- `tests/extensions/users-permissions/strapi-server.test.ts` (create)
- `tsconfig.json` ONLY IF `tsc --noEmit` starts type-checking `tests/` and fails on test globals — in that case add `"tests"` to the existing `exclude` array, nothing else.

**Out of scope** (do NOT touch, even though they look related):
- Any file under `src/` — tests adapt to the code, never the reverse, in this plan.
- `package.json` scripts.
- Integration/e2e tests against a running Strapi — needs a database; deferred.

## Git workflow

- Branch: `test/users-permissions-baseline`
- One commit: `test(users-permissions): unit tests for helper and isOwnerOrAdmin policy`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write the helper tests

Create `tests/extensions/users-permissions/helper.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';

import { generateUser, parseFiles } from '../../../src/extensions/users-permissions/helper';

describe('parseFiles', () => {
	const file = { name: 'a.png' };

	test('maps files.avatar to avatar', () => {
		expect(parseFiles({ 'files.avatar': file })).toEqual({ avatar: file });
	});

	test('keeps nested segments joined with dots', () => {
		expect(parseFiles({ 'files.docs.cv': file })).toEqual({ 'docs.cv': file });
	});

	test('parses bracket indices', () => {
		expect(parseFiles({ 'files[0]': file })).toEqual({ '0': file });
	});

	test('drops keys not rooted at files', () => {
		expect(parseFiles({ avatar: file })).toEqual({});
	});

	test('drops single-segment keys', () => {
		expect(parseFiles({ files: file })).toEqual({});
	});
});

describe('generateUser', () => {
	test('prefixes with username_', () => {
		expect(generateUser()).toMatch(/^username_/);
	});

	test('returns different values across calls', () => {
		expect(generateUser()).not.toBe(generateUser());
	});
});
```

(If `helper.ts` has no type annotations on `parseFiles`' parameter, the import still type-checks — it is implicit `any`.)

**Verify**: `vp test` → 7 tests pass.

### Step 2: Write the policy test

Create `tests/extensions/users-permissions/strapi-server.test.ts`. Arrange a minimal mock plugin and a stubbed global `strapi` (the module references the `strapi` global at load/registration time via `plugin.controllers.auth({ strapi })` — provide it on `globalThis` before importing):

```ts
import { describe, expect, test } from 'bun:test';

const mockPlugin = () => ({
	controllers: {
		contentmanageruser: { create: async () => {}, update: async () => {} },
		user: { create: async () => {}, update: async () => {}, me: async () => {} },
		auth: () => ({ register: async () => {} }),
	},
	policies: {} as Record<string, (ctx: unknown) => boolean>,
	routes: {
		'content-api': {
			routes: [{ method: 'PUT', path: '/users/:id', config: {} as { policies?: string[] } }],
		},
	},
});

// strapi-server reads the `strapi` global when wiring controllers.
(globalThis as { strapi?: unknown }).strapi = {
	query: () => ({ findOne: async () => ({ id: 1, type: 'authenticated' }) }),
	plugin: () => ({ service: () => ({}) }),
};

const extension = (await import('../../../src/extensions/users-permissions/strapi-server')).default;

describe('isOwnerOrAdmin policy', () => {
	const policyCtx = (user: unknown, id: string) => ({ params: { id }, state: { user } });

	test('denies unauthenticated requests', async () => {
		const plugin = await extension(mockPlugin());
		expect(plugin.policies.isOwnerOrAdmin(policyCtx(null, '1'))).toBeFalsy();
	});

	test('allows the owner', async () => {
		const plugin = await extension(mockPlugin());
		const user = { id: 7, role: { type: 'authenticated' } };
		expect(plugin.policies.isOwnerOrAdmin(policyCtx(user, '7'))).toBe(true);
	});

	test('allows an admin-role user on another id', async () => {
		const plugin = await extension(mockPlugin());
		const user = { id: 1, role: { type: 'admin' } };
		expect(plugin.policies.isOwnerOrAdmin(policyCtx(user, '99'))).toBe(true);
	});

	test('denies a non-owner non-admin', async () => {
		const plugin = await extension(mockPlugin());
		const user = { id: 1, role: { type: 'authenticated' } };
		expect(plugin.policies.isOwnerOrAdmin(policyCtx(user, '99'))).toBeFalsy();
	});

	test('attaches the policy to PUT /users/:id', async () => {
		const plugin = await extension(mockPlugin());
		const route = plugin.routes['content-api'].routes.find(
			(r) => r.method === 'PUT' && r.path === '/users/:id',
		);
		expect(route?.config.policies).toEqual(['isOwnerOrAdmin']);
	});
});
```

Note for pre-plan-004 code: the unauthenticated case calls `ctx.unauthorized()` — add `unauthorized: () => undefined` to `policyCtx`'s return object so the call doesn't throw; `toBeFalsy()` covers both `undefined` (pre-004) and `false` (post-004).

**Verify**: `vp test` → 12 tests pass (7 + 5).

### Step 3: Confirm both runner paths and the gates

**Verify**:
- `npm test` → runs `bun test`, all pass (if `bun` is not installed in the environment, record that and rely on `vp test`).
- `vp check` → exit 0.
- `./node_modules/.bin/tsc -p tsconfig.json --noEmit` → exit 0 (apply the `exclude` fallback from Scope only if this fails on test files).

## Test plan

This plan IS the test plan. Coverage delivered: `parseFiles` (5 cases), `generateUser` (2 cases), `isOwnerOrAdmin` (4 cases) + route wiring (1 case).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `tests/extensions/users-permissions/helper.test.ts` and `strapi-server.test.ts` exist
- [ ] `vp test` exits 0 with 12 passing tests
- [ ] `npm test` no longer prints "no tests found, skipping"
- [ ] `vp check` exits 0; `tsc --noEmit` exits 0
- [ ] No files under `src/` modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Importing `strapi-server.ts` fails because the `strapi` global is read at import time (top-level) rather than call time — report the exact error; the mock strategy then needs an advisor decision.
- The `bun:test` → vitest alias is absent from `vite.config.ts` AND `bun` is not installed (no runner available).
- Making a test pass would require editing anything under `src/` — out of scope here; report which behavior mismatched.

## Maintenance notes

- These tests pin the `parseFiles` contract; plan 004's lodash removal must keep them green — run them in 004's verification if 004 executes later.
- The mock-plugin shape in `strapi-server.test.ts` mirrors users-permissions internals at Strapi 5.33–5.48; a future Strapi major may change controller wiring — if these tests break on an upgrade, suspect the extension itself first (the test is doing its job).
- Deferred: integration tests with a live database (registration flow end-to-end), controller-override flow tests (`sanitizeUser` path) — worth adding once a CI database service exists.
