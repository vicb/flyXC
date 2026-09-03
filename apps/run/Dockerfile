FROM docker.io/node:lts-slim

ENV NODE_ENV=production

ARG DEBIAN_FRONTEND="noninteractive"
RUN apt-get update -y \
	&& apt-get install -y tini

RUN npm install -g pnpm@11.10.0

WORKDIR /usr/src/app

COPY --chown=node:node apps/run/dist/package.json apps/run/dist/pnpm-lock.yaml apps/run/dist/pnpm-workspace.yaml ./
COPY --chown=node:node apps/run/dist/workspace_modules ./workspace_modules/

RUN pnpm install --prod --frozen-lockfile --config.minimum-release-age=0

COPY --chown=node:node apps/run/dist/ ./dist/

ENTRYPOINT ["/usr/bin/tini", "--"]

USER node

CMD [ "node", "dist/index.js" ]