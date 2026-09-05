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

/** Client register payload. `role` is the privilege-escalation claim we must drop. */
interface RegisterRequestBody {
	email: string;
	password: string;
	role?: unknown;
}

interface CreatedUser {
	id: number;
}

interface RegisterResponse {
	jwt: string;
	user: CreatedUser;
}

/** The slice of Koa ctx that `auth.register` and the create overrides read. */
interface RegisterContext {
	request: { body: RegisterRequestBody };
	body?: RegisterResponse | { message: string };
	status?: number;
	badRequest: (message: string) => void;
}

type RegisterHandler = (ctx: RegisterContext) => Promise<void>;

interface UserRoleUpdate {
	where: { id: number };
	data: { role: number };
}

/** Strapi 5 register with `allowedFields: []` — only these keys may appear. */
const REGISTER_ALWAYS_ALLOWED = ['username', 'password', 'email'] as const;

const isRegisterAllowedKey = (key: string): boolean =>
	(REGISTER_ALWAYS_ALLOWED as readonly string[]).includes(key);

/**
 * Mirror of Strapi 5.48 `auth.register` allowedFields check
 * (`packages/plugins/users-permissions/server/src/controllers/auth.js`).
 * Extra keys become `ValidationError: Invalid parameters: …` (HTTP 400).
 */
const strapiRegisterAllowedFieldsEmpty: RegisterHandler = async (ctx) => {
	const invalidKeys = Object.keys(ctx.request.body).filter((key) => !isRegisterAllowedKey(key));
	if (invalidKeys.length > 0) {
		ctx.badRequest(`Invalid parameters: ${invalidKeys.join(', ')}`);
		return;
	}
	ctx.body = { jwt: 'test-jwt', user: { id: 42 } };
};

const registerCtx = (body: RegisterRequestBody): RegisterContext => {
	const ctx: RegisterContext = {
		request: { body },
		badRequest: (message: string) => {
			ctx.status = 400;
			ctx.body = { message };
		},
	};
	return ctx;
};

/** The slice of the users-permissions plugin object the extension mutates. */
interface UsersPermissionsPlugin {
	controllers: {
		contentmanageruser: {
			create: (ctx: RegisterContext) => Promise<void>;
			update: () => Promise<void>;
		};
		user: {
			create: (ctx: RegisterContext) => Promise<void>;
			update: () => Promise<void>;
			me: () => Promise<void>;
		};
		auth: (opts?: { strapi?: unknown }) => { register: (ctx: RegisterContext) => Promise<void> };
	};
	policies: Record<string, Policy>;
	routes: { 'content-api': { routes: Route[] } };
}

const mockPlugin = (register: RegisterHandler = async () => {}): UsersPermissionsPlugin => ({
	controllers: {
		contentmanageruser: { create: async () => {}, update: async () => {} },
		user: { create: async () => {}, update: async () => {}, me: async () => {} },
		auth: () => ({ register }),
	},
	policies: {},
	routes: {
		'content-api': {
			routes: [{ method: 'PUT', path: '/users/:id', config: {} }],
		},
	},
});

const AUTHENTICATED_ROLE = { id: 1, type: 'authenticated' };
const roleUpdates: UserRoleUpdate[] = [];

// strapi-server only reads the `strapi` global once its exported factory is
// called (inside each test below), never at module-evaluation time, so it's
// safe to set this mock up after the static import above.
Object.assign(globalThis, {
	strapi: {
		query: () => ({
			findOne: async () => AUTHENTICATED_ROLE,
			update: async (args: UserRoleUpdate) => {
				roleUpdates.push(args);
				return args;
			},
		}),
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

describe('auth.register', () => {
	const clientPayload = (): RegisterRequestBody => ({
		email: 'new@example.com',
		password: 'secret-pass',
		role: 99,
	});

	const invokeRegister = async (register: RegisterHandler = strapiRegisterAllowedFieldsEmpty) => {
		roleUpdates.length = 0;
		const plugin = await extension(mockPlugin(register));
		const auth = plugin.controllers.auth({});
		const ctx = registerCtx(clientPayload());
		await auth.register(ctx);
		return ctx;
	};

	test('succeeds when allowedFields is empty (no role in the body)', async () => {
		const ctx = await invokeRegister();
		expect(ctx.status).not.toBe(400);
		expect(ctx.body).toEqual({ jwt: 'test-jwt', user: { id: 42 } });
	});

	test('sanitized register body has no role (client cannot escalate)', async () => {
		let seen: Record<string, unknown> | undefined;
		await invokeRegister(async (ctx) => {
			seen = { ...ctx.request.body };
			await strapiRegisterAllowedFieldsEmpty(ctx);
		});
		expect(seen).toBeDefined();
		expect(seen).not.toHaveProperty('role');
		expect(seen?.email).toBe('new@example.com');
		expect(seen?.password).toBe('secret-pass');
		expect(seen?.username).toMatch(/^username_[0-9a-f]{12}$/);
	});

	test('does not follow register with a second role write', async () => {
		await invokeRegister();
		expect(roleUpdates).toEqual([]);
	});

	test('does not persist the client-supplied role id', async () => {
		await invokeRegister();
		expect(roleUpdates.some((update) => update.data.role === 99)).toBe(false);
	});
});
