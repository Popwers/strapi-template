# 1.0.0 (2026-09-23)


### Bug Fixes

* **cms:** run strapi export shell-free in backup cron ([0230048](https://github.com/Popwers/strapi-template/commit/0230048985407e432b333529d936aae5fcd8ec61))
* harden Strapi register allowedFields ([#2](https://github.com/Popwers/strapi-template/issues/2)) ([b34b1d1](https://github.com/Popwers/strapi-template/commit/b34b1d165ced91f46f9fdfcce19435b3f43d42f8))
* **release:** run semantic-release on master and enable Sentry from env ([65863fc](https://github.com/Popwers/strapi-template/commit/65863fcf45f00a2b6e61c94f08e7a3fd7b5b2f05))
* **users-permissions:** explicit policy returns, document role coupling, drop lodash ([6857887](https://github.com/Popwers/strapi-template/commit/6857887419329741cf7b7168c581925c290041fa))


### Features

* **config:** PostgreSQL datasource and hardened admin/api/plugins config ([3b940dd](https://github.com/Popwers/strapi-template/commit/3b940ddb87f9fb17a3e275b7e8db359adcc70ffb))
* **docker:** multi-stage Dockerfile and PostgreSQL compose stack ([6082e9c](https://github.com/Popwers/strapi-template/commit/6082e9cc7f01647244e463de848b2788c05ddcba))
* **keys:** create a script to generate missing keys for strapi ([993be7f](https://github.com/Popwers/strapi-template/commit/993be7fd8f6b1687d575ae4a39f8190165c77c86))


### Performance Improvements

* **docker:** prune admin toolchain + move typescript to devDependencies ([ad6cb2d](https://github.com/Popwers/strapi-template/commit/ad6cb2d3d68254b1bf84c559604958b12b87f518))
