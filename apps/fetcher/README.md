# FlyXC Fetcher

Fetcher is a background service that continuously polls live tracking devices and updates datastore. It runs in a container on a Google Compute Engine VM using Container-Optimized OS (COS) and is managed via `systemd` and `cloud-init`.

## Build & Deploy

To build the container image and restart the service on the running VM:

```bash
pnpm nx deploy fetcher
```

> **Note:** On every deployment and service restart, the service automatically pulls the latest image and prunes previous dangling images to reclaim disk space.

## Infrastructure & VM Management

### 1. Create or Update the Instance Template

The instance template uses `cloud-config.yaml` to define the VM specification and `systemd` service.

#### When to Update the Template

You only need to update the instance template when changing **VM-level infrastructure or boot configuration**:

- Modifying [`apps/fetcher/cloud-config.yaml`](cloud-config.yaml) (systemd service settings, restart policies, or Docker arguments).
- Changing VM machine type (e.g., from `e2-micro` to `e2-small`).
- Updating base OS image family (`cos-stable`), disk size/type, service account scopes, or logging options.
- Initial setup in a new GCP environment where `fetcher-tmpl` does not yet exist.

> **Important:** Because `fetcher` runs on a persistent VM, updating `fetcher-tmpl` does **not** modify the existing running VM. To apply template or `cloud-config.yaml` changes, delete the existing instance and recreate it (`pnpm nx create-vm fetcher`). For application code changes, use `pnpm nx deploy fetcher` instead.

```bash
pnpm nx create-template fetcher
```

Equivalent `gcloud` command:

```bash
gcloud compute instance-templates delete fetcher-tmpl --quiet || true
gcloud compute instance-templates create fetcher-tmpl \
  --machine-type=e2-micro \
  --image-family=cos-stable \
  --image-project=cos-cloud \
  --boot-disk-size=10GB \
  --boot-disk-type=pd-balanced \
  --scopes=cloud-platform \
  --metadata=google-logging-enabled=true,google-logging-use-fluentbit=true \
  --metadata-from-file=user-data=apps/fetcher/cloud-config.yaml
```

### 2. Create the VM

To spin up a new VM instance from the `fetcher-tmpl` template:

```bash
pnpm nx create-vm fetcher
```

Equivalent `gcloud` command:

```bash
gcloud compute instances create fetcher \
  --source-instance-template=fetcher-tmpl \
  --zone=us-central1-a
```

#### When to Run This

- **Initial Setup**: First-time deployment in a new GCP environment.
- **Disaster Recovery**: Recreating the VM if it was terminated or suffered an unrecoverable failure.
- **Applying Infrastructure Updates**: When you modified `fetcher-tmpl` (e.g. changed machine type, disk size, or `cloud-config.yaml`) and need a fresh VM to inherit those changes.

### 3. Verify It's Running

Wait ~30–60s after VM creation for COS to boot, pull the container image, and start the systemd service:

```bash
# Check systemd service status
gcloud compute ssh fetcher --zone=us-central1-a --command="sudo systemctl status fetcher.service"

# View live container logs
gcloud compute ssh fetcher --zone=us-central1-a --command="docker logs -f fetcher"

# View systemd journal logs on the VM
gcloud compute ssh fetcher --zone=us-central1-a --command="sudo journalctl -u fetcher.service -f"
```

### 4. Useful Operations

```bash
# SSH into the VM
gcloud compute ssh fetcher --zone=us-central1-a

# Restart the service (pulls latest image and starts container)
gcloud compute ssh fetcher --zone=us-central1-a --command="sudo systemctl restart fetcher.service"

# List Docker images
gcloud compute ssh fetcher --zone=us-central1-a --command="sudo docker images"

# Check Docker disk space usage
gcloud compute ssh fetcher --zone=us-central1-a --command="sudo docker system df"

# Reclaim space manually by deleting old/dangling images
# Note: also done automatically on every deployment
gcloud compute ssh fetcher --zone=us-central1-a --command="sudo docker image prune -f"

# Delete the VM instance
gcloud compute instances delete fetcher --zone=us-central1-a --quiet
```

### 5. Roll Back to an Older Image

Because the VM pulls `:latest`, the cleanest way to roll back is to re-tag the desired older image digest as `latest` in Artifact Registry:

```bash
# 1. List available image digests sorted by date
gcloud artifacts docker images list us-docker.pkg.dev/fly-xc/docker/fetcher \
  --sort-by=~UPDATE_TIME \
  --include-tags

# 2. Re-tag the chosen older digest as 'latest'
gcloud artifacts docker tags add \
  us-docker.pkg.dev/fly-xc/docker/fetcher@sha256:<DIGEST> \
  us-docker.pkg.dev/fly-xc/docker/fetcher:latest

# 3. Restart the service on the VM to pull and run it
gcloud compute ssh fetcher --zone=us-central1-a --command="sudo systemctl restart fetcher.service"
```
