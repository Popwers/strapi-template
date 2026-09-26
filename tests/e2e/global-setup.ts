import { type APIRequestContext, request } from '@playwright/test';

import { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_ROLE_ID_ENV, BASE_URL } from './support';

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
 * specs fail later on a missing permission.
 * @param ok - Whether the response had a 2xx status.
 * @param step - What the call was doing, for the error message.
 */
function assertOk(ok: boolean, step: string): asserts ok {
	if (!ok) throw new Error(`E2E global setup failed: ${step}`);
}

async function adminToken(api: APIRequestContext): Promise<string> {
	const response = await api.post('/admin/login', {
		data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
	});
	assertOk(response.ok(), `admin login returned ${response.status()}`);
	const body: { data: { token: string } } = await response.json();
	return body.data.token;
}

async function listRoles(api: APIRequestContext): Promise<RoleSummary[]> {
	const response = await api.get('/users-permissions/roles');
	assertOk(response.ok(), 'list roles');
	const body: { roles: RoleSummary[] } = await response.json();
	return body.roles;
}

async function roleDetail(api: APIRequestContext, id: number): Promise<RoleDetail> {
	const response = await api.get(`/users-permissions/roles/${id}`);
	assertOk(response.ok(), `read role ${id}`);
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
 */
export default async function globalSetup(): Promise<void> {
	const anonymous = await request.newContext({ baseURL: BASE_URL });
	const token = await adminToken(anonymous);
	await anonymous.dispose();

	const api = await request.newContext({
		baseURL: BASE_URL,
		extraHTTPHeaders: { authorization: `Bearer ${token}` },
	});

	const roles = await listRoles(api);
	const authenticated = roles.find((role) => role.type === 'authenticated');
	assertOk(authenticated !== undefined, 'authenticated role exists');
	const authenticatedRole = await roleDetail(api, authenticated.id);
	const grantedPermissions = withUserActions(authenticatedRole.permissions);

	const updated = await api.put(`/users-permissions/roles/${authenticated.id}`, {
		data: { ...authenticatedRole, permissions: grantedPermissions },
	});
	assertOk(updated.ok(), 'grant user update and updateAvatar to authenticated');

	const adminRoleData = {
		name: 'Admin',
		description: 'E2E admin-type role',
		permissions: grantedPermissions,
	};
	const existingAdmin = roles.find((role) => role.type === 'admin');
	const saved = existingAdmin
		? await api.put(`/users-permissions/roles/${existingAdmin.id}`, { data: adminRoleData })
		: await api.post('/users-permissions/roles', { data: adminRoleData });
	assertOk(saved.ok(), 'save admin-type role');

	const adminRole = (await listRoles(api)).find((role) => role.type === 'admin');
	assertOk(adminRole !== undefined, 'admin-type role exists');
	process.env[ADMIN_ROLE_ID_ENV] = String(adminRole.id);

	await api.dispose();
}
