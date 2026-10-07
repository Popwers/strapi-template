import { expect, test } from 'e2e';

import { api } from './support';

test('favicon is gzip-compressed, so compression runs outside favicon', async ({ app }) => {
	const response = await api(app, '/favicon.ico', { headers: { 'accept-encoding': 'gzip' } });

	expect(response.status).toBe(200);
	expect(response.headers.get('content-type')).toBe('image/x-icon');
	expect(response.headers.get('content-encoding')).toBe('gzip');
});

test('the site root redirects to the admin panel', async ({ app }) => {
	const response = await api(app, '/', { redirect: 'manual' });

	expect(response.status).toBe(302);
	expect(response.headers.get('location')).toBe('/admin');
});
