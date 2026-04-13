# GCP Deployment Guide

This guide covers everything needed to deploy the EV Charger Simulator on Google Cloud Platform.

---

## Architecture

| GCP Service | Resource | Purpose |
|---|---|---|
| **Artifact Registry** | `ev-simulator` | Docker image storage, SHA-tagged per build |
| **Cloud Build** | Trigger on `main` | Auto-build → push → deploy on every git push |
| **Cloud Run Service** | `ev-sim-boot` | Always-on 24/7 charger daemon (min=1, max=1) |
| **Cloud Run Jobs** | `ev-sim-session`, `ev-sim-multi`, `ev-sim-fleet` | On-demand one-shot test runs |
| **Secret Manager** | `ev-sim-server-url`, `ev-sim-id-tag` | OCPP server URL + RFID tag |
| **Cloud Logging** | *(automatic)* | All stdout/stderr from containers |
| **Cloud Monitoring** | 1 alert policy | Alert when boot service drops to 0 instances |

The simulator connects **outbound** to an external ev-server via WebSocket (OCPP 1.6J). It serves no inbound traffic. No VPC connector is required.

---

## Configuration Reference

### Required values — you must provide these

| Value | Where to set it | How to get it |
|---|---|---|
| **GCP Project ID** | `PROJECT_ID` env var when running scripts | GCP Console → top nav dropdown, or `gcloud projects list` |
| **GCP Region** | `REGION` env var when running scripts | Choose one close to your ev-server, e.g. `europe-west1` |
| **OCPP Server URL** | Secret Manager: `ev-sim-server-url` | ev-server dashboard → Settings → Charging Stations → Registration Tokens. Format: `wss://your-host/OCPP16/<TENANT_ID>/<TOKEN_ID>` |
| **RFID Tag** | Secret Manager: `ev-sim-id-tag` | ev-server dashboard → Tags. Use an existing active tag ID, e.g. `AABBCCDD` |

### `cloudbuild.yaml` — edit once before first deploy

Open `cloudbuild.yaml` and update the `substitutions` block at the top:

```yaml
substitutions:
  _REGION: europe-west1          # ← your GCP region
  _PROJECT_ID: YOUR_PROJECT_ID   # ← your GCP project ID
  _REPO: ev-simulator            # leave as-is
  _SERVICE_NAME: ev-sim-boot     # leave as-is
  _SA: ev-simulator-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com  # ← replace YOUR_PROJECT_ID
```

### `cloudrun/run-full-setup.sh` — edit before running (if using the all-in-one script)

```bash
PROJECT_ID="your-gcp-project-id"          # ← your GCP project ID
REGION="europe-west1"                      # ← your GCP region
OCPP_SERVER_URL="wss://your-host/OCPP16/TENANT_ID/TOKEN_ID"  # ← your OCPP URL
RFID_ID_TAG="AABBCCDD"                    # ← your RFID tag
```

### Optional overrides — all have working defaults

| Environment variable | Default | Controls |
|---|---|---|
| `EV_SIM_STATION_ID` | `SIM-CS-001` | Charger ID registered in ev-server |
| `EV_SIM_FLEET_COUNT` | `10` | Number of parallel chargers in fleet mode |
| `EV_SIM_DURATION_MINS` | `5` (session/multi) · `30` (fleet) | Simulated session length in minutes |
| `EV_SIM_ACCELERATED` | `true` | 1 simulated minute = 1 real second |
| `EV_SIM_VERBOSE` | `false` | Log all raw OCPP messages |

Override these per job execution without changing the job definition:
```bash
gcloud run jobs execute ev-sim-fleet \
  --region=europe-west1 --project=YOUR_PROJECT_ID --wait \
  --update-env-vars="EV_SIM_FLEET_COUNT=25,EV_SIM_DURATION_MINS=10"
```

---

## Getting the OCPP Server URL and RFID Tag

### OCPP Server URL

1. Log into the ev-server dashboard as Admin
2. Go to **Settings → Charging Stations → Registration Tokens**
3. Create a new token (or use an existing one) — copy the **Token ID**
4. Find your **Tenant ID** in Settings → General (also visible in the browser URL)
5. Combine: `wss://your-ev-server-host/OCPP16/<TENANT_ID>/<TOKEN_ID>`
   - Use `ws://` instead of `wss://` if your server does not have TLS

Example:
```
wss://charging.example.com/OCPP16/507f1f77bcf86cd799439011/507f1f77bcf86cd799439012
```

### RFID Tag

1. Go to **Tags** in the ev-server dashboard
2. Use an existing active tag's ID, or create a new one
3. The ID is typically a hex string like `AABBCCDD` or a longer alphanumeric value

---

## Deployment Steps

### Step 1 — One-time infrastructure setup

```bash
export PROJECT_ID=your-gcp-project-id
export REGION=europe-west1

bash cloudrun/setup.sh
```

This enables the required GCP APIs, creates the Artifact Registry repository, service account, IAM roles, and empty Secret Manager secrets.

### Step 2 — Populate secrets

```bash
# OCPP server URL (contains your tenant ID + registration token)
echo -n 'wss://your-host/OCPP16/TENANT_ID/TOKEN_ID' | \
  gcloud secrets versions add ev-sim-server-url --data-file=- --project=$PROJECT_ID

# RFID tag ID
echo -n 'AABBCCDD' | \
  gcloud secrets versions add ev-sim-id-tag --data-file=- --project=$PROJECT_ID
```

### Step 3 — Connect GitHub to Cloud Build *(browser — one-time)*

1. Open: **GCP Console → Cloud Build → Triggers**
2. Click **Connect Repository** → authenticate with GitHub → select `charging-simulator`
3. Create a trigger:
   - **Branch:** `^main$`
   - **Config file:** `cloudbuild.yaml`

Or via CLI after connecting the GitHub App:
```bash
gcloud builds triggers create github \
  --repo-name=charging-simulator \
  --repo-owner=YOUR_GITHUB_ORG \
  --branch-pattern='^main$' \
  --build-config=cloudbuild.yaml \
  --substitutions="_PROJECT_ID=${PROJECT_ID},_REGION=${REGION}" \
  --project=$PROJECT_ID
```

### Step 4 — First deploy

Update `cloudbuild.yaml` substitutions (see above), then push to `main`:

```bash
git push origin main
```

Cloud Build will build the Docker image, push it to Artifact Registry, and deploy the `ev-sim-boot` Cloud Run service.

### Step 5 — Create Cloud Run Jobs

Run once after the first image has been pushed:

```bash
export PROJECT_ID=your-gcp-project-id
export REGION=europe-west1

bash cloudrun/jobs.sh
```

This creates the `ev-sim-session`, `ev-sim-multi`, and `ev-sim-fleet` job definitions. Cloud Build will update them automatically on every subsequent push.

### Step 6 — Set up monitoring *(optional but recommended)*

```bash
export PROJECT_ID=your-gcp-project-id
export REGION=europe-west1
export ALERT_EMAIL=you@example.com

bash cloudrun/monitoring.sh
```

Creates an email alert that fires when the boot service has 0 active instances for ≥5 minutes.

---

## Running Test Jobs

```bash
# Single end-to-end session (completes in ~5 real seconds with accelerated time)
gcloud run jobs execute ev-sim-session --region=$REGION --project=$PROJECT_ID --wait

# All connectors simultaneously (tests smart charging / load balancing)
gcloud run jobs execute ev-sim-multi --region=$REGION --project=$PROJECT_ID --wait

# Fleet of 10 chargers in parallel (load / stress test)
gcloud run jobs execute ev-sim-fleet --region=$REGION --project=$PROJECT_ID --wait
```

Override settings for a one-off run without changing the job definition:
```bash
gcloud run jobs execute ev-sim-fleet \
  --region=$REGION --project=$PROJECT_ID --wait \
  --update-env-vars="EV_SIM_FLEET_COUNT=50,EV_SIM_DURATION_MINS=10"
```

---

## Viewing Logs

```bash
# Live logs from the boot service (always-on daemon)
gcloud run services logs tail ev-sim-boot --region=$REGION --project=$PROJECT_ID

# Logs from the last fleet job execution
gcloud logging read \
  'resource.type=cloud_run_job AND resource.labels.job_name=ev-sim-fleet' \
  --project=$PROJECT_ID --limit=100 --format='value(textPayload)'
```

---

## Verifying the Deployment

```bash
# 1. Boot service is healthy and has 1 running instance
gcloud run services describe ev-sim-boot --region=$REGION --project=$PROJECT_ID \
  --format="table(status.conditions[0].status, status.observedGeneration)"

# 2. Logs show a successful BootNotification handshake
gcloud run services logs tail ev-sim-boot --region=$REGION --project=$PROJECT_ID
# Look for: BootNotification → status=Accepted

# 3. Session job runs and exits cleanly
gcloud run jobs execute ev-sim-session --region=$REGION --project=$PROJECT_ID --wait
# Exit code 0 = success

# 4. Alert policy exists
gcloud alpha monitoring policies list --project=$PROJECT_ID \
  --filter="displayName='ev-sim-boot: zero instances'"
```

---

## Scripts Reference

| Script | Run when | What it does |
|---|---|---|
| `cloudrun/setup.sh` | Once, before first deploy | Enables APIs, creates Artifact Registry repo, service account, IAM roles, empty secrets |
| `cloudrun/run-full-setup.sh` | Alternative to setup.sh | All-in-one: setup + local docker build + deploy boot service + create jobs |
| `cloudrun/jobs.sh` | Once, after first image push | Creates/updates the 3 Cloud Run Job definitions |
| `cloudrun/monitoring.sh` | Once, after setup | Creates Cloud Monitoring email alert for boot service health |
| `cloudbuild.yaml` | Auto-triggered by Cloud Build | Build image → push to Artifact Registry → deploy boot service → update jobs |
