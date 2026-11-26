import type { Core, UID } from '@strapi/strapi';
import { errors } from '@strapi/utils';

const USER_UID = 'plugin::users-permissions.user';

/** The users-permissions role `isOwnerOrAdmin` treats as staff: its writes are not restricted. */
const ADMIN_ROLE_TYPE = 'admin';

/** The member a content API write runs for, as the users-permissions strategy authenticated them. */
export interface Member {
	id: number;
	documentId: string;
}

/** A value of a Document Service `data` input or of a document it returns. */
export type DocumentValue = string | number | boolean | null | DocumentValue[] | DocumentObject;

export interface DocumentObject {
	[key: string]: DocumentValue;
}

/** The schema facts the guard reads: which attributes point at users, and where to recurse. */
export interface SchemaAttribute {
	type: string;
	target?: string;
	component?: string;
}

export interface SchemaModel {
	attributes: { [name: string]: SchemaAttribute };
}

export type ModelLookup = (uid: string) => SchemaModel | undefined;

/** Keys of a relation input that carry the related entries. `position` only orders them. */
const RELATION_INPUT_KEYS = ['connect', 'disconnect', 'set'];

function isDocumentObject(value: DocumentValue): value is DocumentObject {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNumber(value: DocumentValue): value is number {
	return typeof value === 'number';
}

function isString(value: DocumentValue): value is string {
	return typeof value === 'string';
}

function isOwnReference(reference: DocumentValue, member: Member): boolean {
	if (isNumber(reference)) return reference === member.id;
	if (isString(reference)) return reference === member.documentId || reference === String(member.id);
	if (!isDocumentObject(reference)) return false;
	if (reference.documentId !== undefined) return reference.documentId === member.documentId;
	if (reference.id !== undefined) return isOwnReference(reference.id, member);
	return false;
}

/**
 * The entries a relation input names: a bare id or documentId, `{ id }` or `{ documentId }`, a list
 * of those, or `{ connect, disconnect, set }`. Null clears the relation and names nobody.
 * @param value - The relation attribute's value in `data`.
 * @returns Every referenced entry, including the ones being disconnected.
 */
function relationReferences(value: DocumentValue): DocumentValue[] {
	if (value === null) return [];
	if (Array.isArray(value)) return value;
	if (!isDocumentObject(value)) return [value];
	const inputKeys = RELATION_INPUT_KEYS.filter((key) => value[key] !== undefined);
	if (inputKeys.length === 0) return [value];
	return inputKeys.flatMap((key) => relationReferences(value[key] ?? null));
}

function componentEntries(value: DocumentValue): DocumentObject[] {
	const entries = Array.isArray(value) ? value : [value];
	return entries.filter(isDocumentObject);
}

/**
 * Whether `data` points a user relation, at any depth of its components and dynamic zones, at an
 * account other than the member's own. A shape the guard cannot read counts as another account.
 * @param getModel - Resolves a content-type or component uid to its schema.
 * @param uid - The model `data` is written to.
 * @param data - The write's input.
 * @param member - The member the write runs for.
 * @returns True when the write must be refused.
 */
export function pointsAtOtherUser(
	getModel: ModelLookup,
	uid: string,
	data: DocumentObject,
	member: Member,
): boolean {
	const attributes = getModel(uid)?.attributes ?? {};
	return Object.entries(data).some(([name, value]) => {
		const attribute = attributes[name];
		if (attribute === undefined) return false;
		if (attribute.type === 'relation' && attribute.target === USER_UID) {
			return relationReferences(value).some((reference) => !isOwnReference(reference, member));
		}
		if (attribute.type === 'component' && attribute.component !== undefined) {
			const component = attribute.component;
			return componentEntries(value).some((entry) =>
				pointsAtOtherUser(getModel, component, entry, member),
			);
		}
		if (attribute.type === 'dynamiczone') {
			return componentEntries(value).some((entry) => {
				const component = entry.__component;
				return isString(component) && pointsAtOtherUser(getModel, component, entry, member);
			});
		}
		return false;
	});
}

/**
 * Whether a returned document carries, anywhere in what `populate` loaded, a user other than the
 * member. The written document itself is not checked: its ownership is the route policy's job.
 * @param getModel - Resolves a content-type or component uid to its schema.
 * @param uid - The model of `entry`.
 * @param entry - A document or component as the Document Service returned it.
 * @param member - The member the write runs for.
 * @returns True when the response would expose another account.
 */
export function returnsOtherUser(
	getModel: ModelLookup,
	uid: string,
	entry: DocumentObject,
	member: Member,
): boolean {
	const attributes = getModel(uid)?.attributes ?? {};
	return Object.entries(entry).some(([name, value]) => {
		const attribute = attributes[name];
		if (attribute === undefined || value === null || value === undefined) return false;
		const nested = componentEntries(value);
		if (attribute.type === 'relation' && attribute.target === USER_UID) {
			return nested.some((user) => !isOwnReference(user, member));
		}
		if (attribute.type === 'relation' && attribute.target !== undefined) {
			const target = attribute.target;
			return nested.some((related) => returnsOtherUser(getModel, target, related, member));
		}
		if (attribute.type === 'component' && attribute.component !== undefined) {
			const component = attribute.component;
			return nested.some((part) => returnsOtherUser(getModel, component, part, member));
		}
		if (attribute.type === 'dynamiczone') {
			return nested.some((part) => {
				const component = part.__component;
				return isString(component) && returnsOtherUser(getModel, component, part, member);
			});
		}
		return false;
	});
}

/** The parts of the Koa request state the users-permissions strategy fills in. */
interface RequestState {
	auth?: { strategy?: { name?: string } };
	user?: { id: number; documentId: string; role?: { type?: string } };
}

/**
 * The member behind the current request, when a users-permissions JWT authenticated it and its role
 * is not the staff `admin` type. Admin panel, API token and internal writes have no member.
 * @param state - `ctx.state` of the current request, if any.
 * @returns The member, or undefined when the write is not a member's.
 */
export function memberOf(state: RequestState | undefined): Member | undefined {
	if (state?.auth?.strategy?.name !== 'users-permissions') return undefined;
	const user = state.user;
	if (user === undefined || user.role?.type === ADMIN_ROLE_TYPE) return undefined;
	return { id: user.id, documentId: user.documentId };
}

/**
 * Refuses, with a 403, a member's create or update that points a relation to a users-permissions
 * user at another account, or whose `populate` would return another account. The write and the
 * response check run in one transaction, so a refused response also undoes the write. Every content
 * type a project adds is covered: this runs on the Document Service, under every controller.
 * @param strapi - The running Strapi instance.
 */
export function guardMemberWrites(strapi: Core.Strapi): void {
	const getModel: ModelLookup = (uid) => (isSchemaUid(strapi, uid) ? strapi.getModel(uid) : undefined);
	strapi.documents.use(async (context, next) => {
		if (context.action !== 'create' && context.action !== 'update') return next();
		const member = memberOf(strapi.requestContext.get()?.state);
		if (member === undefined) return next();
		const { data } = context.params;
		if (isDocumentInput(data) && pointsAtOtherUser(getModel, context.uid, data, member)) {
			throw new errors.ForbiddenError('A relation to another account cannot be set');
		}
		return strapi.db.transaction(async () => {
			const result = await next();
			if (isDocumentInput(result) && returnsOtherUser(getModel, context.uid, result, member)) {
				throw new errors.ForbiddenError('The response would include another account');
			}
			return result;
		});
	});
}

/**
 * Whether `uid` names a content type or a component of the running app.
 * @param strapi - The running Strapi instance.
 * @param uid - A uid read from a schema.
 * @returns True when `strapi.getModel` can resolve it.
 */
function isSchemaUid(strapi: Core.Strapi, uid: string): uid is UID.Schema {
	return uid in strapi.contentTypes || uid in strapi.components;
}

/**
 * Narrows the Document Service's generic `data` and result to a plain document.
 * @param value - The write's `data` or its result.
 * @returns True for a non-null, non-array object.
 */
function isDocumentInput<Value>(value: Value): value is Value & DocumentObject {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}
