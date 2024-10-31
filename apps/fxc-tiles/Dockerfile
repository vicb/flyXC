FROM docker.io/node:lts-slim

ENV NODE_ENV=production

WORKDIR /usr/src/app
RUN npm install -g npm@latest

COPY dist/apps/fxc-tiles/package*.json ./
RUN npm ci --no-audit

COPY dist/apps/fxc-tiles/unzip.js ./
