#!/usr/bin/env bash
# =============================================================================
# setup.sh — One-time GCP bootstrap for the EV Charger Simulator
#
# Run this once from your local machine before the first deploy.
# Prerequisites:
#   - gcloud CLI authenticated: gcloud auth login
#   - Target project set:       gcloud config set project YOUR_PROJECT_ID
#   - Required APIs enabled (script enables them below)
#
# Usage:
#   export PROJECT_ID=your-gcp-project-id
#   export REGION=europe-west1          # change if needed
#   bash simulator/cloudrun/setup.sh
# =============================================================================

set -euo pipefail

PROJECT_ID="${PROJECT_ID:?Set PROJECT_ID environment variable}"
REGION="${REGION:-europe-west1}"
REPO="ev-simulator"
SA_NAME="ev-simulator-sa"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "=== EV Simulator — GCP Bootstrap ==="
echo "  Project : $PROJECT_ID"
echo "  Region  : $REGION"
echo ""

# ── 1. Enable required APIs ───────────────────────────────────────────────────
echo ">>> Enabling GCP APIs..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  --project="$PROJECT_ID"

# ── 2. Artifact Registry repository ──────────────────────────────────────────
echo ">>> Creating Artifact Registry repository: $REPO"
gcloud artifacts repositories create "$REPO" \
  --repository-format=docker \
  --location="$REGION" \
  --description="EV charger simulator container images" \
  --project="$PROJECT_ID" 2>/dev/null || echo "    (already exists — skipping)"

# Configure local Docker to authenticate with Artifact Registry
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

# ── 3. Service account ────────────────────────────────────────────────────────
echo ">>> Creating service account: $SA_NAME"
gcloud iam service-accounts create "$SA_NAME" \
  --display-name="EV Simulator Cloud Run Service Account" \
  --project="$PROJECT_ID" 2>/dev/null || echo "    (already exists — skipping)"

# Grant Secret Manager access (reads ev-sim-server-url and ev-sim-id-tag)
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor" \
  --condition=None

# Grant Artifact Registry read access (pull images)
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/artifactregistry.reader" \
  --condition=None

# ── 4. Cloud Build service account permissions ─────────────────────────────────
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
CB_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

echo ">>> Granting Cloud Build SA permissions..."

# Allows Cloud Build to deploy Cloud Run revisions
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/run.admin" \
  --condition=None

# Allows Cloud Build to act as the simulator service account during deployment
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/iam.serviceAccountUser" \
  --project="$PROJECT_ID"

# ── 5. Secret Manager secrets ─────────────────────────────────────────────────
echo ""
echo ">>> Creating Secret Manager secrets..."
echo ""
echo "    You need two values:"
echo "    1. The full OCPP WebSocket URL:"
echo "       wss://your-ev-server.com/OCPP16/<TENANT_ID>/<REGISTRATION_TOKEN_ID>"
echo "    2. An RFID tag ID (idTag) for boot-mode remote sessions"
echo ""

# Create the secrets (empty — you populate them below)
gcloud secrets create ev-sim-server-url \
  --replication-policy=automatic \
  --project="$PROJECT_ID" 2>/dev/null || echo "    ev-sim-server-url already exists — skipping create"

gcloud secrets create ev-sim-id-tag \
  --replication-policy=automatic \
  --project="$PROJECT_ID" 2>/dev/null || echo "    ev-sim-id-tag already exists — skipping create"

echo ""
echo ">>> ACTION REQUIRED — populate the secrets:"
echo ""
echo "    # Set the OCPP server URL (contains tenant ID + registration token):"
echo "    echo -n 'wss://your-ev-server.com/OCPP16/TENANT_ID/TOKEN_ID' | \\"
echo "      gcloud secrets versions add ev-sim-server-url --data-file=- --project=$PROJECT_ID"
echo ""
echo "    # Set the RFID tag used for boot-mode sessions:"
echo "    echo -n 'AABBCCDD' | \\"
echo "      gcloud secrets versions add ev-sim-id-tag --data-file=- --project=$PROJECT_ID"
echo ""

# ── 6. Cloud Build trigger ───────────────────────────────────────────────────
echo ">>> Cloud Build trigger setup..."
echo ""
echo "    Connect your GitHub repository to Cloud Build via the GCP Console:"
echo "    https://console.cloud.google.com/cloud-build/triggers"
echo ""
echo "    Then create a trigger with these settings:"
echo "      Repository  : your-org/ev-server"
echo "      Branch      : ^main$"
echo "      Config type : Cloud Build configuration file"
echo "      Location    : simulator/cloudbuild.yaml"
echo ""
echo "    Or use gcloud (replace YOUR_GITHUB_ORG with your GitHub org/user):"
echo ""
echo "    gcloud builds triggers create github \\"
echo "      --repo-name=ev-server \\"
echo "      --repo-owner=YOUR_GITHUB_ORG \\"
echo "      --branch-pattern='^main$' \\"
echo "      --build-config=simulator/cloudbuild.yaml \\"
echo "      --substitutions='_PROJECT_ID=${PROJECT_ID},_REGION=${REGION}' \\"
echo "      --project=$PROJECT_ID"
echo ""

# ── Done ──────────────────────────────────────────────────────────────────────
echo "=== Bootstrap complete ==="
echo ""
echo "Next steps:"
echo "  1. Populate the two secrets above (ev-sim-server-url, ev-sim-id-tag)"
echo "  2. Connect the GitHub repository and create the Cloud Build trigger"
echo "  3. Push to main — Cloud Build will build, push, and deploy the boot service"
echo "  4. Run:  bash simulator/cloudrun/jobs.sh  to create the one-shot Job definitions"
echo ""
echo "Image will be at:"
echo "  ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/ev-charger-sim:latest"
