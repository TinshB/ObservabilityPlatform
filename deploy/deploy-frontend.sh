#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# deploy-frontend.sh — Deploy the frontend (Nginx + React SPA)
#
# Manages the frontend container which serves the React SPA and
# reverse-proxies API requests to the backend services.
#
# Usage:
#   ./deploy/deploy-frontend.sh up         # Start frontend container
#   ./deploy/deploy-frontend.sh down       # Stop frontend container
#   ./deploy/deploy-frontend.sh restart    # Restart frontend container
#   ./deploy/deploy-frontend.sh status     # Show frontend container status
#   ./deploy/deploy-frontend.sh logs       # Tail frontend logs (Nginx)
#   ./deploy/deploy-frontend.sh health     # Run frontend health check
#   ./deploy/deploy-frontend.sh rebuild    # Rebuild image and restart
#
# Prerequisites:
#   - Docker 24+ and Docker Compose v2+
#   - Frontend image built (run ./deploy/build-frontend.sh first)
#   - Backend services running (run ./deploy/deploy-backend.sh up first)
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

log()   { echo -e "${GREEN}[DEPLOY-FRONTEND]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
info()  { echo -e "${CYAN}[INFO]${NC} $1"; }

# ── Docker Compose wrapper ────────────────────────────────────────

compose() {
    if [ -f "$ENV_FILE" ]; then
        docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
    else
        docker compose -f "$COMPOSE_FILE" "$@"
    fi
}

# ── Pre-flight checks ────────────────────────────────────────────

check_image() {
    if ! docker image inspect "obs/frontend:${IMAGE_TAG:-latest}" &>/dev/null; then
        error "Frontend image obs/frontend:${IMAGE_TAG:-latest} not found. Run './deploy/build-frontend.sh' first."
    fi
}

check_backend_running() {
    local backend_up=true

    for svc in obs-user-management obs-apm; do
        if ! docker ps --format '{{.Names}}' | grep -q "^${svc}$"; then
            warn "Backend container '${svc}' is not running."
            backend_up=false
        fi
    done

    if [ "$backend_up" = false ]; then
        warn "Some backend services are not running. The frontend may show 502 errors for API calls."
        warn "Start backend first: ./deploy/deploy-backend.sh up"
        echo ""
    fi
}

# ── Commands ──────────────────────────────────────────────────────

do_up() {
    check_image
    check_backend_running

    log "Starting frontend container ..."
    info "  Image:   obs/frontend:${IMAGE_TAG:-latest}"
    info "  Port:    80 (HTTP)"
    info "  Serves:  React SPA + API reverse proxy"
    echo ""

    compose up -d frontend

    sleep 3
    do_health
}

do_down() {
    log "Stopping frontend container ..."
    compose stop frontend
    log "Frontend stopped."
}

do_restart() {
    log "Restarting frontend container ..."
    compose restart frontend
    sleep 3
    do_health
}

do_status() {
    info "Frontend Container Status:"
    compose ps frontend --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
}

do_logs() {
    compose logs -f frontend
}

do_health() {
    echo ""
    info "=== Frontend Health ==="

    echo -n "  HTTP (:80): "
    local http_code
    http_code=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost:80 2>/dev/null || echo "000")
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}OK (${http_code})${NC}"
    else
        echo -e "${RED}FAIL (${http_code})${NC}"
    fi

    # Test API proxy connectivity
    echo -n "  API proxy → user-management (:8081): "
    local api_code
    api_code=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost/api/v1/auth/login 2>/dev/null || echo "000")
    if [ "$api_code" != "000" ] && [ "$api_code" != "502" ] && [ "$api_code" != "503" ]; then
        echo -e "${GREEN}OK (${api_code})${NC}"
    else
        echo -e "${RED}FAIL (${api_code})${NC}"
    fi

    echo -n "  API proxy → apm-service (:8082): "
    api_code=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost/api/v1/services/ 2>/dev/null || echo "000")
    if [ "$api_code" != "000" ] && [ "$api_code" != "502" ] && [ "$api_code" != "503" ]; then
        echo -e "${GREEN}OK (${api_code})${NC}"
    else
        echo -e "${RED}FAIL (${api_code})${NC}"
    fi
}

do_rebuild() {
    log "Rebuilding frontend image and restarting ..."
    "${SCRIPT_DIR}/build-frontend.sh"
    echo ""
    compose up -d --no-deps frontend
    sleep 3
    do_health
}

# ── Main ──────────────────────────────────────────────────────────
ACTION="${1:-help}"

case "$ACTION" in
    up)       do_up ;;
    down)     do_down ;;
    restart)  do_restart ;;
    status)   do_status ;;
    logs)     do_logs ;;
    health)   do_health ;;
    rebuild)  do_rebuild ;;
    *)
        echo "Usage: $0 {up|down|restart|status|logs|health|rebuild}"
        echo ""
        echo "Commands:"
        echo "  up        Start the frontend container"
        echo "  down      Stop the frontend container"
        echo "  restart   Restart the frontend container"
        echo "  status    Show frontend container status"
        echo "  logs      Tail Nginx access/error logs"
        echo "  health    Run frontend and API proxy health checks"
        echo "  rebuild   Rebuild the frontend image and restart"
        exit 1
        ;;
esac
