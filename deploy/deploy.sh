#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# deploy.sh — Deploy the Observability Platform using Docker Compose
# Usage:
#   ./deploy/deploy.sh up           # Start everything
#   ./deploy/deploy.sh down         # Stop everything
#   ./deploy/deploy.sh restart      # Restart all services
#   ./deploy/deploy.sh infra        # Start infrastructure only
#   ./deploy/deploy.sh services     # Start app services only
#   ./deploy/deploy.sh status       # Show status of all containers
#   ./deploy/deploy.sh logs [svc]   # Tail logs (all or specific)
#   ./deploy/deploy.sh health       # Run health checks
#   ./deploy/deploy.sh clean        # Stop and remove volumes
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

log()   { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
info()  { echo -e "${CYAN}[INFO]${NC} $1"; }

INFRA_SERVICES="postgres redis elasticsearch prometheus jaeger otel-collector mailhog"
APP_SERVICES="user-management-service apm-service apm-report-service python-sidecar apm-ai-service frontend"

compose() {
    if [ -f "$ENV_FILE" ]; then
        docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
    else
        docker compose -f "$COMPOSE_FILE" "$@"
    fi
}

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

do_up() {
    check_env
    check_sysctl
    log "Starting all services ..."
    compose up -d
    log "All services started."
    echo ""
    do_status
}

do_down() {
    log "Stopping all services ..."
    compose down
    log "All services stopped."
}

do_restart() {
    log "Restarting all services ..."
    compose restart
    do_status
}

do_infra() {
    check_env
    check_sysctl
    log "Starting infrastructure services ..."
    compose up -d $INFRA_SERVICES
    log "Infrastructure started. Waiting for health checks ..."
    sleep 10
    do_health_infra
}

do_services() {
    check_env
    log "Starting application services ..."
    compose up -d $APP_SERVICES
    log "Application services started."
    sleep 15
    do_status
}

do_status() {
    echo ""
    info "Container Status:"
    compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
}

do_logs() {
    local svc="${1:-}"
    if [ -n "$svc" ]; then
        compose logs -f "$svc"
    else
        compose logs -f
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
    info "=== Application Services ==="
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
    echo -n "  Frontend (:80): "
    curl -sf -o /dev/null http://localhost:80 && echo -e "${GREEN}OK${NC}" || echo -e "${RED}FAIL${NC}"
}

do_clean() {
    warn "This will stop all containers AND delete all data volumes!"
    read -rp "Are you sure? (y/N): " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        compose down -v
        log "All containers stopped and volumes removed."
    else
        log "Cancelled."
    fi
}

# ── Main ───────────────────────────────────────────────────────────
ACTION="${1:-help}"
shift 2>/dev/null || true

case "$ACTION" in
    up)       do_up ;;
    down)     do_down ;;
    restart)  do_restart ;;
    infra)    do_infra ;;
    services) do_services ;;
    status)   do_status ;;
    logs)     do_logs "$@" ;;
    health)   do_health ;;
    clean)    do_clean ;;
    *)
        echo "Usage: $0 {up|down|restart|infra|services|status|logs [svc]|health|clean}"
        echo ""
        echo "Commands:"
        echo "  up        Start everything (infra + services + frontend)"
        echo "  down      Stop everything"
        echo "  restart   Restart all services"
        echo "  infra     Start infrastructure only"
        echo "  services  Start application services only"
        echo "  status    Show container status"
        echo "  logs      Tail logs (optionally specify service name)"
        echo "  health    Run health checks on all services"
        echo "  clean     Stop everything and remove data volumes"
        exit 1
        ;;
esac
