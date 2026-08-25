import { describe, expect, test } from 'bun:test';

import extension from '../../../src/extensions/users-permissions/strapi-server.js';

interface Route {
	method: string;
	path: string;
	config: { policies?: string[] };
}

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

/** The slice of the users-permissions plugin object the extension mutates. */
interface UsersPermissionsPlugin {
	controllers: {
		contentmanageruser: { create: () => Promise<void>; update: () => Promise<void> };
		user: { create: () => Promise<void>; update: () => Promise<void>; me: () => Promise<void> };
		auth: () => { register: () => Promise<void> };
	};
	policies: Record<string, Policy>;
	routes: { 'content-api': { routes: Route[] } };
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
});

// strapi-server only reads the `strapi` global once its exported factory is
// called (inside each test below), never at module-evaluation time, so it's
// safe to set this mock up after the static import above.
Object.assign(globalThis, {
	strapi: {
		query: () => ({ findOne: async () => ({ id: 1, type: 'authenticated' }) }),
		plugin: () => ({ service: () => ({}) }),
	},
});

describe('isOwnerOrAdmin policy', () => {
	const policyCtx = (user: AuthUser | null, id: string): PolicyContext => ({
		params: { id },
		state: { user },
	});

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
			(r: Route) => r.method === 'PUT' && r.path === '/users/:id',
		);
		expect(route?.config.policies).toEqual(['isOwnerOrAdmin']);
	});
});
