import { describe, expect, test } from 'bun:test';

import { generateUser, parseFiles } from '../../../src/extensions/users-permissions/helper';

describe('parseFiles', () => {
	const file = { name: 'a.png' };

	test('maps files.avatar to avatar', () => {
		expect(parseFiles({ 'files.avatar': file })).toEqual({ avatar: file });
	});

	test('keeps nested segments joined with dots', () => {
		expect(parseFiles({ 'files.docs.cv': file })).toEqual({ 'docs.cv': file });
	});

	test('parses bracket indices', () => {
		expect(parseFiles({ 'files[0]': file })).toEqual({ '0': file });
	});

	test('drops keys not rooted at files', () => {
		expect(parseFiles({ avatar: file })).toEqual({});
	});

	test('drops single-segment keys', () => {
		expect(parseFiles({ files: file })).toEqual({});
	});
});

describe('generateUser', () => {
	test('matches the username_<12 hex> shape', () => {
		expect(generateUser()).toMatch(/^username_[0-9a-f]{12}$/);
	});

	test('returns different values across calls', () => {
		expect(generateUser()).not.toBe(generateUser());
	});
});
