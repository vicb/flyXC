# Generate the vector tiles

Install [tippecanoe](https://github.com/felt/tippecanoe) - note that the mapbox repo is unmaintained.

## Airspaces

- `nx build fxc-tiles`
- `cd apps/fxc-tiles`
- `npm run download-airspaces`
- Display stats with `node dist/airspaces/stats.js` (quick check of the airspaces)
- Create the geojson with `node dist/airspaces/create-geojson.js`
  - Assigns sequential 1-based integer `id`s (`id: 1..N`) across all airspaces.
  - Sets both top-level `feature.id` and property `id` so tippecanoe preserves native protobuf feature IDs.
- Create the vector tiles with `node dist/airspaces/create-tiles.js`
  - Generates 2D vector tiles (zooms 0 to 10) in `assets/tiles`.
  - Generates unclipped vector tiles (`-z 6 -Z 6 -pc`) co-located in `assets/tiles/6/{x}/{y}-unclipped.pbf`. Unclipped polygons eliminate tile stitching and union operators in 3D rendering.
  - Updates `assets/airspaces-date.json` with the current date and timestamp `{ "date": "YYYY-MM-DD", "timestamp": 1234567890 }`.

### Diff update

- Create the tiles - See above,
- Create the tile info with `node dist/airspaces/create-tiles-info.js`
- Create the info diff with `node dist/airspaces/create-tiles-info-diff.js`
- Run tests `nx reset`, `nx check`
- Sync the diff with `node dist/airspaces/upload-tiles-diff.js` (syncs tiles diff and `airspaces-date.json` to GCS)

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

_urls_

- 2D Tiles: `<https://airspaces.storage.googleapis.com/tiles/${z}/${x}/${y}.pbf>`
- Unclipped Tiles: `<https://airspaces.storage.googleapis.com/tiles/6/${x}/${y}-unclipped.pbf>`
- Date Metadata: `<https://airspaces.storage.googleapis.com/airspaces-date.json>`
