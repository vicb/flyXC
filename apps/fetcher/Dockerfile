# Use the official lightweight Node.js image.
# https://hub.docker.com/_/node
FROM docker.io/node:current-slim

ENV NODE_ENV=production

ARG DEBIAN_FRONTEND="noninteractive"
RUN apt-get update -y \
	&& apt-get install -y tini

WORKDIR /usr/src/app
RUN npm install -g npm@latest

COPY dist/apps/fetcher/package*.json ./
RUN npm ci --no-audit

COPY dist/apps/fetcher/main.js ./

ENTRYPOINT ["/usr/bin/tini", "--"]

RUN chown -R node:node .
USER node

# Restart the fetcher periodically to mitigate memory leaks.
CMD [ "node", "main.js", "-e", "240" ]