# Generate the vector tiles

Install [tippecanoe](https://github.com/felt/tippecanoe) - note that the the mapbox repo is unmaintained.

## Airspaces

- nx build fxc-tiles
- cd apps/fxc-tiles
- `npm run download-airspaces`
- Display stats with `node dist/airspaces/stats.js` (quick check of the airspaces)
- Create the geojson with `node dist/airspaces/create-geojson.js`
- Create the vector tiles with `node dist/airspaces/create-tiles.js`

### Diff update

- Create the tiles - See above,
- Create the tile info with `node dist/airspaces/create-tiles-info.js`
- Create the info diff with `node dist/airspaces/create-tiles-info-diff.js`
- Run tests `nx reset`, `nx check`
- Sync the diff with `node dist/airspaces/upload-tiles-diff.js`

### ZIP update (outdated, probably not needed with the diff update)

- Execute `zip -r tiles.zip tiles` to create the zip file,
- GCE (See Below) or execute `node unzip.js -d tiles-info-diff.json` to apply the diffs,
- Copy and commit `tiles-info.json` in `apps/fxc-tiles/src/assets/`.

### Using the unzip script on a Compute VM

$ zip -r tiles.zip tiles
$ gcloud compute scp tiles.zip unzip-airspaces:~/tiles/ --zone "us-central1-a"
$ gcloud compute scp tiles-info-diff.json unzip-airspaces:~/tiles/ --zone "us-central1-a"
$ gcloud compute ssh --zone "us-central1-a" "unzip-airspaces" --project "fly-xc"
$ docker container ps
$ docker exec -it <NAME> bash
$ cd /tiles
$ node /usr/src/app/unzip.js -i tiles.zip

## Google Storage ref

_copy_
gcloud storage cp -r tiles gs://airspaces \
 --content-type="application/x-protobuf" \
 --cache-control="public, max-age=360000" \
 --gzip-in-flight-all

--gzip-in-flight-all = serve files gzip encoded

_enable CORS_
$ gcloud storage buckets update gs://airspaces --cors-file=cors.json

_public access_
$ gcloud storage buckets add-iam-policy-binding gs://airspaces \
 --member=allUsers \
 --role=roles/storage.objectViewer

_url_
<https://airspaces.storage.googleapis.com/${z}/${x}/${y}.pbf>
