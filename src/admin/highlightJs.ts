import hljs from 'highlight.js/lib/core';

/**
 * Stand-in for `highlight.js` in the admin build (see `vite.config.ts`).
 *
 * The package root registers ~190 languages up front, which put ~850 KB into the admin entry
 * chunk for a Markdown preview most sessions never open. The core ships now; the full language
 * pack registers onto the same core singleton once the browser is idle.
 */
setTimeout(() => void import('highlight.js/lib/index.js'), 0);

export const { getLanguage, highlight, highlightAuto } = hljs;

export default hljs;
