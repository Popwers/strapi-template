import { describe, expect, test } from 'bun:test';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';

import {
	HASHED_ASSET_CACHE_CONTROL,
	HASHED_ASSET_MAX_AGE_MS,
	HASHED_ASSET_MAX_AGE_SECONDS,
	LOCAL_UPLOAD_STATIC_OPTIONS,
	setHashedAssetCacheHeaders,
} from '../../config/asset-cache';

describe('hashed asset cache policy', () => {
	test('seconds and milliseconds describe the same one-year lifetime', () => {
		expect(HASHED_ASSET_MAX_AGE_SECONDS).toBe(31_536_000);
		expect(HASHED_ASSET_MAX_AGE_MS).toBe(HASHED_ASSET_MAX_AGE_SECONDS * 1000);
	});

	test('Cache-Control is public, one year, immutable', () => {
		expect(HASHED_ASSET_CACHE_CONTROL).toBe('public, max-age=31536000, immutable');
	});

	test('setHashedAssetCacheHeaders writes that Cache-Control value', () => {
		const res = new ServerResponse(new IncomingMessage(new Socket()));
		setHashedAssetCacheHeaders(res);
		expect(res.getHeader('Cache-Control')).toBe(HASHED_ASSET_CACHE_CONTROL);
	});

	test('local upload static options reuse the same policy', () => {
		expect(LOCAL_UPLOAD_STATIC_OPTIONS.maxage).toBe(HASHED_ASSET_MAX_AGE_MS);
		expect(LOCAL_UPLOAD_STATIC_OPTIONS.setHeaders).toBe(setHashedAssetCacheHeaders);
	});
});
