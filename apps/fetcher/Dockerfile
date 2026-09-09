# Pin to node:24-slim to match "engines": { "node": "^24.15" } in package.json.
# Using a specific major version rather than floating "lts-slim" guarantees the container runtime
# matches local development and prevents silent upgrades to future Node versions upon rebuilding.
# This also ensures Node's embedded Undici version (process.versions.undici) stays aligned with
# the "undici" dependency pinned in pnpm-workspace.yaml.
FROM docker.io/node:24-slim

ENV NODE_ENV=production

ARG DEBIAN_FRONTEND="noninteractive"
RUN apt-get update -y \
	&& apt-get install -y tini

RUN npm install -g pnpm@11.10.0

WORKDIR /usr/src/app

COPY --chown=node:node apps/fetcher/dist/package.json apps/fetcher/dist/pnpm-lock.yaml apps/fetcher/dist/pnpm-workspace.yaml ./
COPY --chown=node:node apps/fetcher/dist/workspace_modules ./workspace_modules/

RUN pnpm install --prod --frozen-lockfile --config.minimum-release-age=0

COPY --chown=node:node apps/fetcher/dist/ ./dist/

ENTRYPOINT ["/usr/bin/tini", "--"]

USER node

# Restart the fetcher periodically to mitigate memory leaks.
CMD [ "node", "dist/index.js", "-e", "240" ]