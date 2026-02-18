#!/usr/bin/env bash
# Deploy backend and frontend to Google Cloud Run (builds images, pushes, deploys).
# Prerequisites: gcloud CLI, Docker, project set (gcloud config set project PROJECT_ID).
# First-time: run the "One-time setup" in deploy/DEPLOY-GCP.md.

set -e
REGION="${REGION:-eu-central1}"
PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
if [[ -z "$PROJECT_ID" ]]; then
  echo "Set PROJECT_ID or run: gcloud config set project YOUR_PROJECT_ID"
  exit 1
fi

echo "Project: $PROJECT_ID  Region: $REGION"

# 1) Deploy backend
echo "--- Building and deploying backend ---"
gcloud builds submit . --config deploy/cloudbuild-backend.yaml
BACKEND_URL=$(gcloud run services describe backend --region="$REGION" --format='value(status.url)' 2>/dev/null || true)
if [[ -z "$BACKEND_URL" ]]; then
  echo "Could not get backend URL. Deploy backend manually and set BACKEND_URL for the frontend build."
  exit 1
fi
echo "Backend URL: $BACKEND_URL"

# 2) Deploy frontend (build with backend URL)
echo "--- Building and deploying frontend (VITE_API_URL=$BACKEND_URL) ---"
gcloud builds submit . --config deploy/cloudbuild-frontend.yaml \
  --substitutions="_BACKEND_URL=$BACKEND_URL"

FRONTEND_URL=$(gcloud run services describe frontend --region="$REGION" --format='value(status.url)' 2>/dev/null || true)
echo "Frontend URL: $FRONTEND_URL"

# 3) Remind to set FRONTEND_URL on backend (for CORS)
echo ""
echo "Set backend CORS origin: run the following so the backend allows the frontend origin:"
echo "  gcloud run services update backend --region=$REGION --set-env-vars FRONTEND_URL=$FRONTEND_URL"
echo ""
echo "Backend: $BACKEND_URL"
echo "Frontend: $FRONTEND_URL"
