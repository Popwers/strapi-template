import type { Core } from '@strapi/strapi';

const USER_UID = 'plugin::users-permissions.user';

/**
 * A decoded users-permissions token. Legacy JWTs (`jwtManagement: 'legacy-support'`, this
 * template's mode) carry the user `id` and `iat` in seconds. Refresh-mode access tokens carry no
 * `iat`: the session manager already revokes their sessions on a password change.
 */
interface TokenPayload {
	id?: number;
	iat?: number;
}

/** The users-permissions `jwt` service, as far as the revocation check uses it. */
interface JwtService {
	verify(token: string): Promise<TokenPayload>;
}

/**
 * Whether a token was issued before the user's last password change. `iat` has a one-second
 * resolution, so both sides are compared in whole seconds: the token the reset itself returns, issued
 * in the same second, stays valid. A token issued in that same second before the change does too.
 * @param issuedAt - The token's `iat`, in seconds.
 * @param passwordChangedAt - The user's `passwordChangedAt`, null until the first change.
 * @returns True when the token must be refused.
 */
export function isIssuedBeforePasswordChange(
	issuedAt: number,
	passwordChangedAt: Date | string | null | undefined,
): boolean {
	if (passwordChangedAt === null || passwordChangedAt === undefined) return false;
	return issuedAt < Math.floor(new Date(passwordChangedAt).getTime() / 1000);
}

/**
 * Stamps `passwordChangedAt` on every write that sets a password: reset, change, `PUT /users/:id`
 * and the admin Content Manager all update the user through the Document Service, so one middleware
 * covers them. Not a database lifecycle: the backup's Strapi export turns lifecycles off server-wide
 * while it runs, and a password changed then would leave the earlier tokens valid.
 * @param strapi - The running Strapi instance.
 */
export function stampPasswordChanges(strapi: Core.Strapi): void {
	strapi.documents.use(async (context, next) => {
		if (context.uid === USER_UID && context.action === 'update') {
			const { data } = context.params;
			if (isPasswordWrite(data)) data.passwordChangedAt = new Date();
		}
		return next();
	});
}

/** The fields of a user update the stamp reads and writes. */
interface PasswordWrite {
	password: string;
	passwordChangedAt?: Date;
}

/**
 * Whether a Document Service update sets a non-empty password. The generated content types are not
 * committed, so the user's `data` carries the generic content-type input and needs this check.
 * @param data - The update's `data`.
 * @returns True when the update sets a password.
 */
function isPasswordWrite<Data>(data: Data): data is Data & PasswordWrite {
	if (data === null || typeof data !== 'object' || !('password' in data)) return false;
	return typeof data.password === 'string' && data.password !== '';
}

/**
 * Wraps the users-permissions `jwt` service so `verify` refuses a token issued before the user's last
 * password change. The stock `getToken` calls `this.verify`, so the authentication strategy goes
 * through this check and answers 401.
 * @param strapi - The running Strapi instance.
 * @param service - The stock `jwt` service.
 * @returns The service with the revocation check in `verify`.
 */
export function revokeTokensOnPasswordChange<Service extends JwtService>(
	strapi: Core.Strapi,
	service: Service,
): Service {
	return {
		...service,
		async verify(token: string): Promise<TokenPayload> {
			const payload = await service.verify(token);
			if (payload.id === undefined || payload.iat === undefined) return payload;
			const user = await strapi.db
				.query(USER_UID)
				.findOne({ where: { id: payload.id }, select: ['passwordChangedAt'] });
			if (user && isIssuedBeforePasswordChange(payload.iat, user.passwordChangedAt)) {
				throw new Error('Invalid token.');
			}
			return payload;
		},
	};
}
