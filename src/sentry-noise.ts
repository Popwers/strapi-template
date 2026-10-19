/**
 * The slice of a Sentry event the noise filter reads. A real Sentry `Event` satisfies it.
 */
export interface NoiseEvent {
	request?: { url?: string; method?: string };
}

/**
 * Error classes Strapi raises to refuse a request: missing or bad credentials, a permission
 * denial, throttling, a policy rejection. All are 4xx answers, never a server bug.
 */
const REFUSED_REQUEST_ERRORS: ReadonlySet<string> = new Set([
	'UnauthorizedError',
	'ForbiddenError',
	'RateLimitError',
	'PolicyError',
]);

/**
 * Whether an error class is one of the 4xx refusals Strapi raises on purpose.
 * @param name - The error name, from the original exception or the event.
 * @returns True when the event should be dropped.
 */
export const isRefusedRequestError = (name: string | undefined): boolean =>
	name !== undefined && REFUSED_REQUEST_ERRORS.has(name);

/**
 * Whether an event is a `ValidationError` answered to a visitor's request: bad client input, a
 * failed login, an expired token. Those are 400s, not bugs.
 *
 * `@strapi/plugin-sentry` captures an error thrown out of a Koa request and, with `sendMetadata`,
 * attaches the request to the event (`parseRequest`). `sendError` in `src/sentry.ts` forwards the
 * errors our own code caught (the backup cron, lifecycles, services) without a request, so a
 * `ValidationError` raised there still reaches Sentry.
 * @param name - The error name, from the original exception or the event.
 * @param event - The event Sentry is about to send.
 * @returns True when the event should be dropped.
 */
export const isRequestValidationError = (name: string | undefined, event: NoiseEvent): boolean =>
	name === 'ValidationError' && event.request !== undefined;

interface KnownNoise {
	name: string;
	message: string;
}

/**
 * Exact name and message pairs Strapi raises while answering a visitor:
 * - `Your account has been blocked by an administrator`, `Email or Username are already taken` and
 *   `Already confirmed`: users-permissions login, registration and confirmation e-mail.
 * - `Invalid credentials`: a wrong password on the admin login. Users-permissions in
 *   `jwtManagement: 'refresh'` mode raises the same text when the session manager cannot mint an
 *   access token; Strapi gives no way to tell the two apart by message.
 * - `Malicious Path`: `resolve-path`, behind `strapi::public`, rejecting a path traversal.
 */
const KNOWN_NOISE: readonly KnownNoise[] = [
	{ name: 'ApplicationError', message: 'Your account has been blocked by an administrator' },
	{ name: 'ApplicationError', message: 'Email or Username are already taken' },
	{ name: 'ApplicationError', message: 'Invalid credentials' },
	{ name: 'ApplicationError', message: 'Already confirmed' },
	{ name: 'BadRequestError', message: 'Malicious Path' },
];

/**
 * Whether an error is one of the exact answers Strapi gives a visitor (see `KNOWN_NOISE`). Both
 * the name and the whole message must match: a longer message that merely contains one of them is
 * kept.
 * @param name - The error name, from the original exception or the event.
 * @param message - The error message, from the original exception or the event.
 * @returns True when the event should be dropped.
 */
export const isKnownVisitorNoise = (name: string | undefined, message: string | undefined): boolean =>
	KNOWN_NOISE.some((noise) => noise.name === name && noise.message === message);

/**
 * Whether the event is noise the Sentry `beforeSend` filter must drop.
 * @param name - The error name, from the original exception or the event.
 * @param message - The error message, from the original exception or the event.
 * @param event - The event Sentry is about to send.
 * @returns True when the event should be dropped.
 */
export const isKnownNoise = (
	name: string | undefined,
	message: string | undefined,
	event: NoiseEvent,
): boolean =>
	isRefusedRequestError(name) ||
	isRequestValidationError(name, event) ||
	isKnownVisitorNoise(name, message);
