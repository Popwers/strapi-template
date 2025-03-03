FROM node:lts-alpine AS base
WORKDIR /opt/app
RUN apk add --no-cache libstdc++ vips-dev mysql-client && \
    npm config set audit false && \
    npm config set fund false && \
    npm config set update-notifier false

ARG PUBLIC_URL=http://localhost:1337
ENV PUBLIC_URL=${PUBLIC_URL}

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

FROM base AS base_deps
RUN apk add --no-cache build-base gcc autoconf automake zlib-dev libpng-dev git && \
    npm install -g node-gyp && \
    npm config set fetch-retry-maxtimeout 600000 -g

FROM base_deps AS deps
COPY package*.json ./
RUN if [ "$NODE_ENV" = "production" ]; then \
    npm ci --omit=dev --prefer-offline --no-audit; \
    else \
    npm install; \
    fi

#FROM base_deps AS plugins
#COPY src/plugins/your-plugin ./src/plugins/your-plugin
#RUN cd src/plugins/your-plugin && \
#    if [ "$NODE_ENV" = "production" ]; then \
#    npm ci --include=dev --prefer-offline --no-audit; \
#    else \
#    npm install; \
#    fi && \
#    node --run build

FROM base AS runner
COPY --from=deps /opt/app/node_modules ./node_modules
#COPY --from=plugins /opt/app/src/plugins/your-plugin/node_modules ./src/plugins/your-plugin/node_modules
#COPY --from=plugins /opt/app/src/plugins/your-plugin/dist ./src/plugins/your-plugin/dist
COPY . .

RUN node --run build && \
    chown -R node:node /opt/app

USER node
CMD if [ "$NODE_ENV" = "production" ]; then \
    node --run start; \
    else \
    node --run dev; \
    fi
