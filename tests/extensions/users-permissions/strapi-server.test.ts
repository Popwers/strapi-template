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
