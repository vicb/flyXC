# Generate the vector tiles

Install [tippecanoe](https://github.com/mapbox/tippecanoe).

- nx build airspaces
- cd dist/apps/airspaces
- chmod +x download.sh
- npm run download
- npm run geojson
- npm run stats (quick check of the airspaces)
- npm run tiles

# Diff update

- Create the tiles - See above,
- Execute `node tiles-info.js` to generate the info,
- Execute `node tiles-info-diff.js` to generate the diff,
- Use either direct updates:
  - Execute `node sync.js`
- Or ZIP updates
  - Execute `zip -r tiles.zip tiles` to create the zip file,
  - GCE (See Below) or execute `node unzip.js -d tiles-info-diff.json` to apply the diffs,
- Commit `tiles-info.json` in the application.

# Using the unzip script on a Compute VM

$ zip -r tiles.zip tiles
$ gcloud compute scp tiles.zip unzip-airspaces:~/tiles/ --zone "us-central1-a"
$ gcloud compute scp tiles-info-diff.json unzip-airspaces:~/tiles/ --zone "us-central1-a"
$ gcloud compute ssh --zone "us-central1-a" "unzip-airspaces" --project "fly-xc"
$ docker container ps
$ docker exec -it <NAME> bash
$ cd /tiles
$ node /usr/src/app/unzip.js -i tiles.zip

# Google Storage

_copy_
gsutil -h "Content-Type:application/x-protobuf" \
 -h "Cache-Control:public, max-age=360000" \
 -m cp -rZ tiles gs://airspaces

Z = serve file gzip encoded

_enable CORS_
$ gsutil cors set cors.json gs://airspaces

_public access_
$ gsutil iam ch allUsers:objectViewer gs://airspaces

_url_
https://airsp.storage.googleapis.com/${z}/${x}/${y}.pbf
