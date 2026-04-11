#!/usr/bin/env bash
# =============================================================================
# jobs.sh — Create Cloud Run Jobs for one-shot simulator modes
#
# Run this once after setup.sh, after the first image has been pushed to
# Artifact Registry (i.e. after the first successful Cloud Build).
#
# Each job definition is idempotent: re-running updates the job if it exists.
#
# Usage:
#   export PROJECT_ID=your-gcp-project-id
#   export REGION=europe-west1
#   bash simulator/cloudrun/jobs.sh
#
# To execute a job manually:
#   gcloud run jobs execute ev-sim-session --region=$REGION --wait
#   gcloud run jobs execute ev-sim-multi   --region=$REGION --wait
#   gcloud run jobs execute ev-sim-fleet   --region=$REGION --wait
#
# To override env vars for a specific run:
#   gcloud run jobs execute ev-sim-fleet \
#     --region=$REGION --wait \
#     --update-env-vars="EV_SIM_FLEET_COUNT=25,EV_SIM_DURATION_MINS=10"
# =============================================================================

set -euo pipefail

PROJECT_ID="${PROJECT_ID:?Set PROJECT_ID environment variable}"
REGION="${REGION:-europe-west1}"
REPO="ev-simulator"
SA_EMAIL="ev-simulator-sa@${PROJECT_ID}.iam.gserviceaccount.com"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/ev-charger-sim:latest"

echo "=== Creating Cloud Run Jobs ==="
echo "  Project : $PROJECT_ID"
echo "  Region  : $REGION"
echo "  Image   : $IMAGE"
echo ""

# Helper: create-or-update a Cloud Run Job
upsert_job() {
  local JOB_NAME="$1"
  shift

  if gcloud run jobs describe "$JOB_NAME" --region="$REGION" --project="$PROJECT_ID" &>/dev/null; then
    echo ">>> Updating job: $JOB_NAME"
    gcloud run jobs update "$JOB_NAME" "$@"
  else
    echo ">>> Creating job: $JOB_NAME"
    gcloud run jobs create "$JOB_NAME" "$@"
  fi
}

# ── Job: session ──────────────────────────────────────────────────────────────
# Runs a single end-to-end charging session on connector 1 then exits.
# Default: 5 simulated minutes in accelerated mode (completes in ~5 real seconds).
upsert_job ev-sim-session \
  --image="$IMAGE" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --service-account="$SA_EMAIL" \
  --cpu=1 \
  --memory=256Mi \
  --task-timeout=3600 \
  --max-retries=0 \
  --set-secrets="EV_SIM_SERVER_URL=ev-sim-server-url:latest,EV_SIM_ID_TAG=ev-sim-id-tag:latest" \
  --set-env-vars="EV_SIM_STATION_ID=SIM-CS-001,EV_SIM_DURATION_MINS=5,EV_SIM_ACCELERATED=true,EV_SIM_VERBOSE=false" \
  --args=session

# ── Job: multi ────────────────────────────────────────────────────────────────
# Starts sessions on ALL connectors simultaneously, waits, then stops all.
# Tests smart charging, per-connector billing, and load balancing.
upsert_job ev-sim-multi \
  --image="$IMAGE" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --service-account="$SA_EMAIL" \
  --cpu=1 \
  --memory=256Mi \
  --task-timeout=3600 \
  --max-retries=0 \
  --set-secrets="EV_SIM_SERVER_URL=ev-sim-server-url:latest" \
  --set-env-vars="EV_SIM_STATION_ID=SIM-CS-001,EV_SIM_ID_TAGS=AABBCCDD\,11223344,EV_SIM_DURATION_MINS=5,EV_SIM_ACCELERATED=true,EV_SIM_VERBOSE=false" \
  --args=multi

# ── Job: fleet ────────────────────────────────────────────────────────────────
# Spawns N independent charger instances in parallel (default: 10).
# Each gets its own WebSocket connection and charging session.
# Charger IDs are: SIM-CS-01 through SIM-CS-10.
# 2 CPU / 512Mi to support 10 concurrent WebSocket connections.
upsert_job ev-sim-fleet \
  --image="$IMAGE" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --service-account="$SA_EMAIL" \
  --cpu=2 \
  --memory=512Mi \
  --task-timeout=3600 \
  --max-retries=0 \
  --set-secrets="EV_SIM_SERVER_URL=ev-sim-server-url:latest,EV_SIM_ID_TAG=ev-sim-id-tag:latest" \
  --set-env-vars="EV_SIM_STATION_ID=SIM-CS,EV_SIM_FLEET_COUNT=10,EV_SIM_DURATION_MINS=30,EV_SIM_ACCELERATED=true,EV_SIM_VERBOSE=false" \
  --args=fleet

echo ""
echo "=== Jobs created successfully ==="
echo ""
echo "Execute a job:"
echo "  gcloud run jobs execute ev-sim-session --region=$REGION --wait --project=$PROJECT_ID"
echo "  gcloud run jobs execute ev-sim-multi   --region=$REGION --wait --project=$PROJECT_ID"
echo "  gcloud run jobs execute ev-sim-fleet   --region=$REGION --wait --project=$PROJECT_ID"
echo ""
echo "Override settings for a specific run:"
echo "  gcloud run jobs execute ev-sim-fleet \\"
echo "    --region=$REGION --wait --project=$PROJECT_ID \\"
echo "    --update-env-vars='EV_SIM_FLEET_COUNT=25,EV_SIM_DURATION_MINS=10'"
echo ""
echo "View logs:"
echo "  gcloud logging read 'resource.type=cloud_run_job AND resource.labels.job_name=ev-sim-fleet' \\"
echo "    --project=$PROJECT_ID --limit=100 --format='value(textPayload)'"
