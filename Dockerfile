FROM node:24-alpine@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf AS base
WORKDIR /app

FROM base AS dependencies
COPY package*.json ./
RUN npm ci

FROM dependencies AS development
COPY --chown=node:node . .
USER node
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM development AS migration
CMD ["npm", "run", "db:setup"]

FROM base AS production-dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM base AS production
ENV NODE_ENV=production
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package*.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node data ./data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/healthz').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "src/server.js"]
