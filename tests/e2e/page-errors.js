// Init script (`e2e.config.mts` `initScripts`): records page failures in sessionStorage, so they
// survive navigations until `fixtures.ts` reads them after the test. It records `console.error`,
// uncaught errors and rejections, same-origin assets that fail to load or answer 4xx/5xx, and CSP
// violations. Cross-origin requests are ignored: tests block third parties on purpose.
(() => {
	const key = '__e2ePageErrors';
	const isSameOrigin = (url) => {
		try {
			return new URL(url, location.href).origin === location.origin;
		} catch {
			return false;
		}
	};
	const record = (message) => {
		try {
			const list = JSON.parse(sessionStorage.getItem(key) ?? '[]');
			list.push(`${message} (${location.pathname})`);
			sessionStorage.setItem(key, JSON.stringify(list));
		} catch {
			// Storage is unavailable on opaque origins such as about:blank.
		}
	};
	const original = console.error.bind(console);
	console.error = (...args) => {
		record(args.map(String).join(' '));
		original(...args);
	};
	addEventListener(
		'error',
		(event) => {
			if (event.target === window) {
				record(event.message);
				return;
			}
			const url = event.target.src ?? event.target.href;
			if (url && isSameOrigin(url)) record(`resource failed: ${url}`);
		},
		true,
	);
	addEventListener('unhandledrejection', (event) => record(String(event.reason)));
	addEventListener('securitypolicyviolation', (event) =>
		record(`CSP ${event.violatedDirective}: ${event.blockedURI}`),
	);
	const recordStatuses = (entries) => {
		for (const entry of entries) {
			if (entry.responseStatus >= 400 && isSameOrigin(entry.name)) {
				record(`status ${entry.responseStatus}: ${entry.name}`);
			}
		}
	};
	const observer = new PerformanceObserver((list) => recordStatuses(list.getEntries()));
	observer.observe({ type: 'resource', buffered: true });
	// Observer callbacks are queued; `fixtures.ts` flushes them before it reads the list.
	window.__e2eFlushPageErrors = () => recordStatuses(observer.takeRecords());
})();
