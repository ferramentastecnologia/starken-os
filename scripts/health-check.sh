#!/bin/bash
# ============================================================================
# Starken OS — Health Check Monitor
# Monitora saúde da API continuamente
# Alertas se status mudar ou API ficar down
# ============================================================================
# Instalação (VPS):
#   chmod +x scripts/health-check.sh
#   pm2 start scripts/health-check.sh --name health-check
# ============================================================================

set -e

# ============================================================================
# Configuração
# ============================================================================

API_URL="http://localhost:3000/api/health"
TIMEOUT=10
CHECK_INTERVAL=60  # segundos
MAX_FAILURES=3

# Arquivo de estado
STATE_FILE="/tmp/starken-health-state.txt"
LAST_STATUS="unknown"

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# Funções
# ============================================================================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ✗ ERROR: $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] ⚠ WARNING: $1${NC}"
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] ✓ $1${NC}"
}

send_alert() {
    local message="$1"
    log_warning "$message"

    # Enviar para PM2 logs (vai aparecer em: pm2 logs)
    # Enviar para file log também
    echo "[ALERT] $message" >> /tmp/starken-health-alerts.log
}

check_health() {
    local response
    local http_code

    # Fazer requisição com timeout
    response=$(curl -s -o /tmp/health-response.txt -w "%{http_code}" \
        --connect-timeout 5 \
        --max-time $TIMEOUT \
        "$API_URL" 2>/dev/null || echo "000")

    http_code="${response: -3}"

    if [ "$http_code" = "200" ]; then
        # Verificar se resposta é JSON válido
        if grep -q '"status":"ok"' /tmp/health-response.txt 2>/dev/null; then
            echo "ok"
            return 0
        else
            echo "invalid"
            return 1
        fi
    else
        echo "http_$http_code"
        return 1
    fi
}

# ============================================================================
# Main Loop
# ============================================================================

log "╔════════════════════════════════════════════╗"
log "║  Starken OS Health Check — Iniciado       ║"
log "╠════════════════════════════════════════════╣"
log "║  API: $API_URL"
log "║  Check Interval: ${CHECK_INTERVAL}s"
log "║  Max Failures: $MAX_FAILURES"
log "╚════════════════════════════════════════════╝"

FAILURE_COUNT=0

while true; do
    CURRENT_STATUS=$(check_health)

    # ========== Status OK ==========
    if [ "$CURRENT_STATUS" = "ok" ]; then
        if [ "$LAST_STATUS" != "ok" ]; then
            log_success "API Health: OK"
            LAST_STATUS="ok"
            FAILURE_COUNT=0
        fi

    # ========== Status ERRO ==========
    else
        FAILURE_COUNT=$((FAILURE_COUNT + 1))

        if [ $FAILURE_COUNT -eq 1 ]; then
            # Primeiro erro
            send_alert "API Health Check Failed (Attempt $FAILURE_COUNT/$MAX_FAILURES): $CURRENT_STATUS"
            LAST_STATUS="error"

        elif [ $FAILURE_COUNT -lt $MAX_FAILURES ]; then
            # Retry
            send_alert "API Health Check Still Failing (Attempt $FAILURE_COUNT/$MAX_FAILURES): $CURRENT_STATUS"

        elif [ $FAILURE_COUNT -ge $MAX_FAILURES ]; then
            # Limite atingido
            log_error "API Health Check Failed $MAX_FAILURES times in a row!"
            send_alert "CRITICAL: API is down. Manual intervention may be needed."

            log ""
            log "Informações para debug:"
            log "  • PM2 status: $(pm2 status starken-api 2>/dev/null || echo 'N/A')"
            log "  • Node.js: $(node --version 2>/dev/null || echo 'N/A')"
            log "  • Logs: pm2 logs starken-api"
            log ""

            # Escrever para arquivo de alerta para histórico
            echo "[CRITICAL-$(date '+%Y-%m-%d %H:%M:%S')] API down for $((FAILURE_COUNT * CHECK_INTERVAL)) seconds" >> /tmp/starken-health-alerts.log
        fi
    fi

    # Salvar estado
    echo "$CURRENT_STATUS" > "$STATE_FILE"

    # Esperar próxima checagem
    sleep $CHECK_INTERVAL
done
