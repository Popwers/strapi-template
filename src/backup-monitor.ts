/** Slug of the Sentry cron monitor the backup job checks in to (one Sentry project per app). */
export const BACKUP_MONITOR_SLUG = 'strapi-backup';

/** How the cron monitor is created or updated on each check-in (Sentry upserts it). */
export interface BackupMonitorConfig {
	schedule: { type: 'crontab'; value: string };
	/** Minutes Sentry waits past the expected time before it reports a missed run. */
	checkinMargin: number;
	/** Minutes a run may stay in progress before Sentry reports it timed out. */
	maxRuntime: number;
	timezone: string;
	failure_issue_threshold: number;
	recovery_threshold: number;
}

type BackupCheckIn =
	| { monitorSlug: string; status: 'in_progress' }
	| { monitorSlug: string; status: 'ok' | 'error'; checkInId: string; duration: number }
	| { monitorSlug: string; status: 'ok' | 'error' };

/** The slice of the Sentry SDK the heartbeat calls. `@sentry/node` satisfies it. */
export interface CheckInClient {
	captureCheckIn(checkIn: BackupCheckIn, monitorConfig?: BackupMonitorConfig): string;
}

/**
 * The monitor config for the backup cron rule. Sentry only reads five-field crontabs: a six-field
 * rule (seconds first, as the e2e suite uses) sends no config, so the monitor must be set up by hand.
 * @param schedule - The `CRON_SCHEDULE` rule the backup runs on.
 * @param timezone - The server's timezone, which `strapi.cron` schedules in.
 * @returns The config sent with each check-in, or undefined when Sentry cannot read the rule.
 */
export function backupMonitorConfig(schedule: string, timezone: string): BackupMonitorConfig | undefined {
	if (schedule.trim().split(/\s+/).length !== 5) return undefined;
	return {
		schedule: { type: 'crontab', value: schedule },
		checkinMargin: 15,
		// The dump and the export get five minutes each (`STEP_TIMEOUT_MS`), uploads included.
		maxRuntime: 30,
		timezone,
		// One failed or missed run is enough to alert: with a 3-day retention, three leave nothing.
		failure_issue_threshold: 1,
		recovery_threshold: 1,
	};
}

/**
 * Runs the backup between two Sentry cron check-ins: `in_progress` before, then `ok` or `error`.
 * A run that stops happening is reported as missed by Sentry. A check-in that throws is logged
 * through `onCheckInError` and never changes the outcome of the backup.
 * @param client - The Sentry SDK, or undefined when Sentry is off.
 * @param monitorConfig - The monitor config sent with the check-ins.
 * @param run - The backup run; resolves true when every step uploaded.
 * @param onCheckInError - Called when Sentry rejects a check-in.
 * @returns What `run` resolved; a thrown error is re-thrown after the `error` check-in.
 */
export async function monitorBackup(
	client: CheckInClient | undefined,
	monitorConfig: BackupMonitorConfig | undefined,
	run: () => Promise<boolean>,
	onCheckInError: (error: Error) => void,
): Promise<boolean> {
	const checkIn = (send: (sentry: CheckInClient) => string): string | undefined => {
		if (client === undefined) return undefined;
		try {
			return send(client);
		} catch (error) {
			onCheckInError(error instanceof Error ? error : new Error(String(error)));
			return undefined;
		}
	};
	const finish = (status: 'ok' | 'error', checkInId: string | undefined, startedAt: number): void => {
		const duration = (Date.now() - startedAt) / 1000;
		// Without the in-progress id, a standalone check-in still records the outcome.
		checkIn((sentry) =>
			checkInId === undefined
				? sentry.captureCheckIn({ monitorSlug: BACKUP_MONITOR_SLUG, status }, monitorConfig)
				: sentry.captureCheckIn(
						{ monitorSlug: BACKUP_MONITOR_SLUG, status, checkInId, duration },
						monitorConfig,
					),
		);
	};

	const startedAt = Date.now();
	const checkInId = checkIn((sentry) =>
		sentry.captureCheckIn({ monitorSlug: BACKUP_MONITOR_SLUG, status: 'in_progress' }, monitorConfig),
	);
	try {
		const isSuccessful = await run();
		finish(isSuccessful ? 'ok' : 'error', checkInId, startedAt);
		return isSuccessful;
	} catch (error) {
		finish('error', checkInId, startedAt);
		throw error;
	}
}
