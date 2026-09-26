import { expect, test } from '@playwright/test';

test('favicon is gzip-compressed, so compression runs outside favicon', async ({ request }) => {
	const response = await request.get('/favicon.ico', { headers: { 'accept-encoding': 'gzip' } });

	expect(response.status()).toBe(200);
	expect(response.headers()['content-type']).toBe('image/x-icon');
	expect(response.headers()['content-encoding']).toBe('gzip');
});

test('the site root redirects to the admin panel', async ({ request }) => {
	const response = await request.get('/', { maxRedirects: 0 });

	expect(response.status()).toBe(302);
	expect(response.headers().location).toBe('/admin');
});
