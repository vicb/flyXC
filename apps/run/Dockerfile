# Pin to node:26-alpine to match "engines": { "node": "^26.13.0" } in package.json.
# Using a specific major version rather than floating "lts-alpine" guarantees the container runtime
# matches local development and prevents silent upgrades to future Node versions upon rebuilding.
FROM docker.io/node:26-alpine

ENV NODE_ENV=production

RUN apk add --no-cache tini

RUN npm install -g pnpm@11.28.10

WORKDIR /usr/src/app

COPY --chown=node:node apps/run/dist/package.json apps/run/dist/pnpm-lock.yaml apps/run/dist/pnpm-workspace.yaml ./
COPY --chown=node:node apps/run/dist/workspace_modules ./workspace_modules/

RUN pnpm install --prod --frozen-lockfile --config.minimum-release-age=0

COPY --chown=node:node apps/run/dist/ ./dist/

ENTRYPOINT ["/sbin/tini", "--"]

USER node

CMD [ "node", "dist/index.js" ]