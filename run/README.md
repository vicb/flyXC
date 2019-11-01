## Docker

- docker build . --tag gcr.io/fly-xc/trackers
- docker push gcr.io/fly-xc/trackers
- gcloud beta run deploy trackers --image gcr.io/fly-xc/trackers --platform managed

## Test

PORT=8081 && docker run -p 8080:${PORT} -e PORT=${PORT} gcr.io/fly-xc/trackers