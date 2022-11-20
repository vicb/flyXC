# Use the official lightweight Node.js image.
# https://hub.docker.com/_/node
FROM node:current-slim

ENV NODE_ENV production

# Create and change to the app directory.
WORKDIR /usr/src/app

# Install production dependencies.
RUN npm install -g npm@latest

# Copy local code to the container image.
COPY package*.json ./
RUN npm install --omit=dev

COPY dist/proxy.js ./

CMD [ "node", "proxy.js" ]