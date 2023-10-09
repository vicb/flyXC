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
- `cd docker; docker compose up -d redis`

**pubsub**
- `cd docker; docker compose up -d pubsub`

**datastore**

For the moment, it does not work with docker compose. But if you install the cloud-datastore-emulator, you will have a working configuration.

***Installation***
- `gcloud components install cloud-datastore-emulator`

***run:***
- `gcloud beta emulators datastore start`

**before npm run dev:**

define the required env variables:
```
export DATASTORE_DATASET=flyxc
export DATASTORE_EMULATOR_HOST=localhost:8081
export DATASTORE_EMULATOR_HOST_PATH=localhost:8081/datastore
export DATASTORE_HOST=http://localhost:8081
export DATASTORE_PROJECT_ID=flyxc
```
