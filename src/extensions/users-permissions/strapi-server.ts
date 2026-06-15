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
		const sanitizedUser = await sanitizeUser(ctx);
		if (!sanitizedUser) return ctx.badRequest('Default role not found');

		// Set the sanitized data to the request body
		ctx.request.body = sanitizedUser;

		await contentManagerUserCreateController(ctx);
	};

	/**
	 * Add a default role and username to the user on creation
	 * @param ctx
	 */
	plugin.controllers.user.create = async (ctx) => {
		const sanitizedUser = await sanitizeUser(ctx);
		if (!sanitizedUser) return ctx.badRequest('Default role not found');

		// Set the sanitized data to the request body
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
				const sanitizedUser = await sanitizeUser(ctx);
				if (!sanitizedUser) return ctx.badRequest('Default role not found');

				// Set the sanitized data to the request body
				ctx.request.body = sanitizedUser;

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
	 * Rebuild the registration body from scratch so client-supplied values never
	 * reach the DB. This is the counterpart of `register.allowedFields: ['role']`
	 * in config/plugins.ts: the field is whitelisted there only because we force
	 * the role to the default here. Removing this helper re-opens role self-assignment.
	 * @param ctx
	 * @returns object | false
	 */
	const sanitizeUser = async (ctx) => {
		// Generate placeholder username and get the default role
		const username = generateUser();
		const defaultRole = await strapi.query('plugin::users-permissions.role').findOne({
			where: { type: 'authenticated' },
		});

		if (!defaultRole) return false;

		// Reset the body to avoid errors or hacks
		return {
			email: ctx.request.body.email,
			password: ctx.request.body.password,
			role: { disconnect: [], connect: [defaultRole] },
			username,
		};
	};

	return plugin;
};
