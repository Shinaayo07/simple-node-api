# syntax=docker/dockerfile:1

#Minimal Node.js Dockerfile for production use. This image is based on the official Node.js Alpine image, which is a lightweight Linux distribution.
ARG NODE_VERSION=26.7.0-alpine

#Build stage: install dependencies based on the preferred package manager.
FROM node:${NODE_VERSION} AS deps

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev

# runtime: minimal image with only prod node_modules + app source.
FROM node:${NODE_VERSION} AS runtime

#Environment variables for production mode and port configuration.
ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

# Use a non-root user to run our application
USER node

COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src

EXPOSE 3000

# Healthcheck to ensure the application is running and responsive. It checks the /health endpoint every 30 seconds,
# with a timeout of 5 seconds, starting after an initial delay of 5 seconds, and will retry up to 3 times before considering the container unhealthy.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"


CMD ["node", "src/server.js"]
