# FlyXC Proxy

The Proxy service runs in a container on temporary Google Compute Engine VMs using Container-Optimized OS (COS). Proxy VMs are created and terminated dynamically by `fetcher` ([`apps/fetcher/src/app/trackers/proxies.ts`](file:///home/victor/code/flyXC/apps/fetcher/src/app/trackers/proxies.ts)) using the `proxy-tmpl` instance template.

## Build & Deploy Image

To build and push the container image to Artifact Registry:

```bash
pnpm nx container proxy
```

## Instance Template Management

Proxy VMs are started dynamically using the `proxy-tmpl` template.

### Create or Update the Instance Template

```bash
pnpm nx create-template proxy
```

Equivalent `gcloud` command:

```bash
gcloud compute instance-templates delete proxy-tmpl --quiet || true
gcloud compute instance-templates create proxy-tmpl \
  --machine-type=f1-micro \
  --image-family=cos-stable \
  --image-project=cos-cloud \
  --boot-disk-size=10GB \
  --boot-disk-type=pd-balanced \
  --tags=http-server \
  --scopes=cloud-platform \
  --metadata=google-logging-enabled=true,google-logging-use-fluentbit=true \
  --metadata-from-file=user-data=apps/proxy/cloud-config.yaml
```

## Verification & Troubleshooting

If a proxy VM is running (created by fetcher), you can check its status:

```bash
# List active proxy instances
gcloud compute instances list --filter="labels.proxy:*"

# Check systemd status on a running proxy VM
gcloud compute ssh <PROXY_VM_NAME> --zone=<ZONE> --command="sudo systemctl status proxy.service"

# View proxy container logs on a running proxy VM
gcloud compute ssh <PROXY_VM_NAME> --zone=<ZONE> --command="docker logs -f proxy"
```
