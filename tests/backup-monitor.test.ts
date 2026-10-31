import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';

import sentryPlugin from '@strapi/plugin-sentry/strapi-server';
import type { Core } from '@strapi/strapi';

import {
	BACKUP_MONITOR_SLUG,
	backupMonitorConfig,
	type CheckInClient,
	monitorBackup,
} from '../src/backup-monitor';

/*
 * How the heartbeat can fail the backup or lie about it:
 * - a successful run is not closed with `ok`, or the closing check-in has another id;
 * - a run with a failed step, or one that throws, reports `ok` (or nothing);
 * - a thrown run is swallowed instead of reaching the cron's own error report;
 * - Sentry being off, or `captureCheckIn` throwing, stops or changes the run;
 * - the in-progress check-in failing leaves the outcome unrecorded;
 * - a six-field rule is sent as a crontab Sentry rejects.
 */

interface CapturedCheckIn {
	check_in_id: string;
	monitor_slug: string;
	status: 'in_progress' | 'ok' | 'error';
	duration?: number;
	monitor_config?: { schedule: { type: string; value: string }; timezone?: string };
}

type CapturedItem = [{ type: string }, CapturedCheckIn];

type SentryService = ReturnType<ReturnType<typeof sentryPlugin>['services']['sentry']>;

const asStrapi = (stub: { config: { get: () => object }; log: { info: () => void } }): Core.Strapi => {
	// SAFETY: `init` only reads `config.get` and `log.info`; a missing member throws a TypeError, so
	// a drift in the plugin fails the suite instead of passing silently.
	return stub as never;
};

const captured: CapturedItem[] = [];
const MONITOR = backupMonitorConfig('0 */6 * * *', 'UTC');
let service: SentryService;
let sentry: CheckInClient;

const checkIns = async (): Promise<CapturedCheckIn[]> => {
	await service.getInstance()?.flush(2000);
	return captured.filter(([header]) => header.type === 'check_in').map(([, checkIn]) => checkIn);
};

const throwingClient: CheckInClient = {
	captureCheckIn: () => {
		throw new Error('Sentry transport exploded');
	},
};

beforeAll(() => {
	// The SDK the plugin initializes in production, with a transport that records instead of sending.
	const pluginConfig = {
		dsn: 'https://public@sentry.invalid/1',
		sendMetadata: true,
		init: {
			transport: () => ({
				send: async (envelope: [object, CapturedItem[]]) => {
					const [, items] = envelope;
					captured.push(...items);
					return {};
				},
				flush: async () => true,
			}),
		},
	};
	service = sentryPlugin().services.sentry({
		strapi: asStrapi({ config: { get: () => pluginConfig }, log: { info: () => undefined } }),
	});
	service.init();
	const instance: CheckInClient | null = service.getInstance();
	if (instance === null) throw new Error('Sentry did not initialize');
	sentry = instance;
});

afterAll(async () => {
	await service.getInstance()?.close(2000);
});

beforeEach(() => {
	captured.length = 0;
});

describe('monitorBackup', () => {
	test('opens a check-in and closes it with ok when every step uploaded', async () => {
		const isSuccessful = await monitorBackup(sentry, MONITOR, async () => true, rethrow);

		expect(isSuccessful).toBe(true);
		const [started, finished, ...rest] = await checkIns();
		expect(rest).toEqual([]);
		expect(started).toMatchObject({ monitor_slug: BACKUP_MONITOR_SLUG, status: 'in_progress' });
		expect(started?.monitor_config).toMatchObject({
			schedule: { type: 'crontab', value: '0 */6 * * *' },
			timezone: 'UTC',
		});
		expect(finished).toMatchObject({ status: 'ok', check_in_id: started?.check_in_id });
		expect(finished?.duration).toBeGreaterThanOrEqual(0);
	});

	test('closes with error when a step failed', async () => {
		const isSuccessful = await monitorBackup(sentry, MONITOR, async () => false, rethrow);

		expect(isSuccessful).toBe(false);
		const [started, finished] = await checkIns();
		expect(finished).toMatchObject({ status: 'error', check_in_id: started?.check_in_id });
	});

	test('closes with error and re-throws when the run throws', async () => {
		const run = monitorBackup(
			sentry,
			MONITOR,
			async () => {
				throw new Error('S3_ENDPOINT is missing');
			},
			rethrow,
		);

		const thrown = await run.then(
			() => undefined,
			(error: Error) => error,
		);
		expect(thrown?.message).toBe('S3_ENDPOINT is missing');
		const [started, finished] = await checkIns();
		expect(finished).toMatchObject({ status: 'error', check_in_id: started?.check_in_id });
	});

	test('still runs the backup when Sentry is off', async () => {
		let runs = 0;

		const isSuccessful = await monitorBackup(
			undefined,
			MONITOR,
			async () => {
				runs += 1;
				return true;
			},
			rethrow,
		);

		expect(isSuccessful).toBe(true);
		expect(runs).toBe(1);
		expect(await checkIns()).toEqual([]);
	});

	test('a check-in that throws never changes the backup', async () => {
		const failures: Error[] = [];
		let runs = 0;

		const isSuccessful = await monitorBackup(
			throwingClient,
			MONITOR,
			async () => {
				runs += 1;
				return true;
			},
			(error) => failures.push(error),
		);

		expect(isSuccessful).toBe(true);
		expect(runs).toBe(1);
		expect(failures.map((error) => error.message)).toEqual([
			'Sentry transport exploded',
			'Sentry transport exploded',
		]);
	});

	test('records the outcome without an id when the in-progress check-in failed', async () => {
		let calls = 0;
		const flaky: CheckInClient = {
			captureCheckIn: (checkIn, monitorConfig) => {
				calls += 1;
				if (calls === 1) throw new Error('Sentry transport exploded');
				return sentry.captureCheckIn(checkIn, monitorConfig);
			},
		};

		await monitorBackup(
			flaky,
			MONITOR,
			async () => false,
			() => undefined,
		);

		const [finished, ...rest] = await checkIns();
		expect(rest).toEqual([]);
		expect(finished).toMatchObject({ monitor_slug: BACKUP_MONITOR_SLUG, status: 'error' });
	});
});

describe('backupMonitorConfig', () => {
	test('sends a five-field rule as a crontab in the given timezone', () => {
		expect(backupMonitorConfig('30 2 * * *', 'Europe/Paris')).toMatchObject({
			schedule: { type: 'crontab', value: '30 2 * * *' },
			timezone: 'Europe/Paris',
			failure_issue_threshold: 1,
		});
	});

	test('sends no config for a six-field rule, which Sentry cannot read', () => {
		expect(backupMonitorConfig('*/10 * * * * *', 'UTC')).toBeUndefined();
	});
});

function rethrow(error: Error): never {
	throw error;
}
