#!/usr/bin/env bash
# =============================================================================
# run-full-setup.sh — Complete one-shot GCP setup for EV Charger Simulator
#
# Pre-filled for:
#   Project : charge-point-simulator-1-6
#   Region  : us-central1
#
# BEFORE RUNNING — fill in the two placeholders marked with TODO below:
#   1. OCPP_SERVER_URL  — your full wss:// URL from the ev-server dashboard
#   2. RFID_ID_TAG      — an RFID tag authorised in your ev-server tenant
#
# HOW TO GET THOSE VALUES (ev-server dashboard):
#   OCPP_SERVER_URL:
#     1. Log in as Admin → Settings → Charging Stations → Registration Tokens
#     2. Create a new token (or use an existing one)
#     3. Copy the token ID (a MongoDB ObjectID string like 507f1f77bcf86cd799439011)
#     4. Your tenant ID is shown in Settings → General (or visible in the browser URL)
#     5. Combine: wss://your-ev-server-host/OCPP16/<TENANT_ID>/<TOKEN_ID>
#        Use ws:// (not wss://) if your server does not have TLS configured
#   RFID_ID_TAG:
#     1. Go to Tags in the dashboard
#     2. Use an existing active tag's ID, or create a new one
#
# HOW TO RUN:
#   1. Install gcloud CLI: https://cloud.google.com/sdk/docs/install
#   2. Run: gcloud auth login
#   3. Run: bash simulator/cloudrun/run-full-setup.sh
#
# =============================================================================

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────

PROJECT_ID="charge-point-simulator-1-6"
REGION="us-central1"
REPO="ev-simulator"
SA_NAME="ev-simulator-sa"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/ev-charger-sim"
SERVICE_NAME="ev-sim-boot"
GITHUB_OWNER=""       # TODO (optional): your GitHub org/username for Cloud Build trigger

# ── TODO: Fill these in before running ────────────────────────────────────────
# Format: wss://your-ev-server-host/OCPP16/<TENANT_ID>/<REGISTRATION_TOKEN_ID>
# Use ws:// if your server has no TLS. Example:
#   ws://54.12.34.56:8010/OCPP16/507f1f77bcf86cd799439011/507f1f77bcf86cd799439012
OCPP_SERVER_URL="PLACEHOLDER_SET_ME"

# An RFID tag ID from your ev-server (Tags section in the dashboard). Example: AABBCCDD
RFID_ID_TAG="PLACEHOLDER_SET_ME"

# ── Pre-flight checks ─────────────────────────────────────────────────────────

echo ""
echo "============================================================"
echo " EV Charger Simulator — Full GCP Setup"
echo " Project : $PROJECT_ID"
echo " Region  : $REGION"
echo "============================================================"
echo ""

if ! command -v gcloud &>/dev/null; then
  echo "ERROR: gcloud CLI not found."
  echo "Install it from: https://cloud.google.com/sdk/docs/install"
  exit 1
fi

if [[ "$OCPP_SERVER_URL" == "PLACEHOLDER_SET_ME" ]]; then
  echo "ERROR: OCPP_SERVER_URL has not been set."
  echo "Edit this script and replace PLACEHOLDER_SET_ME with your wss:// URL."
  echo "See the instructions at the top of this file."
  exit 1
fi

if [[ "$RFID_ID_TAG" == "PLACEHOLDER_SET_ME" ]]; then
  echo "ERROR: RFID_ID_TAG has not been set."
  echo "Edit this script and replace PLACEHOLDER_SET_ME with an RFID tag from your ev-server."
  exit 1
fi

# Confirm active account
ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | head -1)
if [[ -z "$ACTIVE_ACCOUNT" ]]; then
  echo "ERROR: Not authenticated. Run: gcloud auth login"
  exit 1
fi
echo "Authenticated as: $ACTIVE_ACCOUNT"
echo ""
gcloud config set project "$PROJECT_ID"

# ── Step 1: Enable APIs ───────────────────────────────────────────────────────

echo ">>> [1/8] Enabling GCP APIs..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  --project="$PROJECT_ID"
echo "    Done."

# ── Step 2: Artifact Registry ─────────────────────────────────────────────────

echo ">>> [2/8] Creating Artifact Registry repository: $REPO"
if gcloud artifacts repositories describe "$REPO" \
     --location="$REGION" --project="$PROJECT_ID" &>/dev/null; then
  echo "    Already exists — skipping."
else
  gcloud artifacts repositories create "$REPO" \
    --repository-format=docker \
    --location="$REGION" \
    --description="EV charger simulator container images" \
    --project="$PROJECT_ID"
  echo "    Created."
fi

echo "    Configuring Docker authentication for Artifact Registry..."
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet
echo "    Done."

# ── Step 3: Service account ───────────────────────────────────────────────────

echo ">>> [3/8] Creating service account: $SA_NAME"
if gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT_ID" &>/dev/null; then
  echo "    Already exists — skipping."
else
  gcloud iam service-accounts create "$SA_NAME" \
    --display-name="EV Simulator Cloud Run Service Account" \
    --project="$PROJECT_ID"
  echo "    Created."
fi

# ── Step 4: IAM roles ─────────────────────────────────────────────────────────

echo ">>> [4/8] Assigning IAM roles to service account..."

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor" \
  --condition=None --quiet

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/artifactregistry.reader" \
  --condition=None --quiet

PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
CB_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/run.admin" \
  --condition=None --quiet

gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/iam.serviceAccountUser" \
  --project="$PROJECT_ID" --quiet

echo "    Done."

# ── Step 5: Secrets ───────────────────────────────────────────────────────────

echo ">>> [5/8] Creating and populating Secret Manager secrets..."

# ev-sim-server-url
if gcloud secrets describe ev-sim-server-url --project="$PROJECT_ID" &>/dev/null; then
  echo "    ev-sim-server-url exists — adding new version..."
  echo -n "$OCPP_SERVER_URL" | \
    gcloud secrets versions add ev-sim-server-url \
      --data-file=- --project="$PROJECT_ID"
else
  echo "    Creating ev-sim-server-url..."
  echo -n "$OCPP_SERVER_URL" | \
    gcloud secrets create ev-sim-server-url \
      --data-file=- \
      --replication-policy=automatic \
      --project="$PROJECT_ID"
fi

# ev-sim-id-tag
if gcloud secrets describe ev-sim-id-tag --project="$PROJECT_ID" &>/dev/null; then
  echo "    ev-sim-id-tag exists — adding new version..."
  echo -n "$RFID_ID_TAG" | \
    gcloud secrets versions add ev-sim-id-tag \
      --data-file=- --project="$PROJECT_ID"
else
  echo "    Creating ev-sim-id-tag..."
  echo -n "$RFID_ID_TAG" | \
    gcloud secrets create ev-sim-id-tag \
      --data-file=- \
      --replication-policy=automatic \
      --project="$PROJECT_ID"
fi

echo "    Done."

# ── Step 6: Build and push Docker image ───────────────────────────────────────

echo ">>> [6/8] Building and pushing Docker image..."
echo "    (This requires Docker to be running locally)"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SIMULATOR_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

docker build \
  -f "$SIMULATOR_DIR/Dockerfile" \
  -t "${IMAGE}:latest" \
  "$SIMULATOR_DIR"

docker push "${IMAGE}:latest"
echo "    Image pushed: ${IMAGE}:latest"

# ── Step 7: Deploy Cloud Run boot service ─────────────────────────────────────

echo ">>> [7/8] Deploying Cloud Run boot service: $SERVICE_NAME"
gcloud run deploy "$SERVICE_NAME" \
  --image="${IMAGE}:latest" \
  --region="$REGION" \
  --platform=managed \
  --no-allow-unauthenticated \
  --service-account="$SA_EMAIL" \
  --min-instances=1 \
  --max-instances=1 \
  --cpu=1 \
  --memory=256Mi \
  --no-cpu-throttling \
  --timeout=3600 \
  --set-secrets="EV_SIM_SERVER_URL=ev-sim-server-url:latest,EV_SIM_ID_TAG=ev-sim-id-tag:latest" \
  --set-env-vars="EV_SIM_STATION_ID=SIM-CS-001,EV_SIM_VERBOSE=false" \
  --args=boot \
  --project="$PROJECT_ID"
echo "    Boot service deployed."

# ── Step 8: Create Cloud Run Jobs ─────────────────────────────────────────────

echo ">>> [8/8] Creating Cloud Run Jobs..."

upsert_job() {
  local JOB_NAME="$1"; shift
  if gcloud run jobs describe "$JOB_NAME" \
       --region="$REGION" --project="$PROJECT_ID" &>/dev/null; then
    echo "    Updating: $JOB_NAME"
    gcloud run jobs update "$JOB_NAME" "$@"
  else
    echo "    Creating: $JOB_NAME"
    gcloud run jobs create "$JOB_NAME" "$@"
  fi
}

# session — single end-to-end session
upsert_job ev-sim-session \
  --image="${IMAGE}:latest" \
  --region="$REGION" --project="$PROJECT_ID" \
  --service-account="$SA_EMAIL" \
  --cpu=1 --memory=256Mi \
  --task-timeout=3600 --max-retries=0 \
  --set-secrets="EV_SIM_SERVER_URL=ev-sim-server-url:latest,EV_SIM_ID_TAG=ev-sim-id-tag:latest" \
  --set-env-vars="EV_SIM_STATION_ID=SIM-CS-001,EV_SIM_DURATION_MINS=5,EV_SIM_ACCELERATED=true,EV_SIM_VERBOSE=false" \
  --args=session

# multi — all connectors simultaneously
upsert_job ev-sim-multi \
  --image="${IMAGE}:latest" \
  --region="$REGION" --project="$PROJECT_ID" \
  --service-account="$SA_EMAIL" \
  --cpu=1 --memory=256Mi \
  --task-timeout=3600 --max-retries=0 \
  --set-secrets="EV_SIM_SERVER_URL=ev-sim-server-url:latest" \
  --set-env-vars="EV_SIM_STATION_ID=SIM-CS-001,EV_SIM_ID_TAGS=AABBCCDD\,11223344,EV_SIM_DURATION_MINS=5,EV_SIM_ACCELERATED=true,EV_SIM_VERBOSE=false" \
  --args=multi

# fleet — 10 chargers in parallel
upsert_job ev-sim-fleet \
  --image="${IMAGE}:latest" \
  --region="$REGION" --project="$PROJECT_ID" \
  --service-account="$SA_EMAIL" \
  --cpu=2 --memory=512Mi \
  --task-timeout=3600 --max-retries=0 \
  --set-secrets="EV_SIM_SERVER_URL=ev-sim-server-url:latest,EV_SIM_ID_TAG=ev-sim-id-tag:latest" \
  --set-env-vars="EV_SIM_STATION_ID=SIM-CS,EV_SIM_FLEET_COUNT=10,EV_SIM_DURATION_MINS=30,EV_SIM_ACCELERATED=true,EV_SIM_VERBOSE=false" \
  --args=fleet

echo "    Done."

# ── Cloud Build trigger (manual — requires browser) ───────────────────────────

echo ""
echo "============================================================"
echo " Setup complete!"
echo "============================================================"
echo ""
echo " Boot service (always-on charger) is live:"
gcloud run services describe "$SERVICE_NAME" \
  --region="$REGION" --project="$PROJECT_ID" \
  --format="value(status.url)" 2>/dev/null || true
echo ""
echo " Run a test session:"
echo "   gcloud run jobs execute ev-sim-session --region=$REGION --project=$PROJECT_ID --wait"
echo ""
echo " Run a fleet simulation (10 chargers):"
echo "   gcloud run jobs execute ev-sim-fleet --region=$REGION --project=$PROJECT_ID --wait"
echo ""
echo " View live logs:"
echo "   gcloud run services logs tail $SERVICE_NAME --region=$REGION --project=$PROJECT_ID"
echo ""
echo " OPTIONAL — Connect GitHub for auto-deploy on git push:"
echo "   Open: https://console.cloud.google.com/cloud-build/triggers?project=$PROJECT_ID"
echo "   Create trigger → Repository: your-org/ev-server"
echo "   Branch: ^main\$  |  Config file: simulator/cloudbuild.yaml"
echo ""
