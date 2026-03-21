#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# build.sh — Build Docker images for all services
# Usage:
#   ./deploy/build.sh              # Build all
#   ./deploy/build.sh backend      # Build backend only
#   ./deploy/build.sh frontend     # Build frontend only
#   ./deploy/build.sh <service>    # Build specific service
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
IMAGE_TAG="${IMAGE_TAG:-latest}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()   { echo -e "${GREEN}[BUILD]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

BACKEND_SERVICES=(
    "user-management-service"
    "apm-service"
    "apm-report-service"
    "apm-ai-service"
)

build_backend_service() {
    local svc=$1
    log "Building obs/${svc}:${IMAGE_TAG} ..."
    docker build \
        --build-arg SERVICE_NAME="${svc}" \
        -t "obs/${svc}:${IMAGE_TAG}" \
        -f "${PROJECT_ROOT}/backend/Dockerfile" \
        "${PROJECT_ROOT}/backend"
    log "Built obs/${svc}:${IMAGE_TAG}"
}

build_python_sidecar() {
    log "Building obs/python-sidecar:${IMAGE_TAG} ..."
    docker build \
        -t "obs/python-sidecar:${IMAGE_TAG}" \
        "${PROJECT_ROOT}/backend/apm-ai-service/python-sidecar"
    log "Built obs/python-sidecar:${IMAGE_TAG}"
}

build_frontend() {
    log "Building obs/frontend:${IMAGE_TAG} ..."
    docker build \
        -t "obs/frontend:${IMAGE_TAG}" \
        "${PROJECT_ROOT}/frontend"
    log "Built obs/frontend:${IMAGE_TAG}"
}

build_all_backend() {
    for svc in "${BACKEND_SERVICES[@]}"; do
        build_backend_service "$svc"
    done
    build_python_sidecar
}

# ── Main ───────────────────────────────────────────────────────────
TARGET="${1:-all}"

case "$TARGET" in
    all)
        log "Building ALL images (tag: ${IMAGE_TAG})"
        build_all_backend
        build_frontend
        ;;
    backend)
        log "Building all backend images (tag: ${IMAGE_TAG})"
        build_all_backend
        ;;
    frontend)
        build_frontend
        ;;
    python-sidecar)
        build_python_sidecar
        ;;
    user-management-service|apm-service|apm-report-service|apm-ai-service)
        build_backend_service "$TARGET"
        ;;
    *)
        error "Unknown target: $TARGET. Valid: all, backend, frontend, python-sidecar, ${BACKEND_SERVICES[*]}"
        ;;
esac

echo ""
log "Build complete. Images:"
docker images --filter "reference=obs/*" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedSince}}"
