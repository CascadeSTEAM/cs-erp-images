#!/usr/bin/env bash
# =============================================================================
# build-local.sh — Build a use-case image locally for testing
# =============================================================================
# Usage:
#   ./scripts/build-local.sh helpdesk v16.23.1-r1
#   ./scripts/build-local.sh helpdesk v16.23.1-r1 version-16
# =============================================================================
set -euo pipefail

USE_CASE="${1:?Usage: $0 <use-case> <tag> [frappe-branch]}"
TAG="${2:?Usage: $0 <use-case> <tag> [frappe-branch]}"
FRAPPE_BRANCH="${3:-version-16}"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APPS_JSON="${REPO_ROOT}/use-cases/${USE_CASE}/apps.json"

if [ ! -f "$APPS_JSON" ]; then
    echo "Error: use-case '${USE_CASE}' not found (missing ${APPS_JSON})"
    exit 1
fi

IMAGE="ghcr.io/cascadesteam/erp-${USE_CASE}:${TAG}"
APPS_JSON_B64=$(base64 -w 0 "$APPS_JSON")

echo "Building: ${IMAGE}"
echo "Frappe branch: ${FRAPPE_BRANCH}"
echo "Apps:"
cat "$APPS_JSON"
echo ""

docker buildx build \
    --platform linux/amd64 \
    --build-arg FRAPPE_PATH=https://github.com/frappe/frappe \
    --build-arg FRAPPE_BRANCH="${FRAPPE_BRANCH}" \
    --build-arg APPS_JSON_BASE64="${APPS_JSON_B64}" \
    --tag "${IMAGE}" \
    --file images/custom/Containerfile \
    https://github.com/frappe/frappe_docker.git

echo ""
echo "Done: ${IMAGE}"
echo "Test with: docker run --rm ${IMAGE} bench version"
