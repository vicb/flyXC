## Docker

- docker build . --tag gcr.io/fly-xc/trackers
- docker push gcr.io/fly-xc/trackers
- gcloud run deploy trackers --image gcr.io/fly-xc/trackers --platform managed

## Test

PORT=8081 && docker run -it -p 8080:${PORT} -e PORT=${PORT} gcr.io/fly-xc/trackers

curl -X POST http://localhost:8081/process \
 -H 'Content-Type: application/json' \
 -d "{\"message\": {\"data\": \"$(echo -n '{"id": "TRACK_ID"}' | base64 -w0)\"}}"
