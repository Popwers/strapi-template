import { defineConfig } from 'vite-plus';

/**
 * Default Vite+ config.
 *
 * fmt:    tabs/4/110, LF, single quotes, semis, all-trailing commas, JSX
 *         bracket on same line, arrow parens always, deterministic import
 *         order, Tailwind sorted, package.json sorted.
 * lint:   curated oxlint rule set on top of `recommended`.
 * staged: run `vp check --fix` on staged files (install via `vp config`).
 */
export default defineConfig({
	fmt: {
		useTabs: true,
		tabWidth: 4,
		printWidth: 110,
		endOfLine: 'lf',
		singleQuote: true,
		jsxSingleQuote: true,
		vueIndentScriptAndStyle: true,
		arrowParens: 'always',
		bracketSpacing: true,
		bracketSameLine: true,
		semi: true,
		quoteProps: 'as-needed',
		trailingComma: 'all',
		embeddedLanguageFormatting: 'auto',
		htmlWhitespaceSensitivity: 'css',
		proseWrap: 'preserve',
		sortImports: {
			groups: [
				'builtin',
				'external',
				['internal', 'subpath'],
				['parent', 'sibling', 'index'],
				'style',
				'unknown',
			],
			internalPattern: ['~/', '@/', '#'],
			newlinesBetween: true,
			order: 'asc',
			ignoreCase: true,
			sortSideEffects: false,
		},
		sortTailwindcss: true,
		sortPackageJson: true,
		ignorePatterns: [
			'**/cache',
			'**/caches',
			'**/log',
			'**/logs',
			'**/tmp',
			'**/temp',
			'**/backup',
			'**/backups',
			'**/dump',
			'**/dumps',
			'**/.git',
			'**/.svn',
			'**/.hg',
			'**/.cache',
			'**/.next',
			'**/*.md',
			'**/node_modules',
			'**/var',
			'**/vendor',
			'**/public',
			'**/dist',
			'**/build',
			'**/.contentlayer',
			'**/package.json',
			'**/package-lock.json',
			'**/.yarn',
			'**/yarn.lock',
			'**/.yarn-integrity',
			'**/.pnp.*',
			'**/bun.lockb',
			'**/*.min.css',
			'**/*.min.js',
			'**/patches/**',
			'**/types/generated/**',
			'.agent/**',
			'.agents/**',
			'.claude/**',
			'.codex/**',
			'.continue/**',
			'.cursor/**',
			'.gemini/**',
			'.grepai/**',
			'.opencode/**',
			'.pi/**',
			'.roo/**',
			'.serena/**',
			'.windsurf/**',
			'tools/oxlint/anti-slop/**',
		],
	},

	lint: {
		ignorePatterns: [
			'dist/**',
			'.cache/**',
			'public/**',
			'node_modules/**',
			'**/*.esm.js',
			'**/types/generated/**',
			'.agent/**',
			'.agents/**',
			'.claude/**',
			'.codex/**',
			'.continue/**',
			'.cursor/**',
			'.gemini/**',
			'.grepai/**',
			'.opencode/**',
			'.pi/**',
			'.roo/**',
			'.serena/**',
			'.windsurf/**',
			'tools/oxlint/anti-slop/**',
		],
		// Vendored anti-slop plugin (tools/oxlint/anti-slop) — rejects low-evidence TS patterns.
		jsPlugins: [{ name: 'anti-slop', specifier: './tools/oxlint/anti-slop/index.ts' }],
		options: {
			typeAware: true,
			typeCheck: true,
		},
		// Curated overrides on top of oxlint `recommended`; keep the set tight.
		rules: {
			'no-param-reassign': 'error',
			'prefer-as-const': 'error',
			'no-else-return': 'error',
			'no-inferrable-types': 'error',
			'react/self-closing-comp': 'error',
			'prefer-number-properties': 'error',
			'no-explicit-any': 'error',
			'anti-slop/no-chained-type-assertions': 'error',
			'anti-slop/no-conditional-empty-object-spread': 'error',
			'anti-slop/no-known-value-widening': 'error',
			'anti-slop/no-module-mocking': 'error',
			'anti-slop/no-object-parameters': 'error',
			'anti-slop/no-reflect-apply': 'error',
			'anti-slop/no-reflect-get': 'error',
			// `typeof` narrowing is allowed only inside named type guards / assertion functions.
			'anti-slop/no-runtime-typeof': ['error', { allowInTypeGuards: true }],
			'anti-slop/no-shape-in-symbol-names': 'error',
			'anti-slop/no-unknown-parameters': 'error',
			'anti-slop/no-unknown-returns': 'error',
			'anti-slop/no-unknown-type-aliases': 'error',
			'anti-slop/no-unsafe-dictionary-type': 'error',
			'anti-slop/no-widen-then-assert': 'error',
			'anti-slop/require-safety-comment-for-type-assertion': 'error',
		},
	},

	// Run on staged files at commit time. Hook is installed once with `vp config`.
	staged: {
		'*.{js,jsx,ts,tsx,vue,svelte,astro,json,css,scss,html,md}': 'vp check --fix',
	},

	// Tests are authored against `bun:test`; alias it to `vitest` so the same
	// files also run under `vp test` (Vitest). `bun test` ignores this config.
	test: {
		alias: {
			'bun:test': 'vitest',
		},
	},
});
