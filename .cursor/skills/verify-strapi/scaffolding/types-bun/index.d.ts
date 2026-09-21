/**
 * Minimal `bun:test` typings for verify-strapi launch.
 * The lockfile does not install `@types/bun`; `strapi develop` typechecks `tests/` anyway.
 */
declare module 'bun:test' {
	interface ExpectMatchers {
		toBe(expected: unknown): void;
		toEqual(expected: unknown): void;
		toBeGreaterThan(expected: number): void;
		toBeLessThan(expected: number): void;
		toBeGreaterThanOrEqual(expected: number): void;
		toBeLessThanOrEqual(expected: number): void;
		toBeTruthy(): void;
		toBeFalsy(): void;
		toBeNull(): void;
		toBeUndefined(): void;
		toBeDefined(): void;
		toContain(expected: unknown): void;
		toThrow(expected?: unknown): void;
		toMatch(expected: unknown): void;
		toHaveProperty(key: string): void;
		not: ExpectMatchers;
	}

	export function describe(name: string, fn: () => void): void;
	export function test(name: string, fn: () => void | Promise<void>): void;
	export function expect(actual: unknown): ExpectMatchers;
}
