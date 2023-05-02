## Deploy

nx deploy fetcher --prod

## Docker

docker run -it gcr.io/fly-xc/fetcher bash

## Update the image

gcloud compute instances update-container fetcher --container-image gcr.io/fly-xc/fetcher:latest
