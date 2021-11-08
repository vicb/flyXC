# Generate the vector tiles

Install [tippecanoe](https://github.com/mapbox/tippecanoe).

- npm run download
- npm run geojson
- npm run tiles

# Google Storage

*copy*
gsutil -h "Content-Type:application/x-protobuf" \
       -h "Cache-Control:public, max-age=360000" \
       -m cp -rZ tiles gs://airspaces

Z = serve file gzip encoded

*enable CORS*
$ gsutil cors set cors.json gs://airspaces

*public access*
$ gsutil iam ch allUsers:objectViewer gs://airspaces

*url*
https://airspaces.storage.googleapis.com/${z}/${x}/${y}.pbf

# Using the unzip script on a Compute VM

$ zip -r -9 tiles.zip tiles

$ gcloud compute scp tiles.zip unzip-airspaces:~/tiles/ --zone "us-central1-a"

$ gcloud compute ssh --zone "us-central1-a" "unzip-airspaces" --project "fly-xc"

$ docker container ps

$ docker exec -it <NAME> bash

$ node unzip.js -i /tiles/tiles.zip

# Update the Docker image

$ npm run docker:build

$ npm run docker:push

# Diff update

- Delete the `asp` and `tiles` folders,
- Create the tiles - See above,
- Execute `zip -r -9 tiles.zip tiles` to create the zip file,
- Rename `tiles-info.json` to `tiles-info.ref.json`
- Execute `node tiles-info.js` to generate the info,
- Execute `node tiles-info-diff.js -r tiles-info.ref.json` to generate the diff,
- Execute `node unzip.js -d tiles-info-diff.json` to apply the diffs,
- Delete `tiles-info.ref.json`,
- Commit `tiles-info.json`.
