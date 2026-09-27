import { defineConfig, devices } from '@playwright/test';

import { BASE_URL } from './support';

export default defineConfig({
	testDir: '.',
	testMatch: '**/*.e2e.ts',
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: 0,
	reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
	outputDir: 'test-results',
	globalSetup: './global-setup.ts',
	use: {
		baseURL: BASE_URL,
		locale: 'en-US',
		trace: 'retain-on-failure',
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command: 'bash start-server.sh',
		url: `${BASE_URL}/_health`,
		timeout: 240_000,
		reuseExistingServer: false,
		gracefulShutdown: { signal: 'SIGTERM', timeout: 15_000 },
		stdout: 'ignore',
		stderr: 'pipe',
	},
});
