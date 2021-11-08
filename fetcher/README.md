## Docker

docker run -it gcr.io/fly-xc/fetch bash

## Update the image

gcloud compute instances update-container fetcher --container-image  gcr.io/fly-xc/fetcher:latest
