import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import sentryPlugin from '@strapi/plugin-sentry/strapi-server';
import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import Koa from 'koa';

import pluginsConfig from '../config/plugins';
import {
	isKnownNoise,
	isKnownVisitorNoise,
	isRefusedRequestError,
	isRequestValidationError,
} from '../src/sentry-noise';

describe('isRefusedRequestError', () => {
	test.each(['UnauthorizedError', 'ForbiddenError', 'RateLimitError', 'PolicyError'])(
		'drops %s',
		(name) => {
			expect(isRefusedRequestError(name)).toBe(true);
		},
	);

	test.each([
		// A name that merely contains a refusal class is not one.
		'MyForbiddenError',
		'UnauthorizedErrors',
		'ForbiddenErrorHandler',
		// Same wording, other case.
		'forbiddenerror',
		// A server-side Strapi error stays visible.
		'ApplicationError',
		'NotFoundError',
		'Error',
	])('keeps %s', (name) => {
		expect(isRefusedRequestError(name)).toBe(false);
	});

	test('keeps an event with no error name', () => {
		expect(isRefusedRequestError(undefined)).toBe(false);
	});
});

describe('isRequestValidationError', () => {
	const request = { url: 'https://cms.example.com/api/auth/local', method: 'POST' };

	test('drops a ValidationError carrying its request', () => {
		expect(isRequestValidationError('ValidationError', { request })).toBe(true);
	});

	test('keeps a ValidationError with no request, as a cron or a service raises it', () => {
		expect(isRequestValidationError('ValidationError', {})).toBe(false);
	});

	test('keeps another error carrying its request', () => {
		expect(isRequestValidationError('ApplicationError', { request })).toBe(false);
		expect(isRequestValidationError('YupValidationError', { request })).toBe(false);
		expect(isRequestValidationError('validationerror', { request })).toBe(false);
		expect(isRequestValidationError(undefined, { request })).toBe(false);
	});
});

describe('isKnownVisitorNoise', () => {
	test.each([
		['ApplicationError', 'Your account has been blocked by an administrator'],
		['ApplicationError', 'Email or Username are already taken'],
		['ApplicationError', 'Invalid credentials'],
		['ApplicationError', 'Already confirmed'],
		['BadRequestError', 'Malicious Path'],
	])('drops %s: %s', (name, message) => {
		expect(isKnownVisitorNoise(name, message)).toBe(true);
	});

	test.each([
		// A longer message that contains a known one is a different error.
		['ApplicationError', 'Invalid credentials for the payment provider'],
		['ApplicationError', 'Mailer: Invalid credentials'],
		['ApplicationError', 'Subscription already confirmed by the provider'],
		['ApplicationError', 'Email or Username are already taken by another tenant'],
		['ApplicationError', 'Your account has been blocked by an administrator and the sync stopped'],
		['BadRequestError', 'Malicious Path in the upload manifest'],
		// Same wording, other case or padded.
		['ApplicationError', 'invalid credentials'],
		['ApplicationError', 'Invalid credentials '],
		// A known message under another error class.
		['ValidationError', 'Invalid credentials'],
		['Error', 'Invalid credentials'],
		['Error', 'Malicious Path'],
		['ApplicationError', 'Malicious Path'],
		// Other Strapi errors of the same classes.
		['ApplicationError', 'Error sending confirmation email'],
		['BadRequestError', 'Invalid body'],
	])('keeps %s: %s', (name, message) => {
		expect(isKnownVisitorNoise(name, message)).toBe(false);
	});

	test('keeps an event with no name or no message', () => {
		expect(isKnownVisitorNoise(undefined, 'Invalid credentials')).toBe(false);
		expect(isKnownVisitorNoise('ApplicationError', undefined)).toBe(false);
	});
});

describe('isKnownNoise', () => {
	const request = { url: 'https://cms.example.com/api/articles', method: 'POST' };

	test('drops each family', () => {
		expect(isKnownNoise('ForbiddenError', 'Forbidden', {})).toBe(true);
		expect(isKnownNoise('ValidationError', 'title must be at least 3 characters', { request })).toBe(
			true,
		);
		expect(isKnownNoise('ApplicationError', 'Invalid credentials', {})).toBe(true);
	});

	test('keeps a ValidationError no request carries, even with a message the old filter matched', () => {
		expect(isKnownNoise('ValidationError', 'Invalid token', {})).toBe(false);
		expect(isKnownNoise('ValidationError', 'Invalid credentials', {})).toBe(false);
		expect(isKnownNoise('ValidationError', 'Invalid identifier or password', {})).toBe(false);
	});

	test('keeps an unrelated error, with or without a request', () => {
		expect(
			isKnownNoise('TypeError', "Cannot read properties of undefined (reading 'id')", { request }),
		).toBe(false);
		expect(isKnownNoise('Error', 'connect ECONNREFUSED 127.0.0.1:5432', {})).toBe(false);
		expect(isKnownNoise(undefined, undefined, {})).toBe(false);
	});
});

interface CapturedEvent {
	exception?: { values?: { type?: string; value?: string }[] };
	request?: { url?: string; method?: string };
	user?: { id?: number; email?: string };
	tags?: { context?: string };
}

type CapturedItem = [{ type: string }, CapturedEvent];

/** The wire shape of a Sentry envelope: its headers, then its items. */
type CapturedEnvelope = [{ event_id?: string }, CapturedItem[]];

interface TransportResponse {
	statusCode?: number;
}

interface StrapiStub {
	config: { get: () => SentryPluginConfig; info: { strapi: string } };
	log: { info: () => void; warn: () => void };
	server: { use: (middleware: Koa.Middleware) => void };
	plugin: () => { service: () => SentryService };
}

type SentryPlugin = ReturnType<typeof sentryPlugin>;
type SentryService = ReturnType<SentryPlugin['services']['sentry']>;

interface SentryPluginConfig {
	dsn: string;
	sendMetadata: boolean;
	init: ReturnType<typeof pluginsConfig>['sentry']['config']['init'] & {
		transport: () => {
			send: (envelope: CapturedEnvelope) => Promise<TransportResponse>;
			flush: () => Promise<boolean>;
		};
	};
}

const asStrapi = (stub: StrapiStub): Core.Strapi => {
	// SAFETY: the stub implements everything the Sentry plugin reaches for (`config.get`,
	// `config.info`, `log`, `server.use`, `plugin().service()`); a missing member throws a
	// TypeError, so a drift in the plugin fails the suite instead of passing silently.
	return stub as never;
};

const plugin = sentryPlugin();
const captured: CapturedItem[] = [];
const noRoute = (): never => {
	throw new Error('Unexpected route');
};
const routes = new Map<string, (ctx: Koa.Context) => never>();
let service: SentryService;
let server: Server;
let baseUrl = '';

const reportedErrors = (): CapturedEvent[] =>
	captured.filter(([header]) => header.type === 'event').map(([, event]) => event);

const env = Object.assign((_name: string, fallback?: string) => fallback, {
	int: (_name: string, fallback: number) => fallback,
	bool: (_name: string, fallback: boolean) => fallback,
});

const flush = async (): Promise<void> => {
	await service.getInstance()?.flush(2000);
};

const post = async (path: string): Promise<void> => {
	const response = await fetch(`${baseUrl}${path}`, { method: 'POST' });
	await response.text();
	await flush();
};

const raise = (path: string, handler: (ctx: Koa.Context) => never) => routes.set(path, handler);

beforeAll(async () => {
	// The same `init` the CMS runs in production, with a transport that records instead of sending.
	const { init } = pluginsConfig({ env }).sentry.config;
	const pluginConfig: SentryPluginConfig = {
		dsn: 'https://public@sentry.invalid/1',
		sendMetadata: true,
		init: {
			...init,
			transport: () => ({
				send: async (envelope) => {
					const [, items]: CapturedEnvelope = envelope;
					captured.push(...items);
					return {};
				},
				flush: async () => true,
			}),
		},
	};

	const app = new Koa();
	app.silent = true;
	const strapiStub: StrapiStub = {
		config: { get: () => pluginConfig, info: { strapi: 'test' } },
		log: { info: () => undefined, warn: () => undefined },
		server: { use: (middleware) => void app.use(middleware) },
		plugin: () => ({ service: () => service }),
	};
	service = plugin.services.sentry({ strapi: asStrapi(strapiStub) });
	// The plugin's bootstrap initializes Sentry and mounts its Koa error-capturing middleware.
	await plugin.bootstrap({ strapi: asStrapi(strapiStub) });

	app.use((ctx) => {
		(routes.get(ctx.path) ?? noRoute)(ctx);
	});

	server = app.listen(0, '127.0.0.1');
	await new Promise<void>((resolve) => server.once('listening', () => resolve()));
	// SAFETY: a TCP server listening on a port always reports an AddressInfo, never a pipe name.
	const { port } = server.address() as AddressInfo;
	baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
	await new Promise((resolve) => server.close(resolve));
	await service.getInstance()?.close(2000);
});

beforeEach(() => {
	captured.length = 0;
});

describe('Sentry plugin with the CMS beforeSend', () => {
	describe('noise thrown out of a request', () => {
		const noise: [string, () => never][] = [
			[
				'a ValidationError from bad input',
				() => throwIt(new errors.ValidationError('title must be at least 3 characters')),
			],
			[
				'a ValidationError from a failed login',
				() => throwIt(new errors.ValidationError('Invalid identifier or password')),
			],
			[
				'a ValidationError from a bad token',
				() => throwIt(new errors.ValidationError('Invalid token')),
			],
			['an UnauthorizedError', () => throwIt(new errors.UnauthorizedError())],
			['a ForbiddenError', () => throwIt(new errors.ForbiddenError())],
			['a RateLimitError', () => throwIt(new errors.RateLimitError())],
			['a PolicyError', () => throwIt(new errors.PolicyError())],
			[
				'a blocked account',
				() =>
					throwIt(new errors.ApplicationError('Your account has been blocked by an administrator')),
			],
			[
				'a taken email or username',
				() => throwIt(new errors.ApplicationError('Email or Username are already taken')),
			],
			[
				'an admin login with a wrong password',
				() => throwIt(new errors.ApplicationError('Invalid credentials')),
			],
			['an already confirmed address', () => throwIt(new errors.ApplicationError('Already confirmed'))],
		];

		test.each(noise)('drops %s', async (_label, thrower) => {
			raise('/noise', thrower);

			await post('/noise');

			expect(reportedErrors()).toEqual([]);
		});

		test('drops a path traversal', async () => {
			// `resolve-path`, behind `strapi::public`, raises it as a 400 `BadRequestError`.
			raise('/noise', (ctx) => ctx.throw(400, 'Malicious Path'));

			await post('/noise');

			expect(reportedErrors()).toEqual([]);
		});
	});

	describe('real bugs thrown out of a request', () => {
		const bugs: [string, () => never, string, string][] = [
			[
				'an ApplicationError from our own code',
				() => throwIt(new errors.ApplicationError('Payment provider rejected the charge')),
				'ApplicationError',
				'Payment provider rejected the charge',
			],
			[
				'an ApplicationError that only contains a known message',
				() => throwIt(new errors.ApplicationError('Invalid credentials for the payment provider')),
				'ApplicationError',
				'Invalid credentials for the payment provider',
			],
			[
				'a known message under another class',
				() => throwIt(new Error('Invalid credentials')),
				'Error',
				'Invalid credentials',
			],
			[
				'a TypeError',
				() => throwIt(new TypeError("Cannot read properties of undefined (reading 'id')")),
				'TypeError',
				"Cannot read properties of undefined (reading 'id')",
			],
			[
				'a NotFoundError',
				() => throwIt(new errors.NotFoundError('Document not found')),
				'NotFoundError',
				'Document not found',
			],
		];

		test.each(bugs)('reports %s, with its request', async (_label, thrower, type, value) => {
			raise('/bug', thrower);

			await post('/bug');

			const [event, ...rest] = reportedErrors();
			expect(rest).toEqual([]);
			expect(event?.exception?.values?.[0]).toMatchObject({ type, value });
			expect(event?.request).toMatchObject({ method: 'POST', url: `${baseUrl}/bug` });
		});

		test('reports the request method and path only, and the user id only', async () => {
			raise('/bug', (ctx) => {
				// What a body parser and an authenticated user leave on the request Sentry parses.
				Object.assign(ctx.request, {
					body: { password: 'hunter2', code: 'reset-code' },
					user: { id: 7, email: 'someone@example.com' },
				});
				return throwIt(new Error('Lost the database connection'));
			});

			const response = await fetch(`${baseUrl}/bug?confirmation=secret-token#fragment`, {
				method: 'POST',
				headers: { authorization: 'Bearer secret-jwt', cookie: 'strapi_up_refresh=secret-refresh' },
			});
			await response.text();
			await flush();

			const [event] = reportedErrors();
			expect(event?.exception?.values?.[0]).toMatchObject({ value: 'Lost the database connection' });
			expect(event?.request).toEqual({ method: 'POST', url: `${baseUrl}/bug` });
			expect(event?.user).toEqual({ id: 7 });
		});

		test('reports a BadRequestError that only contains Malicious Path', async () => {
			raise('/bug', (ctx) => ctx.throw(400, 'Malicious Path in the upload manifest'));

			await post('/bug');

			const [event] = reportedErrors();
			expect(event?.exception?.values?.[0]).toMatchObject({
				type: 'BadRequestError',
				value: 'Malicious Path in the upload manifest',
			});
		});
	});

	describe('errors our own code captures without a request', () => {
		test('reports a ValidationError, even with a message a request would drop', async () => {
			// Same call as `src/sentry.ts`, used by the backup cron and by services.
			service.sendError(new errors.ValidationError('Invalid token'), (scope) =>
				scope.setTag('context', 'backup upload failed'),
			);
			await flush();

			const [event] = reportedErrors();
			expect(event?.exception?.values?.[0]).toMatchObject({
				type: 'ValidationError',
				value: 'Invalid token',
			});
			expect(event?.tags?.context).toBe('backup upload failed');
			expect(event?.request).toBeUndefined();
		});

		test('still drops a refusal', async () => {
			service.sendError(new errors.ForbiddenError());
			await flush();

			expect(reportedErrors()).toEqual([]);
		});
	});
});

function throwIt(error: Error): never {
	throw error;
}
