/// <reference types="highlight.js" />

declare module '*.png' {
	const src: string;
	export default src;
}

/** Full language pack, loaded lazily by `highlightJs.ts`; same API as `highlight.js/lib/core`. */
declare module 'highlight.js/lib/index.js' {
	export = hljs;
}
