import path from 'node:path';

import type { Alias, AliasOptions, UserConfig } from 'vite';

/** Exact `highlight.js` imports only; `highlight.js/styles/*` and `highlight.js/lib/*` resolve as usual. */
const HIGHLIGHT_JS_ALIAS: Alias = {
	find: /^highlight\.js$/,
	replacement: path.resolve(__dirname, 'highlightJs.ts'),
};

/**
 * Normalizes Vite's two alias shapes into the ordered list form.
 * @param alias - `resolve.alias` from the config Strapi resolved.
 */
function toAliasList(alias: AliasOptions | undefined): Alias[] {
	if (alias === undefined) return [];
	if (Array.isArray(alias)) return [...alias];
	return Object.entries(alias).map(([find, replacement]) => ({ find, replacement }));
}

/**
 * Admin panel Vite overrides, applied by `strapi build` on top of Strapi's own config.
 * Production only, so `strapi develop` keeps Strapi's dependency pre-bundling untouched.
 * @param config - The config Strapi resolved for this build.
 */
export default function adminViteConfig(config: UserConfig): UserConfig {
	if (config.mode !== 'production') return config;
	return {
		...config,
		resolve: {
			...config.resolve,
			alias: [HIGHLIGHT_JS_ALIAS, ...toAliasList(config.resolve?.alias)],
		},
	};
}
