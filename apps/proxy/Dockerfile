# Stage 1: Build & Deploy workspace project
FROM docker.io/node:current-slim AS installer

RUN npm install -g pnpm@11.10.0

WORKDIR /usr/src/app

COPY . .

RUN pnpm -F proxy deploy /tmp/proxy

# Stage 2: Production runner stage
FROM docker.io/node:current-slim

ENV NODE_ENV=production

ARG DEBIAN_FRONTEND="noninteractive"
RUN apt-get update -y \
	&& apt-get install -y tini libcap2-bin \
	&& setcap cap_net_bind_service=+ep `readlink -f \`which node\``

WORKDIR /usr/src/app

COPY --from=installer /tmp/proxy ./

ENTRYPOINT ["/usr/bin/tini", "--"]

RUN chown -R node:node .
USER node

CMD [ "node", "dist/index.js" ]