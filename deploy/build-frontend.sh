#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# build-frontend.sh — Build frontend Docker image
#
# This script builds the React SPA into a production-ready Nginx
# Docker image using a multi-stage Dockerfile:
#   Stage 1: Node 20 — npm ci + Vite build → dist/
#   Stage 2: Nginx 1.27 — serve dist/ with API reverse proxy
#
# Usage:
#   ./deploy/build-frontend.sh             # Build frontend image
#   IMAGE_TAG=v1.0.0 ./deploy/build-frontend.sh  # Build with tag
#
# Environment:
#   IMAGE_TAG   Docker image tag (default: latest)
#
# Prerequisites:
#   - Docker 24+
#   - No Node.js required on host (build runs inside Docker)
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="${PROJECT_ROOT}/frontend"
IMAGE_TAG="${IMAGE_TAG:-latest}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()   { echo -e "${GREEN}[BUILD-FRONTEND]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
info()  { echo -e "${CYAN}[INFO]${NC} $1"; }

# ── Step 1: Verify prerequisites ─────────────────────────────────

check_prerequisites() {
    log "Checking prerequisites ..."

    if ! command -v docker &>/dev/null; then
        error "Docker is not installed. See docs/setup.md"
    fi

    info "Docker: $(docker --version)"

    if [ ! -f "${FRONTEND_DIR}/Dockerfile" ]; then
        error "Frontend Dockerfile not found at ${FRONTEND_DIR}/Dockerfile"
    fi

    if [ ! -f "${FRONTEND_DIR}/package.json" ]; then
        error "package.json not found at ${FRONTEND_DIR}/package.json"
    fi

    if [ ! -f "${FRONTEND_DIR}/nginx.conf" ]; then
        error "nginx.conf not found at ${FRONTEND_DIR}/nginx.conf"
    fi
}

# ── Step 2: Build Docker image ───────────────────────────────────

build_frontend() {
    log "=== Building Frontend Docker Image ==="
    echo ""
    info "Image:   obs/frontend:${IMAGE_TAG}"
    info "Context: ${FRONTEND_DIR}"
    info ""
    info "Build pipeline (inside Docker):"
    info "  Stage 1: node:20-alpine → npm ci + npm run build → dist/"
    info "  Stage 2: nginx:1.27-alpine → copy dist/ + nginx.conf"
    echo ""

    docker build \
        -t "obs/frontend:${IMAGE_TAG}" \
        "${FRONTEND_DIR}"

    echo ""
    log "Frontend image built successfully."
}

# ── Step 3: Verify ────────────────────────────────────────────────

verify_image() {
    info "Image details:"
    docker images "obs/frontend:${IMAGE_TAG}" --format "  Repository: {{.Repository}}\n  Tag:        {{.Tag}}\n  Size:       {{.Size}}\n  Created:    {{.CreatedSince}}"
}

# ── Main ──────────────────────────────────────────────────────────

log "Building frontend (tag: ${IMAGE_TAG})"
echo ""

check_prerequisites
build_frontend
verify_image

echo ""
log "Frontend build complete."
info "To deploy: ./deploy/deploy-frontend.sh up"
