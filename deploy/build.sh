#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# build.sh — Unified build script (delegates to build-backend.sh / build-frontend.sh)
#
# Usage:
#   ./deploy/build.sh                        # Build all (backend + frontend)
#   ./deploy/build.sh backend                # Build backend only
#   ./deploy/build.sh frontend               # Build frontend only
#   ./deploy/build.sh <service>              # Build specific backend service
#
# For more control, use the dedicated scripts directly:
#   ./deploy/build-backend.sh [target]       # Backend build with Maven + Docker
#   ./deploy/build-frontend.sh               # Frontend build with Docker
#
# Environment:
#   IMAGE_TAG   Docker image tag (default: latest)
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
export IMAGE_TAG="${IMAGE_TAG:-latest}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()   { echo -e "${GREEN}[BUILD]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Ensure sub-scripts are executable
chmod +x "${SCRIPT_DIR}/build-backend.sh" "${SCRIPT_DIR}/build-frontend.sh"

# ── Main ───────────────────────────────────────────────────────────
TARGET="${1:-all}"

case "$TARGET" in
    all)
        log "Building ALL images (tag: ${IMAGE_TAG})"
        echo ""
        "${SCRIPT_DIR}/build-backend.sh" all
        echo ""
        "${SCRIPT_DIR}/build-frontend.sh"
        ;;
    backend)
        "${SCRIPT_DIR}/build-backend.sh" all
        ;;
    frontend)
        "${SCRIPT_DIR}/build-frontend.sh"
        ;;
    python-sidecar|user-management-service|apm-service|apm-report-service|apm-ai-service|apm-billing-service|flyway-migrate)
        "${SCRIPT_DIR}/build-backend.sh" "$TARGET"
        ;;
    *)
        error "Unknown target: $TARGET
Valid targets:
  all                       Build everything (backend + frontend)
  backend                   Build all backend services
  frontend                  Build frontend only
  user-management-service   Build user-management service
  apm-service               Build APM service
  apm-report-service        Build report service
  apm-ai-service            Build AI service
  apm-billing-service       Build billing service
  python-sidecar            Build Python ML sidecar
  flyway-migrate            Build Flyway migration image"
        ;;
esac

echo ""
log "Build complete. All images:"
docker images --filter "reference=obs/*" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedSince}}"
