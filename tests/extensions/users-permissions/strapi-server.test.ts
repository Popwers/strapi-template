import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

import extension from '../../../src/extensions/users-permissions/strapi-server.js';

/*
 * Failure modes covered:
 * - a user whose role is `admin` is refused when they update another user (the owner, anonymous and
 *   other-user cases go through the real API in tests/e2e/users.e2e.ts).
 */

/** The authenticated user `isOwnerOrAdmin` reads off `ctx.state.user`. */
interface AuthUser {
	id: number;
	role: { type: string };
}

/** The slice of a Koa context the `isOwnerOrAdmin` policy actually reads. */
interface PolicyContext {
	params: { id: string };
	state: { user: AuthUser | null };
}

type Policy = (ctx: PolicyContext) => boolean;

interface Route {
	method: string;
	path: string;
	config: { policies?: string[] };
}

/** The slice of the users-permissions plugin object the extension mutates. */
interface UsersPermissionsPlugin {
	controllers: {
		contentmanageruser: { create: () => Promise<void>; update: () => Promise<void> };
		user: { create: () => Promise<void>; update: () => Promise<void>; me: () => Promise<void> };
		auth: () => { register: () => Promise<void> };
	};
	policies: Record<string, Policy>;
	routes: { 'content-api': { routes: Route[] } };
	services: { jwt: () => { verify: (token: string) => Promise<{ id?: number; iat?: number }> } };
}

const mockPlugin = (): UsersPermissionsPlugin => ({
	controllers: {
		contentmanageruser: { create: async () => {}, update: async () => {} },
		user: { create: async () => {}, update: async () => {}, me: async () => {} },
		auth: () => ({ register: async () => {} }),
	},
	policies: {},
	routes: {
		'content-api': {
			routes: [{ method: 'PUT', path: '/users/:id', config: {} }],
		},
	},
	services: { jwt: () => ({ verify: async () => ({}) }) },
});

// strapi-server only reads the `strapi` global once its exported factory is called (inside each
// test below), never at module-evaluation time, so it's safe to set this up after the static import.
beforeAll(() => {
	Object.assign(globalThis, { strapi: {} });
});

afterAll(() => {
	Reflect.deleteProperty(globalThis, 'strapi');
});

describe('isOwnerOrAdmin policy', () => {
	test('allows an admin-role user on another id', async () => {
		const plugin = await extension(mockPlugin());
		const admin: AuthUser = { id: 1, role: { type: 'admin' } };
		expect(plugin.policies.isOwnerOrAdmin({ params: { id: '99' }, state: { user: admin } })).toBe(true);
	});
});
