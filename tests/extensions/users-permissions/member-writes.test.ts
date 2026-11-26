import { describe, expect, test } from 'bun:test';

import {
	type DocumentObject,
	memberOf,
	type ModelLookup,
	pointsAtOtherUser,
	returnsOtherUser,
	type SchemaModel,
} from '../../../src/extensions/users-permissions/member-writes';

/*
 * How the member write guard can go wrong (the template ships no content type, so the models
 * below stand in for the contact and company types a project adds):
 * - a member re-points the owner relation of their own record to another account, by id, by
 *   documentId, through `connect`/`set`, or inside a component or dynamic zone;
 * - a relation input shape the guard does not know slips through instead of being refused;
 * - the member's own id or documentId, or clearing the relation, is refused;
 * - a `populate` reaches another account through a relation of a relation and is returned;
 * - the guard blocks the staff `admin` role, the admin panel or an API token, which may set any
 *   owner.
 */

const USER_UID = 'plugin::users-permissions.user';
const MEMBER = { id: 7, documentId: 'member-doc' };
const OTHER = { id: 8, documentId: 'other-doc' };

const MODELS = new Map<string, SchemaModel>([
	[
		'api::contact.contact',
		{
			attributes: {
				name: { type: 'string' },
				owner: { type: 'relation', target: USER_UID },
				company: { type: 'relation', target: 'api::company.company' },
				address: { type: 'component', component: 'shared.address' },
				blocks: { type: 'dynamiczone' },
			},
		},
	],
	[
		'api::company.company',
		{ attributes: { name: { type: 'string' }, members: { type: 'relation', target: USER_UID } } },
	],
	[
		'shared.address',
		{ attributes: { city: { type: 'string' }, resident: { type: 'relation', target: USER_UID } } },
	],
	['shared.mention', { attributes: { who: { type: 'relation', target: USER_UID } } }],
]);

const getModel: ModelLookup = (uid) => MODELS.get(uid);

const writes = (data: DocumentObject): boolean =>
	pointsAtOtherUser(getModel, 'api::contact.contact', data, MEMBER);

const exposes = (entry: DocumentObject): boolean =>
	returnsOtherUser(getModel, 'api::contact.contact', entry, MEMBER);

describe('pointsAtOtherUser', () => {
	test('refuses another account by id, documentId, connect, set or disconnect', () => {
		expect(writes({ owner: OTHER.id })).toBe(true);
		expect(writes({ owner: OTHER.documentId })).toBe(true);
		expect(writes({ owner: { documentId: OTHER.documentId } })).toBe(true);
		expect(writes({ owner: { connect: [{ documentId: OTHER.documentId }] } })).toBe(true);
		expect(writes({ owner: { set: [OTHER.id] } })).toBe(true);
		expect(writes({ owner: { disconnect: [MEMBER.documentId], connect: [OTHER.documentId] } })).toBe(
			true,
		);
		expect(writes({ owner: [MEMBER.id, OTHER.id] })).toBe(true);
	});

	test('refuses another account inside a component or a dynamic zone', () => {
		expect(writes({ address: { city: 'Lyon', resident: OTHER.id } })).toBe(true);
		expect(
			writes({ blocks: [{ __component: 'shared.mention', who: { connect: [OTHER.documentId] } }] }),
		).toBe(true);
	});

	test('refuses a relation input it cannot read', () => {
		expect(writes({ owner: { email: 'other@e2e.test' } })).toBe(true);
		expect(writes({ owner: true })).toBe(true);
	});

	test('accepts the member themself, a cleared relation and fields that are not user relations', () => {
		expect(writes({ owner: MEMBER.id })).toBe(false);
		expect(writes({ owner: String(MEMBER.id) })).toBe(false);
		expect(
			writes({ owner: { connect: [{ documentId: MEMBER.documentId, position: { end: true } }] } }),
		).toBe(false);
		expect(writes({ owner: null })).toBe(false);
		expect(writes({ name: 'Renamed', company: 'any-company-doc' })).toBe(false);
	});
});

describe('returnsOtherUser', () => {
	test('flags another account reached through a populated relation of a relation', () => {
		expect(
			exposes({ name: 'c', company: { name: 'Acme', members: [{ id: MEMBER.id }, { id: OTHER.id }] } }),
		).toBe(true);
		expect(exposes({ owner: { id: OTHER.id, documentId: OTHER.documentId } })).toBe(true);
	});

	test('flags another account inside a populated component', () => {
		expect(exposes({ address: { city: 'Lyon', resident: { documentId: OTHER.documentId } } })).toBe(true);
	});

	test('lets the member read themself back', () => {
		expect(exposes({ owner: { id: MEMBER.id, documentId: MEMBER.documentId }, company: null })).toBe(
			false,
		);
		expect(exposes({ company: { name: 'Acme', members: [{ id: MEMBER.id }] } })).toBe(false);
	});
});

describe('memberOf', () => {
	const user = { id: MEMBER.id, documentId: MEMBER.documentId, role: { type: 'authenticated' } };

	test('returns the member of a users-permissions request', () => {
		expect(memberOf({ auth: { strategy: { name: 'users-permissions' } }, user })).toEqual(MEMBER);
	});

	test('leaves staff, the admin panel, API tokens and internal writes unguarded', () => {
		const staff = { ...user, role: { type: 'admin' } };
		expect(memberOf({ auth: { strategy: { name: 'users-permissions' } }, user: staff })).toBeUndefined();
		expect(memberOf({ auth: { strategy: { name: 'admin' } }, user })).toBeUndefined();
		expect(memberOf({ auth: { strategy: { name: 'api-token' } } })).toBeUndefined();
		expect(memberOf(undefined)).toBeUndefined();
	});
});
