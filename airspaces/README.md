# Generate the vector tiles

Install [tippecanoe](https://github.com/mapbox/tippecanoe).

- npm run download
- npm run geojson
- npm run tiles

# Google Storage

*copy*
gsutil -h "Content-Type:application/x-protobuf" \
       -h "Cache-Control:public, max-age=360000" \
       -m cp -RZ tiles gs://airspaces

Z = serve file gzip encoded

*enable CORS*
$ gsutil cors set cors.json gs://airspaces

*public access*
$ gsutil iam ch allUsers:objectViewer gs://airspaces

*url*
https://airspaces.storage.googleapis.com/${z}/${x}/${y}.pbf