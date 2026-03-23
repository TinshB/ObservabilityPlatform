#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# build-backend.sh — Build backend Docker images
#
# This script builds the Spring Boot JARs using Maven on the host,
# then packages each service into a lightweight Docker image.
#
# Usage:
#   ./deploy/build-backend.sh                        # Build all backend services
#   ./deploy/build-backend.sh user-management-service # Build a specific service
#   ./deploy/build-backend.sh apm-service
#   ./deploy/build-backend.sh apm-report-service
#   ./deploy/build-backend.sh apm-ai-service
#   ./deploy/build-backend.sh python-sidecar
#
# Environment:
#   IMAGE_TAG   Docker image tag (default: latest)
#
# Prerequisites:
#   - Java JDK 25 (Eclipse Temurin)
#   - Docker 24+
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="${PROJECT_ROOT}/backend"
IMAGE_TAG="${IMAGE_TAG:-latest}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()   { echo -e "${GREEN}[BUILD-BACKEND]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
info()  { echo -e "${CYAN}[INFO]${NC} $1"; }

JAVA_SERVICES=(
    "user-management-service"
    "apm-service"
    "apm-report-service"
    "apm-ai-service"
)

# ── Step 1: Verify prerequisites ─────────────────────────────────

check_prerequisites() {
    log "Checking prerequisites ..."

    if ! command -v java &>/dev/null; then
        error "Java is not installed. Install Eclipse Temurin JDK 25: see docs/setup.md"
    fi

    local java_ver
    java_ver=$(java -version 2>&1 | head -1)
    info "Java: ${java_ver}"

    if ! command -v docker &>/dev/null; then
        error "Docker is not installed. See docs/setup.md"
    fi

    info "Docker: $(docker --version)"
}

# ── Step 2: Maven build ──────────────────────────────────────────

build_maven_all() {
    log "=== Step 1/2: Maven Build (all services) ==="
    info "Building all JARs in a single Maven reactor run ..."
    info "This compiles: observability-shared → all 4 services"

    cd "$BACKEND_DIR"

    if [ ! -f "mvnw" ]; then
        error "Maven wrapper (mvnw) not found in ${BACKEND_DIR}"
    fi

    chmod +x mvnw

    ./mvnw clean package -DskipTests -B

    echo ""
    log "Maven build complete. JARs created:"
    for svc in "${JAVA_SERVICES[@]}"; do
        local jar="${BACKEND_DIR}/${svc}/target/${svc}-1.0.0-SNAPSHOT.jar"
        if [ -f "$jar" ]; then
            info "  ✓ ${svc}/target/${svc}-1.0.0-SNAPSHOT.jar ($(du -h "$jar" | cut -f1))"
        else
            error "JAR not found: ${jar}"
        fi
    done
    echo ""
}

build_maven_single() {
    local svc=$1
    log "=== Step 1/2: Maven Build (${svc}) ==="

    cd "$BACKEND_DIR"
    chmod +x mvnw

    info "Building shared library first ..."
    ./mvnw install -N -DskipTests -B -q
    ./mvnw install -pl observability-shared -DskipTests -B -q

    info "Building ${svc} ..."
    ./mvnw package -pl "${svc}" -DskipTests -B

    local jar="${BACKEND_DIR}/${svc}/target/${svc}-1.0.0-SNAPSHOT.jar"
    if [ -f "$jar" ]; then
        info "  ✓ ${svc}/target/${svc}-1.0.0-SNAPSHOT.jar ($(du -h "$jar" | cut -f1))"
    else
        error "JAR not found: ${jar}"
    fi
    echo ""
}

# ── Step 3: Docker image build ───────────────────────────────────

build_docker_java_service() {
    local svc=$1
    log "Building Docker image: obs/${svc}:${IMAGE_TAG} ..."
    docker build \
        --build-arg SERVICE_NAME="${svc}" \
        -t "obs/${svc}:${IMAGE_TAG}" \
        -f "${BACKEND_DIR}/Dockerfile" \
        "${BACKEND_DIR}"
    info "  ✓ obs/${svc}:${IMAGE_TAG}"
}

build_docker_python_sidecar() {
    log "Building Docker image: obs/python-sidecar:${IMAGE_TAG} ..."
    docker build \
        -t "obs/python-sidecar:${IMAGE_TAG}" \
        "${BACKEND_DIR}/apm-ai-service/python-sidecar"
    info "  ✓ obs/python-sidecar:${IMAGE_TAG}"
}

build_docker_flyway() {
    log "Building Docker image: obs/flyway-migrate:${IMAGE_TAG} ..."
    docker build \
        -t "obs/flyway-migrate:${IMAGE_TAG}" \
        "${PROJECT_ROOT}/flyway"
    info "  ✓ obs/flyway-migrate:${IMAGE_TAG}"
}

# ── Build all backend ─────────────────────────────────────────────

build_all() {
    check_prerequisites

    # Step 1: Maven build all JARs
    build_maven_all

    # Step 2: Docker images
    log "=== Step 2/2: Docker Image Build ==="
    build_docker_flyway
    for svc in "${JAVA_SERVICES[@]}"; do
        build_docker_java_service "$svc"
    done
    build_docker_python_sidecar
}

# ── Build single service ──────────────────────────────────────────

build_single() {
    local svc=$1
    check_prerequisites

    if [ "$svc" = "python-sidecar" ]; then
        log "Building python-sidecar (Docker only — no Maven step)"
        build_docker_python_sidecar
    else
        # Step 1: Maven build single JAR
        build_maven_single "$svc"
        # Step 2: Docker image
        log "=== Step 2/2: Docker Image Build ==="
        build_docker_java_service "$svc"
    fi
}

# ── Main ──────────────────────────────────────────────────────────
TARGET="${1:-all}"

case "$TARGET" in
    all)
        log "Building ALL backend images (tag: ${IMAGE_TAG})"
        echo ""
        build_all
        ;;
    user-management-service|apm-service|apm-report-service|apm-ai-service|apm-billing-service)
        log "Building ${TARGET} (tag: ${IMAGE_TAG})"
        echo ""
        build_single "$TARGET"
        ;;
    python-sidecar)
        log "Building python-sidecar (tag: ${IMAGE_TAG})"
        echo ""
        build_single "python-sidecar"
        ;;
    flyway-migrate)
        log "Building flyway-migrate (tag: ${IMAGE_TAG})"
        echo ""
        build_docker_flyway
        ;;
    *)
        error "Unknown target: $TARGET
Valid targets:
  all                       Build all backend services
  user-management-service   User & auth service (port 8081)
  apm-service               APM core service (port 8082)
  apm-report-service        Report service (port 8084)
  apm-ai-service            AI service (port 8085)
  apm-billing-service       Billing service (port 8086)
  python-sidecar            Python ML sidecar (port 50051)
  flyway-migrate            Flyway database migration image"
        ;;
esac

echo ""
log "Backend build complete. Images:"
docker images --filter "reference=obs/*" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedSince}}" | grep -v frontend || true
