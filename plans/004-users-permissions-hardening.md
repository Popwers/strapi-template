# Plan 004: Harden the users-permissions extension — explicit policy returns, documented role coupling, helper cleanup

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 262c1cc..HEAD -- src/extensions/users-permissions/ config/plugins.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (do it before plan 005, which writes tests against the cleaned helper)
- **Category**: security / tech-debt
- **Planned at**: commit `262c1cc`, 2026-06-12

## Why this matters

Three issues in the users-permissions extension. (1) The `isOwnerOrAdmin` policy returns `ctx.unauthorized()` — which returns `undefined` — instead of `false`; the policy *happens* to deny (falsy), but it sets a response body that Strapi's policy engine then discards, and any future reader/copy-paster will believe `ctx.unauthorized()` is the deny mechanism. (2) `config/plugins.ts` sets `register.allowedFields: ['role']`, which on its own is a textbook privilege-escalation hole (clients could self-assign any role). It is currently neutralized by the `auth.register` override that rebuilds the body via `sanitizeUser` — but that coupling is invisible: deleting the extension file silently re-opens the hole. (3) `helper.ts` uses CommonJS `require('lodash')` — lodash is not a declared dependency (it resolves only via hoisting from Strapi's tree) — and generates usernames with `Math.random()`, which can collide. This plan makes the deny explicit, documents the coupling where it can't be missed, and removes the undeclared dependency.

## Current state

- `src/extensions/users-permissions/strapi-server.ts` (253 lines) — plugin override. The policy as written today:

```ts
// src/extensions/users-permissions/strapi-server.ts:183-196
plugin.policies.isOwnerOrAdmin = (ctx) => {
    const { id } = ctx.params;
    const authUser = ctx.state.user;

    if (!authUser) {
        return ctx.unauthorized();
    }

    if (ctx.state.user.role.type === 'admin' || ctx.state.user.id === Number.parseInt(id, 10)) {
        return true;
    }

    return false;
};
```

- `config/plugins.ts:2-10`:

```ts
'users-permissions': {
    config: {
        jwt: {
            expiresIn: '7d',
        },
        register: {
            allowedFields: ['role'],
        },
    },
},
```

- The neutralizing override — `sanitizeUser` rebuilds the body from scratch (only email/password are taken from the client; role is forced to the `authenticated` role):

```ts
// src/extensions/users-permissions/strapi-server.ts:234-250 (helper inside the same file)
const sanitizeUser = async (ctx) => {
    const username = generateUser();
    const defaultRole = await strapi.query('plugin::users-permissions.role').findOne({
        where: { type: 'authenticated' },
    });

    if (!defaultRole) return false;

    // Reset the body to avoid errors or hacks
    return {
        email: ctx.request.body.email,
        password: ctx.request.body.password,
        role: { disconnect: [], connect: [defaultRole] },
        username,
    };
};
```

`'role'` must stay in `allowedFields` because `sanitizeUser` injects a `role` field into the register body; removing it would make Strapi's register validation strip/reject the injected role. Do NOT remove it — document it.

- `src/extensions/users-permissions/helper.ts` (23 lines, full file):

```ts
const _ = require('lodash');

const parseFiles = (files) => {
	const parsed = Object.keys(files).reduce((acc, key) => {
		const fullPath = _.toPath(key);

		if (fullPath.length <= 1 || fullPath[0] !== 'files') {
			return acc;
		}

		const path = _.tail(fullPath);
		acc[path.join('.')] = files[key];
		return acc;
	}, {});
	return parsed;
};

const generateUser = () => {
	const randomString = Math.random().toString(36).substring(2, 10);
	return `username_${randomString}`;
};

export { generateUser, parseFiles };
```

`parseFiles` is called from `updateAvatar` (`strapi-server.ts:109`) with `ctx.request.files`, whose keys look like `files.avatar` (koa-body multipart). `_.toPath('files.avatar')` → `['files', 'avatar']`; `_.toPath('files[0]')` → `['files', '0']`.

- Repo conventions: tabs (width 4), single quotes, semicolons, English comments, JSDoc on exports, `vp check` must pass (enforced by a Stop hook). ESM imports everywhere else in `src/`.

## Commands you will need

| Purpose   | Command                                              | Expected on success |
|-----------|------------------------------------------------------|---------------------|
| Typecheck | `./node_modules/.bin/tsc -p tsconfig.json --noEmit`  | exit 0              |
| Build     | `npm run build`                                      | exit 0              |
| Lint/fmt  | `vp check`                                           | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `src/extensions/users-permissions/strapi-server.ts`
- `src/extensions/users-permissions/helper.ts`
- `config/plugins.ts` (comment only — no config value changes)

**Out of scope** (do NOT touch, even though they look related):
- The `allowedFields: ['role']` VALUE itself — required by the override, see above.
- The `updateAvatar` controller logic and its routes.
- `jwt.expiresIn` and any other plugin config values.

## Git workflow

- Branch: `fix/users-permissions-hardening`
- One commit: `fix(users-permissions): explicit policy returns, document role coupling, drop undeclared lodash`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Make the policy deny explicitly

In `strapi-server.ts:183-196`, change the unauthenticated branch to `return false;` (Strapi's policy engine converts a falsy policy result into the 403 response itself; calling `ctx.unauthorized()` here only sets a body that gets discarded). Keep the JSDoc, update it to state that the policy returns a boolean. Also simplify the duplicate `ctx.state.user` access to use the already-extracted `authUser`:

```ts
plugin.policies.isOwnerOrAdmin = (ctx) => {
	const { id } = ctx.params;
	const authUser = ctx.state.user;

	if (!authUser) return false;

	return authUser.role.type === 'admin' || authUser.id === Number.parseInt(id, 10);
};
```

**Verify**: `grep -n 'ctx.unauthorized' src/extensions/users-permissions/strapi-server.ts` → only the `updateAvatar` occurrence (line ~105) remains; `tsc --noEmit` → exit 0.

### Step 2: Document the allowedFields ↔ sanitizeUser coupling

In `config/plugins.ts`, add a comment directly above `allowedFields`:

```ts
register: {
	// SECURITY: 'role' is only safe here because src/extensions/users-permissions/
	// strapi-server.ts overrides auth.register and force-rebuilds the body via
	// sanitizeUser (client role values never reach the DB). If that extension is
	// removed, this line MUST be removed too — otherwise clients can self-assign roles.
	allowedFields: ['role'],
},
```

Add the mirror comment in `strapi-server.ts` directly above the `sanitizeUser` declaration (inside its existing JSDoc): note that it is the counterpart of `register.allowedFields: ['role']` in `config/plugins.ts`.

**Verify**: `grep -n 'SECURITY' config/plugins.ts` → one match.

### Step 3: Remove the undeclared lodash dependency

In `helper.ts`, drop `require('lodash')` and replace the two lodash calls with plain TypeScript. `_.toPath` + `_.tail` reduce to: split a multipart field name like `files.avatar` or `files[0]` into segments, require the first segment to be `files`, and join the rest. A faithful minimal implementation:

```ts
/**
 * Convert a lodash-style path string ('files.avatar', 'files[0]') into segments.
 */
const toPathSegments = (key: string): string[] =>
	key
		.replace(/\[(\d+)\]/g, '.$1')
		.split('.')
		.filter(Boolean);
```

Then `parseFiles` uses `toPathSegments(key)` and `fullPath.slice(1)` instead of `_.toPath` / `_.tail`. Keep the exported signature `parseFiles(files)` unchanged (it is consumed by `strapi-server.ts:109`).

Replace `generateUser` with a crypto-backed value:

```ts
import { randomBytes } from 'node:crypto';

/**
 * Generate a collision-resistant placeholder username for new accounts.
 */
const generateUser = () => `username_${randomBytes(6).toString('hex')}`;
```

**Verify**: `grep -n "require(\|Math.random" src/extensions/users-permissions/helper.ts` → no matches; `tsc --noEmit` → exit 0.

### Step 4: Final gates

**Verify**: `vp check` → exit 0; `npm run build` → exit 0.

## Test plan

Unit tests for the rewritten helper land in plan 005 (`tests/extensions/users-permissions/helper.test.ts` — cases: `files.avatar` parsed, `files[0]` parsed, non-`files` keys dropped, single-segment keys dropped, generated usernames match `/^username_[0-9a-f]{12}$/` and differ across calls). If plan 005 is already DONE when you execute this plan, update those tests in the same commit. Otherwise the gates in step 4 are the verification.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -rn "require('lodash')\|Math.random" src/extensions/` → no matches
- [ ] `grep -c 'ctx.unauthorized' src/extensions/users-permissions/strapi-server.ts` → 1 (the updateAvatar controller only)
- [ ] `grep -n 'SECURITY' config/plugins.ts` → one match above `allowedFields`
- [ ] `./node_modules/.bin/tsc -p tsconfig.json --noEmit` exits 0
- [ ] `vp check` exits 0; `npm run build` exits 0
- [ ] `git status` shows only the three in-scope files modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The files no longer match the excerpts (plan 002's upgrade may have codemodded the extension).
- `tsc` reveals that `ctx.request.files` keys are NOT plain strings of the `files.xxx` shape (i.e. the `toPathSegments` replacement is unfaithful) — report rather than widening the parser.
- You are tempted to change `allowedFields` itself — that is explicitly out of scope.

## Maintenance notes

- The `allowedFields: ['role']` ↔ `sanitizeUser` coupling is the most fragile contract in this template; the two comments added here are the guard. A reviewer of any future change to either file should check both.
- `username_` values are placeholders (the template treats email as the identifier); if usernames become user-facing later, replace the generator with a proper scheme.
- Deferred: rewriting `strapi-server.ts` types from `any`-ish `(ctx)` params to typed Koa contexts — cosmetic, churn not justified.
