#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# deploy.sh — Unified deployment script (delegates to deploy-backend.sh / deploy-frontend.sh)
#
# Usage:
#   ./deploy/deploy.sh up              # Start everything (infra + backend + frontend)
#   ./deploy/deploy.sh down            # Stop everything
#   ./deploy/deploy.sh restart         # Restart all services
#   ./deploy/deploy.sh infra           # Start infrastructure only
#   ./deploy/deploy.sh services        # Start app services only (backend + frontend)
#   ./deploy/deploy.sh backend         # Start backend only (infra + backend services)
#   ./deploy/deploy.sh frontend        # Start frontend only
#   ./deploy/deploy.sh status          # Show status of all containers
#   ./deploy/deploy.sh logs [svc]      # Tail logs (all or specific)
#   ./deploy/deploy.sh health          # Run health checks
#   ./deploy/deploy.sh clean           # Stop and remove volumes
#
# For more control, use the dedicated scripts directly:
#   ./deploy/deploy-backend.sh [cmd]   # Backend infrastructure + services
#   ./deploy/deploy-frontend.sh [cmd]  # Frontend container
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

# Ensure sub-scripts are executable
chmod +x "${SCRIPT_DIR}/deploy-backend.sh" "${SCRIPT_DIR}/deploy-frontend.sh"

compose() {
    if [ -f "$ENV_FILE" ]; then
        docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
    else
        docker compose -f "$COMPOSE_FILE" "$@"
    fi
}

do_up() {
    log "Starting all services (infrastructure + backend + frontend) ..."
    echo ""
    "${SCRIPT_DIR}/deploy-backend.sh" up
    echo ""
    "${SCRIPT_DIR}/deploy-frontend.sh" up
    echo ""
    log "All services started."
}

do_down() {
    log "Stopping all services ..."
    "${SCRIPT_DIR}/deploy-frontend.sh" down
    "${SCRIPT_DIR}/deploy-backend.sh" down
    log "All services stopped."
}

do_restart() {
    log "Restarting all services ..."
    "${SCRIPT_DIR}/deploy-backend.sh" restart
    "${SCRIPT_DIR}/deploy-frontend.sh" restart
    echo ""
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

do_health() {
    "${SCRIPT_DIR}/deploy-backend.sh" health
    echo ""
    "${SCRIPT_DIR}/deploy-frontend.sh" health
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
    infra)    "${SCRIPT_DIR}/deploy-backend.sh" infra ;;
    services)
        "${SCRIPT_DIR}/deploy-backend.sh" services
        "${SCRIPT_DIR}/deploy-frontend.sh" up
        ;;
    backend)  "${SCRIPT_DIR}/deploy-backend.sh" up ;;
    frontend) "${SCRIPT_DIR}/deploy-frontend.sh" up ;;
    status)   do_status ;;
    logs)     do_logs "$@" ;;
    health)   do_health ;;
    clean)    do_clean ;;
    *)
        echo "Usage: $0 {up|down|restart|infra|services|backend|frontend|status|logs [svc]|health|clean}"
        echo ""
        echo "Commands:"
        echo "  up        Start everything (infra + backend + frontend)"
        echo "  down      Stop everything"
        echo "  restart   Restart all services"
        echo "  infra     Start infrastructure only"
        echo "  services  Start app services + frontend"
        echo "  backend   Start infrastructure + backend services only"
        echo "  frontend  Start frontend only"
        echo "  status    Show container status"
        echo "  logs      Tail logs (optionally specify service name)"
        echo "  health    Run health checks on all services"
        echo "  clean     Stop everything and remove data volumes"
        echo ""
        echo "For more control, use the dedicated scripts:"
        echo "  ./deploy/deploy-backend.sh [cmd]    Backend infrastructure + services"
        echo "  ./deploy/deploy-frontend.sh [cmd]   Frontend container"
        exit 1
        ;;
esac
