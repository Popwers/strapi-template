# [1.2.0](https://github.com/Popwers/strapi-template/compare/v1.1.0...v1.2.0) (2026-10-29)


### Features

* Sentry PII scrub, backup heartbeat and JWT revocation on password change ([#32](https://github.com/Popwers/strapi-template/issues/32)) ([612d9fc](https://github.com/Popwers/strapi-template/commit/612d9fcb58a07b30ec39977cbb2b0b79c09143e5))

# [1.1.0](https://github.com/Popwers/strapi-template/compare/v1.0.2...v1.1.0) (2026-10-28)


### Bug Fixes

* **backup:** export in-process so the cron works in the Docker image ([46037a6](https://github.com/Popwers/strapi-template/commit/46037a69dad90a64548e51d7fdcc11dbb7b471c2))
* **docker:** run the strapi binary as PID 1 so SIGTERM reaches it ([e423296](https://github.com/Popwers/strapi-template/commit/e423296d507f389d10bfd5f024650880dd3f3857))


### Features

* **upload:** store media in the R2 files bucket ([a318d8c](https://github.com/Popwers/strapi-template/commit/a318d8c2f77448b0a0e39a76db4a7d8bd8037cec))

## [1.0.2](https://github.com/Popwers/strapi-template/compare/v1.0.1...v1.0.2) (2026-10-19)


### Bug Fixes

* **sentry:** tighten the beforeSend noise filters ([#28](https://github.com/Popwers/strapi-template/issues/28)) ([a23f20d](https://github.com/Popwers/strapi-template/commit/a23f20d1900b40d9ce5258d91356e57b13b0b118))

## [1.0.1](https://github.com/Popwers/strapi-template/compare/v1.0.0...v1.0.1) (2026-09-28)


### Performance Improvements

* **admin:** defer highlight.js language pack out of the admin entry ([#15](https://github.com/Popwers/strapi-template/issues/15)) ([4d583df](https://github.com/Popwers/strapi-template/commit/4d583dfea9941ddd4e824b6b4db21e96ef0c9001))

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
