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

### Simplistic configuration

**redis server**

- `cd docker; docker compose up -d redis`

**pubsub**

- `cd docker; docker compose up -d pubsub`

**datastore**

For the moment, it does not work with docker compose. But if you install the cloud-datastore-emulator, you will have a working configuration.

**_Installation_**

- `gcloud components install cloud-datastore-emulator`

**_run the data store:_**

- `gcloud beta emulators datastore start --data-dir=MY_DATA_DIR`

**_before npm run dev:_**

- open another shell.
- define the required environment variables:`eval $(gcloud beta emulators datastore --data-dir=MY_DATA_DIR env-init)`
- you can then run the application locally in this shell with `npm run dev`

## Helpful commands

`npx nx check` runs the build, lint, and test targets for all the projects. Nice to use before uploading a PR.

`nx affected:test --all --parallel --maxParallel 10 --watch` will run the tests affected by your code changes.

`npm run fixlint` to fix lint errors.

#### Architecture Diagram

- The PlantUML architectural diagram is located in doc/flyxc_arch.puml
- The doc/flyxc_arch.puml diagram depicts a visual representation of the different components of the flyxc app and the logical connections among components.
- PlantUML requires Java to be installed on your machine.
- Then download the plantuml.jar file and execute it to access PlantUML’s graphical user interface.
- https://plantuml.com/starting
- On VS Code, install the PlantUML extension. To preview diagrams: Press Alt + D to start PlantUML preview (option + D on MacOS).
