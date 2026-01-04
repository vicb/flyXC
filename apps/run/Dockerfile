FROM docker.io/node:lts-slim

ENV NODE_ENV=production

ARG DEBIAN_FRONTEND="noninteractive"
RUN apt-get update -y \
	&& apt-get install -y tini \
	&& apt-get install -y make g++ python3

WORKDIR /usr/src/app
RUN npm install -g npm@latest

COPY apps/run/dist/package*.json ./
RUN npm ci --no-audit

COPY apps/run/dist/index.js ./

ENTRYPOINT ["/usr/bin/tini", "--"]

RUN chown -R node:node .
USER node

CMD [ "node", "index.js" ]