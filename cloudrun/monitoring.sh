#!/usr/bin/env bash
# =============================================================================
# monitoring.sh — Cloud Monitoring alert for the EV Charger Simulator boot service
#
# Creates:
#   1. An email notification channel
#   2. An alert policy that fires when ev-sim-boot has 0 running instances
#      for 5 consecutive minutes (i.e. the service has crashed or stalled)
#
# Prerequisites:
#   - setup.sh has been run (monitoring.googleapis.com API enabled)
#   - gcloud CLI authenticated: gcloud auth login
#
# Usage:
#   export PROJECT_ID=your-gcp-project-id
#   export ALERT_EMAIL=you@example.com
#   export REGION=europe-west1          # must match your Cloud Run region
#   bash cloudrun/monitoring.sh
# =============================================================================

set -euo pipefail

PROJECT_ID="${PROJECT_ID:?Set PROJECT_ID environment variable}"
ALERT_EMAIL="${ALERT_EMAIL:?Set ALERT_EMAIL environment variable}"
REGION="${REGION:-europe-west1}"
SERVICE_NAME="ev-sim-boot"

echo "=== EV Simulator — Cloud Monitoring Setup ==="
echo "  Project : $PROJECT_ID"
echo "  Region  : $REGION"
echo "  Alert → : $ALERT_EMAIL"
echo ""

# ── 1. Create email notification channel ─────────────────────────────────────
echo ">>> Creating email notification channel for $ALERT_EMAIL..."

CHANNEL_ID=$(gcloud alpha monitoring channels create \
  --display-name="EV Simulator Alerts" \
  --type=email \
  --channel-labels="email_address=${ALERT_EMAIL}" \
  --project="$PROJECT_ID" \
  --format="value(name)" 2>/dev/null | awk -F/ '{print $NF}')

if [[ -z "$CHANNEL_ID" ]]; then
  # Channel may already exist — look it up
  CHANNEL_ID=$(gcloud alpha monitoring channels list \
    --filter="displayName='EV Simulator Alerts'" \
    --project="$PROJECT_ID" \
    --format="value(name)" | head -1 | awk -F/ '{print $NF}')
fi

echo "    Channel ID: $CHANNEL_ID"

CHANNEL_RESOURCE="projects/${PROJECT_ID}/notificationChannels/${CHANNEL_ID}"

# ── 2. Create alert policy — zero active instances ────────────────────────────
# Fires when the boot service has fewer than 1 active instance for 5 minutes.
# This catches crashes, repeated restarts, and deployment failures.
echo ">>> Creating alert policy: '${SERVICE_NAME}: zero instances'..."

# Write the policy JSON to a temp file (gcloud alpha monitoring policies create
# accepts either --policy-from-file or inline flags; JSON gives full control).
POLICY_FILE=$(mktemp /tmp/ev-sim-alert-XXXXXX.json)
cat > "$POLICY_FILE" << POLICY
{
  "displayName": "${SERVICE_NAME}: zero instances",
  "documentation": {
    "content": "The ev-sim-boot Cloud Run service has had 0 active instances for at least 5 minutes. The always-on charger daemon is down. Check Cloud Logging for crash details:\n\n  gcloud run services logs tail ${SERVICE_NAME} --region=${REGION} --project=${PROJECT_ID}",
    "mimeType": "text/markdown"
  },
  "conditions": [
    {
      "displayName": "Active instances < 1 for 5 min",
      "conditionThreshold": {
        "filter": "resource.type = \"cloud_run_revision\" AND metric.type = \"run.googleapis.com/container/instance_count\" AND resource.labels.service_name = \"${SERVICE_NAME}\" AND resource.labels.location = \"${REGION}\"",
        "aggregations": [
          {
            "alignmentPeriod": "60s",
            "perSeriesAligner": "ALIGN_MEAN",
            "crossSeriesReducer": "REDUCE_SUM",
            "groupByFields": ["resource.labels.service_name"]
          }
        ],
        "comparison": "COMPARISON_LT",
        "thresholdValue": 1,
        "duration": "300s",
        "trigger": {
          "count": 1
        }
      }
    }
  ],
  "notificationChannels": [
    "${CHANNEL_RESOURCE}"
  ],
  "alertStrategy": {
    "notificationRateLimit": {
      "period": "3600s"
    },
    "autoClose": "1800s"
  },
  "combiner": "OR",
  "enabled": true
}
POLICY

gcloud alpha monitoring policies create \
  --policy-from-file="$POLICY_FILE" \
  --project="$PROJECT_ID"

rm -f "$POLICY_FILE"
echo "    Alert policy created."

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "=== Monitoring setup complete ==="
echo ""
echo "Alert will fire when $SERVICE_NAME has 0 instances for ≥5 minutes."
echo "Notification will be sent to: $ALERT_EMAIL"
echo ""
echo "View alert policies:"
echo "  https://console.cloud.google.com/monitoring/alerting?project=$PROJECT_ID"
echo ""
echo "View live logs:"
echo "  gcloud run services logs tail $SERVICE_NAME --region=$REGION --project=$PROJECT_ID"
