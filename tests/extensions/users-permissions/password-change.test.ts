import { describe, expect, test } from 'bun:test';

import { isIssuedBeforePasswordChange } from '../../../src/extensions/users-permissions/password-change';

/*
 * How the revocation check can go wrong:
 * - a user who never changed their password gets every token refused;
 * - a token from before the change still passes;
 * - the token the reset returns, issued in the same second as the change, is refused (`iat` is in
 *   seconds, the change in milliseconds);
 * - the database hands the date back as a string and the comparison breaks.
 */

const CHANGED_AT = new Date('2026-10-29T10:00:00.750Z');
const CHANGED_AT_SECONDS = Math.floor(CHANGED_AT.getTime() / 1000);

describe('isIssuedBeforePasswordChange', () => {
	test('keeps every token of a user who never changed their password', () => {
		expect(isIssuedBeforePasswordChange(CHANGED_AT_SECONDS, null)).toBe(false);
		expect(isIssuedBeforePasswordChange(CHANGED_AT_SECONDS, undefined)).toBe(false);
	});

	test('refuses a token issued in an earlier second', () => {
		expect(isIssuedBeforePasswordChange(CHANGED_AT_SECONDS - 1, CHANGED_AT)).toBe(true);
		expect(isIssuedBeforePasswordChange(CHANGED_AT_SECONDS - 86_400, CHANGED_AT)).toBe(true);
	});

	test('keeps the token issued in the second of the change, as the reset returns it', () => {
		expect(isIssuedBeforePasswordChange(CHANGED_AT_SECONDS, CHANGED_AT)).toBe(false);
	});

	test('keeps a token issued after the change', () => {
		expect(isIssuedBeforePasswordChange(CHANGED_AT_SECONDS + 1, CHANGED_AT)).toBe(false);
	});

	test('reads a date the database returns as a string', () => {
		expect(isIssuedBeforePasswordChange(CHANGED_AT_SECONDS - 1, CHANGED_AT.toISOString())).toBe(true);
		expect(isIssuedBeforePasswordChange(CHANGED_AT_SECONDS, CHANGED_AT.toISOString())).toBe(false);
	});
});
