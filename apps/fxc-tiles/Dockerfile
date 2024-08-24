FROM docker.io/node:lts-slim

ENV NODE_ENV=production

WORKDIR /usr/src/app
RUN npm install -g npm@latest

COPY dist/apps/airspaces/package*.json ./
RUN npm ci --no-audit

COPY dist/apps/airspaces/unzip.js ./
