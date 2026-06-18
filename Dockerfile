# syntax=docker/dockerfile:1.7

# --- base: lean runtime image (alpine + node + libvips + postgres client) ---
FROM node:lts-alpine AS base
WORKDIR /opt/app
RUN apk add --no-cache libstdc++ vips-dev postgresql-client curl && \
    npm config set audit false && \
    npm config set fund false && \
    npm config set update-notifier false

ARG PUBLIC_URL=http://localhost:1337
ENV PUBLIC_URL=${PUBLIC_URL}
ENV PORT=1337

# --- base_deps: native build toolchain (sharp / node-gyp) -------------------
FROM base AS base_deps
RUN apk add --no-cache build-base gcc autoconf automake zlib-dev libpng-dev && \
    npm install -g node-gyp && \
    npm config set fetch-retry-maxtimeout 600000 -g

# --- deps_full: install all deps (incl. devDeps) for build + dev runtime ----
FROM base_deps AS deps_full
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    --mount=type=cache,target=/root/.cache,sharing=locked \
    npm ci --prefer-offline --no-audit

# --- builder: strapi build (admin + TS compile) -----------------------------
FROM deps_full AS builder
ENV NODE_ENV=production
COPY . .
RUN --mount=type=cache,target=/opt/app/.cache \
    --mount=type=cache,target=/opt/app/node_modules/.cache \
    NODE_OPTIONS="--max-old-space-size=2048" npm run build

# --- deps_prod: prod-only node_modules (parallel to deps_full, same cache) --
FROM base_deps AS deps_prod
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    --mount=type=cache,target=/root/.cache,sharing=locked \
    npm ci --omit=dev --prefer-offline --no-audit

# @strapi/strapi declares the admin-panel toolchain as *runtime* dependencies,
# but `strapi build` bakes the whole admin SPA into dist/build as static assets,
# so the Node server never loads these at boot or on any API route (verified:
# boots healthy, /admin + its 5.6 MB bundle serve, content-manager API resolves).
# They fall into two buckets, both build-only:
#   - bundlers / transpilers: @swc, webpack, esbuild-loader, lightningcss, typescript
#   - admin SPA libs already compiled into dist/build: @formatjs, @reduxjs,
#     @shikijs, hls.js, @mux, core-js-pure
# Pruning them trims ~255 MB. Re-validate this list after a Strapi major upgrade.
RUN rm -rf \
    node_modules/@swc \
    node_modules/@formatjs \
    node_modules/@reduxjs \
    node_modules/@shikijs \
    node_modules/@mux \
    node_modules/hls.js \
    node_modules/core-js-pure \
    node_modules/webpack \
    node_modules/esbuild-loader \
    node_modules/typescript \
    node_modules/lightningcss \
    node_modules/lightningcss-*

# --- dev_runtime: target used by docker-compose.dev.yml (hot reload) --------
# Volume mounts override /opt/app/{src,config,database,types,.env} at runtime,
# so this stage just needs full node_modules + source for first boot.
# Declared before `runtime` so `runtime` stays the default target when
# `docker build` is run without `--target`.
FROM base_deps AS dev_runtime
ENV NODE_ENV=development
COPY --from=deps_full /opt/app/node_modules ./node_modules
COPY . .

HEALTHCHECK NONE
CMD ["node", "--run", "dev"]

# --- runtime: lean prod image — only what Strapi needs to run ---------------
# Kept last on purpose: builds without `--target` default here.
FROM base AS runtime
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

# Prod-only node_modules (no TS, no @types, no semantic-release, no vite-plus)
COPY --from=deps_prod --chown=node:node /opt/app/node_modules ./node_modules

# Compiled output + runtime config + schemas + assets
COPY --from=builder --chown=node:node /opt/app/dist          ./dist
COPY --from=builder --chown=node:node /opt/app/config        ./config
COPY --from=builder --chown=node:node /opt/app/database      ./database
COPY --from=builder --chown=node:node /opt/app/public        ./public
COPY --from=builder --chown=node:node /opt/app/src           ./src
COPY --from=builder --chown=node:node /opt/app/package.json  ./
COPY --from=builder --chown=node:node /opt/app/package-lock.json ./
COPY --from=builder --chown=node:node /opt/app/tsconfig.json ./
COPY --from=builder --chown=node:node /opt/app/favicon.png   ./

# WORKDIR is created as root; chown so the `node` runtime can write temp files in CWD if needed.
RUN chown node:node /opt/app

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl --fail --silent --output /dev/null "http://127.0.0.1:${PORT:-1337}/_health" || exit 1

CMD ["node", "--run", "start"]
