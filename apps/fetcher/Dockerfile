# Pin to node:26-alpine to match "engines": { "node": "^26.13.0" } in package.json.
# Using a specific major version rather than a floating tag guarantees the container runtime
# matches local development and prevents silent upgrades to future Node versions upon rebuilding.
FROM docker.io/node:26-alpine

ENV NODE_ENV=production

RUN apk add --no-cache tini

RUN npm install -g pnpm@11.28.10

WORKDIR /usr/src/app

COPY --chown=node:node apps/fetcher/dist/package.json apps/fetcher/dist/pnpm-lock.yaml apps/fetcher/dist/pnpm-workspace.yaml ./
COPY --chown=node:node apps/fetcher/dist/workspace_modules ./workspace_modules/

RUN pnpm install --prod --frozen-lockfile --config.minimum-release-age=0

COPY --chown=node:node apps/fetcher/dist/ ./dist/

ENTRYPOINT ["/sbin/tini", "--"]

USER node

# Restart the fetcher periodically to mitigate memory leaks.
# --max-semi-space-size=64 prevents V8 from shrinking young generation on 1GB VMs,
# avoiding premature promotion to old space and reducing GC thrashing during bursts.
# --max-old-space-size=512 sets a 512MB heap limit appropriate for a 1GB machine with swap.
CMD [ "node", "--max-semi-space-size=64", "--max-old-space-size=512", "dist/index.js", "-e", "240" ]