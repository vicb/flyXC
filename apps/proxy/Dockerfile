FROM docker.io/node:current-slim

ENV NODE_ENV production

ARG DEBIAN_FRONTEND="noninteractive"
RUN apt-get update -y \
	&& apt-get install -y tini libcap2-bin \
	&& setcap cap_net_bind_service=+ep `readlink -f \`which node\``

WORKDIR /usr/src/app
RUN npm install -g npm@latest

COPY dist/apps/proxy/package*.json ./
RUN npm ci --no-audit

COPY dist/apps/proxy/main.js ./

ENTRYPOINT ["/usr/bin/tini", "--"]

RUN chown -R node:node .
USER node

CMD [ "node", "main.js" ]