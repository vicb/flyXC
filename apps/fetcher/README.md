# FlyXC Fetcher

Fetcher is a background service that continuously polls live tracking devices and updates datastore. It runs in a container on a Google Compute Engine VM using Container-Optimized OS (COS) and is managed via `systemd` and `cloud-init`.

## Build & Deploy

To build the container image and restart the service on the running VM:

```bash
pnpm nx deploy fetcher
```

## Infrastructure & VM Management

### 1. Create or Update the Instance Template

The instance template uses `cloud-config.yaml` to define the `systemd` service:

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

To spin up a new VM instance from the template:

```bash
pnpm nx create-vm fetcher
```

Equivalent `gcloud` command:

```bash
gcloud compute instances create fetcher \
  --source-instance-template=fetcher-tmpl \
  --zone=us-central1-a
```

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

# Delete the VM instance
gcloud compute instances delete fetcher --zone=us-central1-a --quiet
```
