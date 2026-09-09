# FlyXC Proxy

The Proxy service runs in a lightweight container on temporary Google Compute Engine VMs using Container-Optimized OS (COS). Proxy VMs are created and terminated dynamically by `fetcher` ([`apps/fetcher/src/app/trackers/proxy.ts`](../fetcher/src/app/trackers/proxy.ts)) using the `proxy-tmpl` instance template when upstream APIs (such as Garmin InReach) return HTTP 429 rate-limit responses.

The proxy uses an Alpine-based Node.js container image (~50MB) to ensure minimal image size and fast boot-to-ready startup (~20–25s total, of which image pull is only ~3–5s).

---

## 1. Build & Deploy Container

Whenever proxy code, dependencies, or the Dockerfile change, build and push the container image to Google Artifact Registry:

```bash
pnpm nx container proxy
```

> **Note:** For almost all day-to-day development, **pushing the container image is all you need**. Because proxy VMs are ephemeral, newly created VMs pull `:latest` from Artifact Registry upon booting and automatically run the latest version.

---

## 2. Instance Template Management

Proxy VMs are launched dynamically using the `proxy-tmpl` GCE instance template.

### When to Update the Template

You only need to update the instance template when changing the **VM-level infrastructure or boot configuration**:

- Modifying [`apps/proxy/cloud-config.yaml`](cloud-config.yaml) (systemd settings, environment variables, or docker arguments).
- Changing VM machine type (e.g., from `f1-micro` to `e2-micro`).
- Updating the base OS image family (`cos-stable`), disk size/type, service account scopes, or network tags.
- Initial setup in a new GCP environment where `proxy-tmpl` does not exist yet.

### Create or Refresh the Instance Template

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

---

## 3. Verification & Troubleshooting

The proxy operates as an HTTP forward proxy on port 80 supporting HTTPS CONNECT tunneling, authenticated with `Proxy-Authorization: Bearer <PROXY_KEY>`.

### Check Active Proxy VMs

When `fetcher` detects a 429 rate limit, it creates an ephemeral proxy VM with the label `proxy=*`:

```bash
# List active proxy instances across all zones
gcloud compute instances list --filter="labels.proxy:*"

# Check systemd service status on a running proxy VM
gcloud compute ssh <PROXY_VM_NAME> --zone=<ZONE> --command="sudo systemctl status proxy.service"

# View live proxy container logs on a running proxy VM
gcloud compute ssh <PROXY_VM_NAME> --zone=<ZONE> --command="docker logs -f proxy"
```

### Test Proxy Connectivity with curl

```bash
# Test tunneling an HTTPS request through the proxy VM
curl -i -x http://<PROXY_IP>:80 \
  --proxy-header "Proxy-Authorization: Bearer <PROXY_KEY>" \
  https://share.garmin.com/
```
