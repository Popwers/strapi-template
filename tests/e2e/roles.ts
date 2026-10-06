import { type App } from 'e2e';

import { ADMIN_EMAIL, ADMIN_PASSWORD, api, sendJson } from './support';

interface ActionPermission {
	enabled: boolean;
	policy: string;
}

interface PluginPermissions {
	controllers: { [controller: string]: { [action: string]: ActionPermission } };
}

interface RolePermissions {
	[plugin: string]: PluginPermissions;
}

interface RoleSummary {
	id: number;
	type: string;
}

interface RoleDetail {
	name: string;
	description: string;
	permissions: RolePermissions;
}

const USER_ACTIONS_TO_GRANT = ['update', 'updateAvatar'];

/**
 * Asserts an admin API call succeeded, so setup fails loudly instead of letting
 * tests fail later on a missing permission.
 * @param ok - Whether the response had a 2xx status.
 * @param step - What the call was doing, for the error message.
 */
function assertOk(ok: boolean, step: string): asserts ok {
	if (!ok) throw new Error(`E2E setup failed: ${step}`);
}

async function adminHeaders(app: App): Promise<{ authorization: string }> {
	const response = await sendJson(app, 'POST', '/admin/login', {
		email: ADMIN_EMAIL,
		password: ADMIN_PASSWORD,
	});
	assertOk(response.ok, `admin login returned ${response.status}`);
	const body: { data: { token: string } } = await response.json();
	return { authorization: `Bearer ${body.data.token}` };
}

async function listRoles(app: App, headers: { authorization: string }): Promise<RoleSummary[]> {
	const response = await api(app, '/users-permissions/roles', { headers });
	assertOk(response.ok, 'list roles');
	const body: { roles: RoleSummary[] } = await response.json();
	return body.roles;
}

async function roleDetail(app: App, headers: { authorization: string }, id: number): Promise<RoleDetail> {
	const response = await api(app, `/users-permissions/roles/${id}`, { headers });
	assertOk(response.ok, `read role ${id}`);
	const body: { role: RoleDetail } = await response.json();
	return body.role;
}

function withUserActions(permissions: RolePermissions): RolePermissions {
	const usersPermissions = permissions['plugin::users-permissions'];
	const userActions = { ...usersPermissions.controllers.user };
	for (const action of USER_ACTIONS_TO_GRANT) {
		userActions[action] = { ...userActions[action], enabled: true };
	}
	return {
		...permissions,
		'plugin::users-permissions': {
			...usersPermissions,
			controllers: { ...usersPermissions.controllers, user: userActions },
		},
	};
}

/**
 * Configures the fresh Strapi the way an operator would in the admin panel:
 * authenticated users may update themselves and their avatar, and an `admin`
 * type role exists (with the same grants) as a target for escalation attempts.
 * Re-running against an already configured instance converges to the same state.
 * @param app - The `app` fixture.
 */
export async function configureRoles(app: App): Promise<void> {
	const headers = await adminHeaders(app);
	const roles = await listRoles(app, headers);
	const authenticated = roles.find((role) => role.type === 'authenticated');
	assertOk(authenticated !== undefined, 'authenticated role exists');
	const authenticatedRole = await roleDetail(app, headers, authenticated.id);
	const grantedPermissions = withUserActions(authenticatedRole.permissions);

	const updated = await sendJson(
		app,
		'PUT',
		`/users-permissions/roles/${authenticated.id}`,
		{ ...authenticatedRole, permissions: grantedPermissions },
		headers,
	);
	assertOk(updated.ok, 'grant user update and updateAvatar to authenticated');

	const adminRoleData = {
		name: 'Admin',
		description: 'E2E admin-type role',
		permissions: grantedPermissions,
	};
	const existingAdmin = roles.find((role) => role.type === 'admin');
	const saved = existingAdmin
		? await sendJson(app, 'PUT', `/users-permissions/roles/${existingAdmin.id}`, adminRoleData, headers)
		: await sendJson(app, 'POST', '/users-permissions/roles', adminRoleData, headers);
	assertOk(saved.ok, 'save admin-type role');
}

/**
 * Finds the users-permissions role whose type is `admin`, created by `configureRoles`.
 * @param app - The `app` fixture.
 * @returns The role id.
 */
export async function adminRoleId(app: App): Promise<number> {
	const roles = await listRoles(app, await adminHeaders(app));
	const adminRole = roles.find((role) => role.type === 'admin');
	assertOk(adminRole !== undefined, 'admin-type role exists');
	return adminRole.id;
}
