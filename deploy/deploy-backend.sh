#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# deploy-backend.sh — Deploy backend infrastructure and services
#
# Manages the full backend stack: infrastructure (Postgres, Redis,
# Elasticsearch, Prometheus, Jaeger, OTel Collector, MailHog) and
# application services (user-management, apm, apm-report, apm-ai,
# python-sidecar).
#
# Usage:
#   ./deploy/deploy-backend.sh up              # Start infra + all backend services
#   ./deploy/deploy-backend.sh down            # Stop infra + all backend services
#   ./deploy/deploy-backend.sh restart         # Restart all backend services
#   ./deploy/deploy-backend.sh infra           # Start infrastructure only
#   ./deploy/deploy-backend.sh services        # Start backend app services only
#   ./deploy/deploy-backend.sh status          # Show backend container status
#   ./deploy/deploy-backend.sh logs [svc]      # Tail logs (all backend or specific)
#   ./deploy/deploy-backend.sh health          # Run health checks
#   ./deploy/deploy-backend.sh restart-service <name>  # Restart a single service
#   ./deploy/deploy-backend.sh clean           # Stop and remove data volumes
#
# Prerequisites:
#   - Docker 24+ and Docker Compose v2+
#   - Backend images built (run ./deploy/build-backend.sh first)
#   - .env file configured (copy from .env.example)
#   - vm.max_map_count >= 262144 (for Elasticsearch)
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.yml"
ENV_FILE="${PROJECT_ROOT}/.env"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()   { echo -e "${GREEN}[DEPLOY-BACKEND]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
info()  { echo -e "${CYAN}[INFO]${NC} $1"; }

INFRA_SERVICES="postgres redis elasticsearch prometheus jaeger otel-collector mailhog"
APP_SERVICES="user-management-service apm-service apm-report-service python-sidecar apm-ai-service"
ALL_BACKEND="${INFRA_SERVICES} ${APP_SERVICES}"

# ── Docker Compose wrapper ────────────────────────────────────────

compose() {
    if [ -f "$ENV_FILE" ]; then
        docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
    else
        docker compose -f "$COMPOSE_FILE" "$@"
    fi
}

# ── Pre-flight checks ────────────────────────────────────────────

check_env() {
    if [ ! -f "$ENV_FILE" ]; then
        warn ".env file not found. Copying from .env.example ..."
        cp "${PROJECT_ROOT}/.env.example" "$ENV_FILE"
        warn "Please edit ${ENV_FILE} with your actual values, then re-run."
        exit 1
    fi
}

check_sysctl() {
    local current
    current=$(sysctl -n vm.max_map_count 2>/dev/null || echo "0")
    if [ "$current" -lt 262144 ]; then
        warn "vm.max_map_count is ${current} (Elasticsearch needs >= 262144)"
        log "Fixing: sudo sysctl -w vm.max_map_count=262144"
        sudo sysctl -w vm.max_map_count=262144
        echo "vm.max_map_count=262144" | sudo tee -a /etc/sysctl.conf > /dev/null
    fi
}

check_images() {
    local missing=0
    for svc in user-management-service apm-service apm-report-service apm-ai-service python-sidecar; do
        if ! docker image inspect "obs/${svc}:${IMAGE_TAG:-latest}" &>/dev/null; then
            warn "Image obs/${svc}:${IMAGE_TAG:-latest} not found"
            missing=1
        fi
    done
    if [ "$missing" -eq 1 ]; then
        error "Some backend images are missing. Run './deploy/build-backend.sh' first."
    fi
}

# ── Commands ──────────────────────────────────────────────────────

do_up() {
    check_env
    check_sysctl
    check_images

    log "Starting infrastructure + backend services ..."
    echo ""

    info "Phase 1: Starting infrastructure (Postgres, Redis, Elasticsearch, Prometheus, Jaeger, OTel, MailHog) ..."
    compose up -d $INFRA_SERVICES
    info "Waiting for infrastructure health checks ..."
    sleep 10

    info "Phase 2: Starting backend application services ..."
    compose up -d $APP_SERVICES
    info "Waiting for services to become healthy ..."
    sleep 15

    log "All backend services started."
    echo ""
    do_status
}

do_down() {
    log "Stopping all backend services and infrastructure ..."
    compose stop $APP_SERVICES 2>/dev/null || true
    compose stop $INFRA_SERVICES 2>/dev/null || true
    log "All backend services stopped."
}

do_restart() {
    log "Restarting all backend services ..."
    compose restart $APP_SERVICES
    echo ""
    do_status
}

do_infra() {
    check_env
    check_sysctl
    log "Starting infrastructure services ..."
    compose up -d $INFRA_SERVICES
    info "Waiting for infrastructure health checks ..."
    sleep 10
    do_health_infra
}

do_services() {
    check_env
    check_images
    log "Starting backend application services ..."
    compose up -d $APP_SERVICES
    info "Waiting for services to become healthy ..."
    sleep 15
    do_status
}

do_restart_service() {
    local svc="${1:-}"
    if [ -z "$svc" ]; then
        error "Usage: $0 restart-service <service-name>
Valid services: ${APP_SERVICES}"
    fi
    log "Restarting ${svc} ..."
    compose restart "$svc"
    info "Waiting for health check ..."
    sleep 10
    compose ps "$svc" --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
}

do_status() {
    info "Backend Container Status:"
    for svc in $ALL_BACKEND; do
        compose ps "$svc" --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || true
    done
}

do_logs() {
    local svc="${1:-}"
    if [ -n "$svc" ]; then
        compose logs -f "$svc"
    else
        compose logs -f $ALL_BACKEND
    fi
}

do_health_infra() {
    echo ""
    info "=== Infrastructure Health ==="
    echo -n "  PostgreSQL:    "; docker exec obs-postgres pg_isready -U myuser -d mydatabase > /dev/null 2>&1 && echo -e "${GREEN}OK${NC}" || echo -e "${RED}FAIL${NC}"
    echo -n "  Redis:         "; docker exec obs-redis redis-cli ping 2>/dev/null | tr -d '\n'; echo ""
    echo -n "  Elasticsearch: "; curl -sf http://localhost:9200/_cluster/health 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])" 2>/dev/null || echo -e "${RED}FAIL${NC}"
    echo -n "  Prometheus:    "; curl -sf http://localhost:9090/-/healthy > /dev/null && echo -e "${GREEN}OK${NC}" || echo -e "${RED}FAIL${NC}"
    echo -n "  Jaeger:        "; curl -sf -o /dev/null http://localhost:16686 && echo -e "${GREEN}OK${NC}" || echo -e "${RED}FAIL${NC}"
    echo -n "  MailHog:       "; curl -sf -o /dev/null http://localhost:8025 && echo -e "${GREEN}OK${NC}" || echo -e "${RED}FAIL${NC}"
}

do_health() {
    do_health_infra

    echo ""
    info "=== Backend Application Services ==="
    local services=("8081:user-management" "8082:apm-service" "8084:apm-report" "8085:apm-ai")
    for entry in "${services[@]}"; do
        local port="${entry%%:*}"
        local name="${entry##*:}"
        echo -n "  ${name} (:${port}): "
        local status
        status=$(curl -sf "http://localhost:${port}/actuator/health" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])" 2>/dev/null)
        if [ "$status" = "UP" ]; then
            echo -e "${GREEN}${status}${NC}"
        else
            echo -e "${RED}${status:-DOWN}${NC}"
        fi
    done

    echo ""
    echo -n "  python-sidecar (:50051): "
    docker exec obs-python-sidecar python -c "import socket; s=socket.socket(); s.connect(('localhost',50051)); s.close()" 2>/dev/null && echo -e "${GREEN}OK${NC}" || echo -e "${RED}FAIL${NC}"
}

do_clean() {
    warn "This will stop all backend containers AND delete all data volumes!"
    warn "Affected volumes: pgdata, redisdata, esdata, promdata, reportdata"
    read -rp "Are you sure? (y/N): " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        compose stop $APP_SERVICES 2>/dev/null || true
        compose stop $INFRA_SERVICES 2>/dev/null || true
        compose rm -f $ALL_BACKEND 2>/dev/null || true
        docker volume rm observability_pgdata observability_redisdata observability_esdata observability_promdata observability_reportdata 2>/dev/null || true
        log "All backend containers stopped and volumes removed."
    else
        log "Cancelled."
    fi
}

# ── Main ──────────────────────────────────────────────────────────
ACTION="${1:-help}"
shift 2>/dev/null || true

case "$ACTION" in
    up)              do_up ;;
    down)            do_down ;;
    restart)         do_restart ;;
    infra)           do_infra ;;
    services)        do_services ;;
    restart-service) do_restart_service "$@" ;;
    status)          do_status ;;
    logs)            do_logs "$@" ;;
    health)          do_health ;;
    clean)           do_clean ;;
    *)
        echo "Usage: $0 {up|down|restart|infra|services|restart-service|status|logs|health|clean}"
        echo ""
        echo "Commands:"
        echo "  up               Start infrastructure + all backend services"
        echo "  down             Stop all backend services and infrastructure"
        echo "  restart          Restart all backend application services"
        echo "  infra            Start infrastructure only (DB, Redis, ES, etc.)"
        echo "  services         Start backend application services only"
        echo "  restart-service  Restart a single service (e.g., apm-service)"
        echo "  status           Show backend container status"
        echo "  logs [svc]       Tail logs (all backend or specific service)"
        echo "  health           Run health checks on all backend components"
        echo "  clean            Stop everything and remove data volumes"
        exit 1
        ;;
esac
