import type { Core } from '@strapi/strapi';

const USER_UID = 'plugin::users-permissions.user';

/** How long a code from `/auth/forgot-password` stays usable: the project standard's ceiling. */
export const RESET_CODE_LIFETIME_MS = 60 * 60 * 1000;

/**
 * Whether a reset code was issued too long ago to be used. A code with no issue time predates the
 * stamp (or was written outside `/auth/forgot-password`) and counts as expired.
 * @param requestedAt - The user's `resetPasswordRequestedAt`.
 * @param now - The current time, in milliseconds.
 * @returns True when `/auth/reset-password` must refuse the code.
 */
export function isResetCodeExpired(requestedAt: Date | string | null | undefined, now: number): boolean {
	if (requestedAt === null || requestedAt === undefined) return true;
	return now - new Date(requestedAt).getTime() > RESET_CODE_LIFETIME_MS;
}

/** The fields of a user update the stamp reads and writes. */
interface ResetCodeWrite {
	resetPasswordToken: string | null;
	resetPasswordRequestedAt?: Date | null;
}

/**
 * Stamps `resetPasswordRequestedAt` when a write gives the user a new reset code, and clears it with
 * the code. A write that leaves the stored code as it was stamps nothing, so it never extends an old
 * code. A Document Service middleware, like the password stamp: the backup's Strapi export turns
 * database lifecycles off while it runs.
 * @param strapi - The running Strapi instance.
 */
export function stampResetCodes(strapi: Core.Strapi): void {
	strapi.documents.use(async (context, next) => {
		if (context.uid !== USER_UID || context.action !== 'update') return next();
		const { data, documentId } = context.params;
		if (!isResetCodeWrite(data)) return next();
		if (data.resetPasswordToken === null) {
			data.resetPasswordRequestedAt = null;
			return next();
		}
		const stored = await strapi.db
			.query(USER_UID)
			.findOne({ where: { documentId }, select: ['resetPasswordToken'] });
		if (stored?.resetPasswordToken !== data.resetPasswordToken)
			data.resetPasswordRequestedAt = new Date();
		return next();
	});
}

/**
 * Whether a Document Service update sets or clears the reset code.
 * @param data - The update's `data`.
 * @returns True when `resetPasswordToken` is a non-empty string or null.
 */
function isResetCodeWrite<Data>(data: Data): data is Data & ResetCodeWrite {
	if (data === null || typeof data !== 'object' || !('resetPasswordToken' in data)) return false;
	const code = data.resetPasswordToken;
	return code === null || isResetCode(code);
}

/**
 * Whether a request or write carries a reset code at all.
 * @param value - `code` from a request body, or a written `resetPasswordToken`.
 * @returns True for a non-empty string.
 */
export function isResetCode<Value>(value: Value): value is Value & string {
	return typeof value === 'string' && value !== '';
}
