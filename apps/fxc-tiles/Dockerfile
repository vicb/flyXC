FROM docker.io/node:lts-slim

ENV NODE_ENV=production

WORKDIR /usr/src/app
RUN npm install -g npm@latest

COPY apps/fxc-tiles/dist/package*.json ./
RUN npm ci --no-audit

COPY apps/fxc-tiles/dist/unzip.js ./
