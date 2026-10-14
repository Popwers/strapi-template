import { generateUser, parseFiles } from './helper';

const notAllowedFields = ['provider', 'confirmed', 'blocked', 'role'];

const notAllowedFieldsContentManager = ['provider', 'role'];

export default async (plugin) => {
	const contentManagerUserCreateController = plugin.controllers.contentmanageruser.create;
	const createUserController = plugin.controllers.user.create;

	const contentManagerUserUpdateController = plugin.controllers.contentmanageruser.update;
	const userUpdateController = plugin.controllers.user.update;

	const initialAuthController = plugin.controllers.auth({ strapi });

	plugin.controllers.contentmanageruser.create = async (ctx) => {
		const createBody = await createUserWriteBody(ctx);
		if (!createBody) return ctx.badRequest('Default role not found');

		ctx.request.body = createBody;

		await contentManagerUserCreateController(ctx);
	};

	plugin.controllers.user.create = async (ctx) => {
		const createBody = await createUserWriteBody(ctx);
		if (!createBody) return ctx.badRequest('Default role not found');

		ctx.request.body = createBody;

		await createUserController(ctx);
	};

	plugin.controllers.auth = ({ strapi: _strapi }) => {
		return {
			...initialAuthController,
			register: async (ctx) => {
				// Stock register writes settings.default_role in the same user.add
				// create. A role key on this body is a 400 (allowedFields is empty).
				ctx.request.body = newUserWriteBody(ctx);

				await initialAuthController.register(ctx);
			},
		};
	};

	plugin.controllers.contentmanageruser.update = async (ctx) => {
		const { body } = ctx.request;
		const sanitizedBody = Object.fromEntries(
			Object.entries(body).filter(([key]) => !notAllowedFieldsContentManager.includes(key)),
		);

		ctx.request.body = sanitizedBody;

		await contentManagerUserUpdateController(ctx);
	};

	plugin.controllers.user.update = async (ctx) => {
		const { body } = ctx.request;
		const sanitizedBody = Object.fromEntries(
			Object.entries(body).filter(([key]) => !notAllowedFields.includes(key)),
		);

		ctx.request.body = sanitizedBody;

		await userUpdateController(ctx);
	};

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

				const userData = await strapi.query('plugin::users-permissions.user').findOne({
					where: { documentId: authUser.documentId },
					populate: ['avatar'],
				});

				if (!userData) {
					return ctx.badRequest('User not found');
				}

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

	plugin.routes['content-api'].routes.push({
		method: 'POST',
		path: '/users/avatar',
		handler: 'user.updateAvatar',
		config: {
			prefix: '',
		},
	});

	plugin.routes['content-api'].routes.find(
		(route) => route.method === 'PUT' && route.path === '/users/:id',
	).config.policies = ['isOwnerOrAdmin'];

	const newUserWriteBody = (ctx) => ({
		email: ctx.request.body.email,
		password: ctx.request.body.password,
		username: generateUser(),
	});

	const findAuthenticatedRole = async () =>
		strapi.query('plugin::users-permissions.role').findOne({
			where: { type: 'authenticated' },
		});

	const createUserWriteBody = async (ctx) => {
		const defaultRole = await findAuthenticatedRole();
		if (!defaultRole) return false;

		return {
			...newUserWriteBody(ctx),
			role: { disconnect: [], connect: [defaultRole] },
		};
	};

	return plugin;
};
