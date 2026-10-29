/**
 * The request Sentry attaches to an event. `@strapi/plugin-sentry` fills it with Koa's
 * `parseRequest`: headers (`Authorization`), cookies, the body (passwords, reset codes) and the
 * query string (confirmation tokens). Only the method and the path survive the scrub.
 */
interface ScrubbableRequest {
	url?: string;
	method?: string;
}

/** An outgoing HTTP breadcrumb; its query can hold a signed URL's signature. */
interface ScrubbableBreadcrumb {
	data?: { url?: string; 'http.query'?: string; 'http.fragment'?: string };
}

/**
 * The slice of a Sentry event the scrub rewrites. A real Sentry `Event` satisfies it.
 */
export interface ScrubbableEvent {
	request?: ScrubbableRequest;
	user?: { id?: string | number };
	breadcrumbs?: ScrubbableBreadcrumb[];
}

/**
 * Drops the query string and fragment of a URL.
 * @param url - The URL Sentry recorded.
 * @returns The URL up to its path.
 */
const withoutQuery = (url: string | undefined): string | undefined => url?.split(/[?#]/, 1)[0];

/**
 * Removes the personal data Sentry would otherwise send: request headers, cookies, body and query
 * string, every user field but the id, and the query of breadcrumb URLs.
 * @param event - The event Sentry is about to send.
 * @returns The event with only the request method and path, and the user id.
 */
export const scrubEvent = <SentryEvent extends ScrubbableEvent>(event: SentryEvent): SentryEvent => ({
	...event,
	request: event.request && { method: event.request.method, url: withoutQuery(event.request.url) },
	user: event.user?.id === undefined ? undefined : { id: event.user.id },
	breadcrumbs: event.breadcrumbs?.map((breadcrumb) => ({
		...breadcrumb,
		data: breadcrumb.data && {
			...breadcrumb.data,
			url: withoutQuery(breadcrumb.data.url),
			'http.query': undefined,
			'http.fragment': undefined,
		},
	})),
});
