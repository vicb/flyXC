# How to contribute.

## Required tools

- node.js
- npm
- on mac-os, you have to install xcode command line developer tools (run xcode-select --install)
- gcloud
- docker
- the IDE of your choice


## Project setup

- run `npm install`
- add default keys definitions
  - `cp apps/fxc-front/src/app/keys.ts.dist apps/fxc-front/src/app/keys.ts`
  - `cp libs/common/src/lib/keys.ts.dist libs/common/src/lib/keys.ts`

### Simplistic configuration

**redis server**
- docker run -ti --rm -p 6378:6379 redis

For a simplistic local configuration, you can install and use gcloud local simulators for storage db and pubsup

**installation:**
- gcloud components install pubsub-emulator
- gcloud components install cloud-datastore-emulator

**run:**
- gcloud beta emulators datastore start
- gcloud beta emulators pubsub start

**before npm run dev:**
set environment variables given by this 2 commands
- gcloud beta emulators datastore env-init
- gcloud beta emulators pubsub env-init
