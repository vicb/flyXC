# Stage 1: Build & Deploy workspace project
FROM docker.io/node:current-slim AS installer

RUN npm install -g pnpm@11.10.0

WORKDIR /usr/src/app

COPY . .

RUN pnpm -F fetcher deploy /tmp/fetcher

# Stage 2: Production runner stage
FROM docker.io/node:current-slim

ENV NODE_ENV=production

ARG DEBIAN_FRONTEND="noninteractive"
RUN apt-get update -y \
	&& apt-get install -y tini

WORKDIR /usr/src/app

COPY --from=installer /tmp/fetcher ./

ENTRYPOINT ["/usr/bin/tini", "--"]

RUN chown -R node:node .
USER node

# Restart the fetcher periodically to mitigate memory leaks.
CMD [ "node", "dist/index.js", "-e", "240" ]