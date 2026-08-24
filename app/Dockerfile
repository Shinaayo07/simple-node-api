# syntax=docker/dockerfile:1

ARG NODE_VERSION=26.7.0-alpine

FROM node:${NODE_VERSION} AS deps

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev

FROM node:${NODE_VERSION} AS runtime

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

USER node

COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"


CMD ["node", "src/server.js"]
