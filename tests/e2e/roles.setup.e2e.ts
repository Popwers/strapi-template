import { test } from 'e2e';

import { configureRoles } from './roles';
import { ROLES } from './support';

// Runs once before every test that declares `{ session: ROLES }`: grants the API roles the suite
// relies on (the runner has no global setup). The saved session is empty; it only orders the run.
test.setup('configure the API roles', { sessions: [ROLES] }, async ({ app, session }) => {
	await configureRoles(app);
	await session.save(ROLES);
});
