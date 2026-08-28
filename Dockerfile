# Shared base keeps Node.js and the working directory identical across every image target.
FROM node:24-alpine@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf AS base
WORKDIR /app

# Copy manifests first so dependency installation remains cached when only source files change.
FROM base AS dependencies
COPY package*.json ./
RUN npm ci

FROM dependencies AS development
COPY --chown=node:node . .
# Development and migration tasks do not need root privileges inside the container.
USER node
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Migrations use the development dependency layer because sequelize-cli is not a runtime package.
FROM development AS migration
CMD ["npm", "run", "db:setup"]

FROM base AS production-dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# The runtime image contains only production dependencies and files needed to serve requests.
FROM base AS production
ENV NODE_ENV=production
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package*.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node data ./data
USER node
EXPOSE 3000
# Probe liveness without adding curl or another package to the production image.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/healthz').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "src/server.js"]
