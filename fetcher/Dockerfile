# Use the official lightweight Node.js image.
# https://hub.docker.com/_/node
FROM node:16-slim

ENV NODE_ENV production

# Create and change to the app directory.
WORKDIR /usr/src/app

# Install production dependencies.
RUN npm install -g npm@latest

# Copy local code to the container image.
COPY package*.json ./
RUN npm install --only=production

COPY dist/fetcher.js ./

# Run the web service on container startup.
CMD [ "node", "fetcher.js" ]