import { generateUser, parseFiles } from './helper';

const notAllowedFields = ['provider', 'confirmed', 'blocked', 'role'];

const notAllowedFieldsContentManager = ['provider', 'role'];

export default async (plugin) => {
	const contentManagerUserCreateController = plugin.controllers.contentmanageruser.create;
	const createUserController = plugin.controllers.user.create;

	const contentManagerUserUpdateController = plugin.controllers.contentmanageruser.update;
	const userUpdateController = plugin.controllers.user.update;

	const initialAuthController = plugin.controllers.auth({ strapi });

	/**
	 * -------------------------------------------------------------------------
	 * ------------------------------ CONTROLLERS ------------------------------
	 * -------------------------------------------------------------------------
	 */

	/**
	 * Add a default role and username to the user on creation
	 * @param ctx
	 */
	plugin.controllers.contentmanageruser.create = async (ctx) => {
		const sanitizedUser = await bodyWithAuthenticatedRole(ctx);
		if (!sanitizedUser) return ctx.badRequest('Default role not found');

		ctx.request.body = sanitizedUser;

		await contentManagerUserCreateController(ctx);
	};

	/**
	 * Add a default role and username to the user on creation
	 * @param ctx
	 */
	plugin.controllers.user.create = async (ctx) => {
		const sanitizedUser = await bodyWithAuthenticatedRole(ctx);
		if (!sanitizedUser) return ctx.badRequest('Default role not found');

		ctx.request.body = sanitizedUser;

		await createUserController(ctx);
	};

	/**
	 * Add a default role and username to the user on creation
	 * @param ctx
	 */
	plugin.controllers.auth = ({ strapi: _strapi }) => {
		return {
			...initialAuthController,
			register: async (ctx) => {
				// Stock register writes settings.default_role in the same user.add
				// create. A role key on this body is a 400 (allowedFields is empty).
				ctx.request.body = sanitizeUser(ctx);

				await initialAuthController.register(ctx);
			},
		};
	};

	/**
	 * Prevent user to update certain fields by removing them from the request body
	 */
	plugin.controllers.contentmanageruser.update = async (ctx) => {
		const { body } = ctx.request;
		const sanitizedBody = Object.fromEntries(
			Object.entries(body).filter(([key]) => !notAllowedFieldsContentManager.includes(key)),
		);

		ctx.request.body = sanitizedBody;

		await contentManagerUserUpdateController(ctx);
	};

	/**
	 * Prevent user to update certain fields by removing them from the request body
	 */
	plugin.controllers.user.update = async (ctx) => {
		const { body } = ctx.request;
		const sanitizedBody = Object.fromEntries(
			Object.entries(body).filter(([key]) => !notAllowedFields.includes(key)),
		);

		ctx.request.body = sanitizedBody;

		await userUpdateController(ctx);
	};

	/**
	 * Update the avatar of the user
	 * @param ctx
	 */
	plugin.controllers.user.updateAvatar = async (ctx) => {
		const authUser = ctx.state.user;

		if (!authUser) {
			return ctx.unauthorized();
		}

		if (ctx.is('multipart')) {
			const files = parseFiles(ctx.request.files);
			if (!files) {
				return ctx.badRequest('No files provided');
			}

			if (files && 'avatar' in files) {
				const uploadService = strapi.plugin('upload').service('upload');
				const uploadFolderService = strapi.plugin('upload').service('api-upload-folder');
				const apiUploadFolder = await uploadFolderService.getAPIUploadFolder();

				if (!uploadService || !uploadFolderService || !apiUploadFolder) {
					return ctx.badRequest('Upload service not found');
				}

				// Get user data
				const userData = await strapi.query('plugin::users-permissions.user').findOne({
					where: { documentId: authUser.documentId },
					populate: ['avatar'],
				});

				if (!userData) {
					return ctx.badRequest('User not found');
				}

				// Remove old avatar if exists
				if (userData?.avatar?.documentId) {
					const oldMedia = await strapi.query('plugin::upload.file').findOne({
						where: { documentId: userData.avatar.documentId },
					});

					if (oldMedia) {
						const removedOldMedia = await uploadService.remove(oldMedia);

						if (!removedOldMedia) {
							return ctx.badRequest('Failed to remove old avatar');
						}
					}
				}

				// Upload new avatar
				const newMedia = await uploadService.upload({
					data: {
						refId: authUser.id,
						ref: 'plugin::users-permissions.user',
						field: 'avatar',
						fileInfo: {
							folder: apiUploadFolder.id,
						},
					},
					files: files.avatar,
				});

				if (!newMedia) {
					return ctx.badRequest('Failed to upload new avatar');
				}
			} else {
				return ctx.badRequest('No avatar provided');
			}
		}

		await plugin.controllers.user.me(ctx);
	};

	/**
	 * ----------------------------------------------------------------------
	 * ------------------------------ POLICIES ------------------------------
	 * ----------------------------------------------------------------------
	 */

	/**
	 * Check if the user is the owner of the targeted user or an admin.
	 * @param ctx
	 * @returns boolean - Strapi's policy engine turns a falsy result into a 403,
	 * so denials must return `false` (not `ctx.unauthorized()`, whose body is discarded).
	 */
	plugin.policies.isOwnerOrAdmin = (ctx) => {
		const { id } = ctx.params;
		const authUser = ctx.state.user;

		if (!authUser) return false;

		return authUser.role.type === 'admin' || authUser.id === Number.parseInt(id, 10);
	};

	/**
	 * --------------------------------------------------------------------
	 * ------------------------------ ROUTES ------------------------------
	 * --------------------------------------------------------------------
	 */

	/**
	 * Add the route to update the avatar of the user
	 */
	plugin.routes['content-api'].routes.push({
		method: 'POST',
		path: '/users/avatar',
		handler: 'user.updateAvatar',
		config: {
			prefix: '',
		},
	});

	/**
	 * Add the policy to the update user route
	 */
	plugin.routes['content-api'].routes.find(
		(route) => route.method === 'PUT' && route.path === '/users/:id',
	).config.policies = ['isOwnerOrAdmin'];

	/**
	 * --------------------------------------------------------------------
	 * ------------------------------ HELPER ------------------------------
	 * --------------------------------------------------------------------
	 */

	/**
	 * Rebuild the write body from client email/password plus a generated
	 * username. Never copy `role` (or any other client field). Register
	 * `allowedFields` is empty, so a `role` key here is a 400.
	 * @param ctx
	 */
	const sanitizeUser = (ctx) => ({
		email: ctx.request.body.email,
		password: ctx.request.body.password,
		username: generateUser(),
	});

	const findAuthenticatedRole = async () =>
		strapi.query('plugin::users-permissions.role').findOne({
			where: { type: 'authenticated' },
		});

	/**
	 * Admin / user create still needs a role on the body.
	 * Register leaves that to stock `user.add` (settings.default_role).
	 * @param ctx
	 * @returns object | false
	 */
	const bodyWithAuthenticatedRole = async (ctx) => {
		const defaultRole = await findAuthenticatedRole();
		if (!defaultRole) return false;

		return {
			...sanitizeUser(ctx),
			role: { disconnect: [], connect: [defaultRole] },
		};
	};

	return plugin;
};
