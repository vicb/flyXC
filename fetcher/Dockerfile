# Use the official lightweight Node.js image.
# https://hub.docker.com/_/node
FROM node:18-slim

ENV NODE_ENV production

# Create and change to the app directory.
WORKDIR /usr/src/app

# Install production dependencies.
RUN npm install -g npm@latest

# Copy local code to the container image.
COPY package*.json ./
RUN npm install --only=production

COPY dist/fetcher.js ./

# Restart the fetcher every 24h for memory leaks.
CMD [ "node", "fetcher.js", "-e", "24" ]