import { expect, secrets, unique } from 'e2e';

import { ADMIN, test } from './fixtures';
import { uniqueEmail } from './support';

// The core admin flow, driven by the agent so it survives Content Manager UI changes.
// Each goal is pinned on screen right after.
test(
	'an admin creates a user in the Content Manager',
	{ session: ADMIN, tags: ['agent'], timeout: 300_000 },
	async ({ app, agent, screen, browser, allowedPageErrors }) => {
		// The Content Manager asks the i18n plugin for AI localization jobs of this non-localized type.
		allowedPageErrors.push(/^status 404: \S+\/i18n\/ai-localization-jobs\//);
		const email = uniqueEmail();
		await app.open('/admin');
		await expect(screen.getByRole('heading', /Hello E2E/)).toBeVisible();

		await agent.act('open the Content Manager and go to the "User" collection');
		await expect(browser).toHaveURL(
			/\/content-manager\/collection-types\/plugin::users-permissions\.user/,
		);

		await agent.act(
			'create a new entry with the email {email} and the password {password}, then save it',
			{
				params: { email: unique(email), password: secrets.get('new-user-password') },
			},
		);
		// The save toast auto-dismisses; the created record's own page (document id in the URL) is the persistent proof.
		await expect(browser).toHaveURL(/\/plugin::users-permissions\.user\/[a-z0-9]+$/);
		await expect(screen.getByRole('textbox', 'email')).toHaveValue(email);
	},
);
