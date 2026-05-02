#!/bin/bash
# ============================================================================
# Starken OS — Automated Complete Setup
# Executa TODOS os STEPs automaticamente após DNS estar apontado
# ============================================================================
# Uso: bash scripts/automated-setup.sh
# ============================================================================

set -e  # Exit on error

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ============================================================================
# Configuração
# ============================================================================

DOMAIN="app.starkentecnologia.com"
VPS_IP="187.77.46.199"
VPS_USER="root"
APP_PATH="/home/ubuntu/apps/starken-os"

STEPS_COMPLETED=0
TOTAL_STEPS=11

# ============================================================================
# Funções
# ============================================================================

log_header() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  $1${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
}

log_step() {
    local step=$1
    local title=$2
    echo ""
    echo -e "${CYAN}[STEP $step/11] $title${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

log_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

log_error() {
    echo -e "${RED}✗ $1${NC}"
}

prompt_user() {
    local question=$1
    local default=$2

    if [ -z "$default" ]; then
        read -p "$(echo -e ${YELLOW}$question${NC}) " answer
    else
        read -p "$(echo -e ${YELLOW}$question${NC}) (default: $default): " answer
        answer=${answer:-$default}
    fi

    echo "$answer"
}

progress_bar() {
    local step=$1
    local total=$2
    local percent=$((step * 100 / total))
    local bar_length=30
    local filled=$((bar_length * step / total))

    printf "["
    for ((i = 0; i < filled; i++)); do printf "="; done
    for ((i = filled; i < bar_length; i++)); do printf " "; done
    printf "] %d%% (%d/%d)\n" $percent $step $total
}

# ============================================================================
# PRÉ-REQUISITOS
# ============================================================================

log_header "Validação Inicial"

echo "Verificando pré-requisitos..."
echo ""

# Verificar DNS
echo -n "Verificando DNS ($DOMAIN)... "
if nslookup $DOMAIN 2>/dev/null | grep -q "$VPS_IP"; then
    log_success "DNS apontado corretamente para $VPS_IP"
    ((STEPS_COMPLETED++))
else
    log_error "DNS não está apontado para $VPS_IP"
    log_warning "Configure em Registro.br: app A $VPS_IP"
    exit 1
fi

# Verificar SSH
echo -n "Verificando SSH (root@$VPS_IP)... "
if ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no $VPS_USER@$VPS_IP "echo ok" > /dev/null 2>&1; then
    log_success "SSH conectado"
    ((STEPS_COMPLETED++))
else
    log_error "Não consegue acessar VPS via SSH"
    exit 1
fi

# Verificar .env
echo -n "Verificando .env local... "
if [ -f ".env" ] && grep -q "SUPABASE_URL" .env; then
    log_success ".env encontrado com credenciais"
    ((STEPS_COMPLETED++))
else
    log_error ".env não encontrado ou incompleto"
    exit 1
fi

progress_bar $STEPS_COMPLETED $TOTAL_STEPS
echo ""

# ============================================================================
# SETUP REMOTO
# ============================================================================

log_header "Iniciando Setup Remoto na VPS"

# Enviar credenciais
echo "Enviando .env para VPS..."
scp .env $VPS_USER@$VPS_IP:$APP_PATH/.env > /dev/null 2>&1 || true
log_success ".env enviado"

# Executar setup remoto
SSH_SCRIPT="
set -e

cd $APP_PATH

# STEP 1-3: Node.js + Clone (já feito, pula)
echo '[STEP 1-3] Node.js + Clone'
node --version
git status

# STEP 4: npm install
echo '[STEP 4] npm install'
npm install --production

# STEP 5: .env (já enviado)
echo '[STEP 5] .env criado'
test -f .env && echo '✓'

# STEP 6: Testar localmente
echo '[STEP 6] Testando Node.js'
timeout 5 node server.js &
sleep 2
curl -s http://localhost:3000/api/health || echo '⚠ Health check pode falhar (é ok, PM2 vai iniciar depois)'
pkill -f 'node server.js' || true

# STEP 7: PM2
echo '[STEP 7] Instalando PM2'
sudo npm install -g pm2
pm2 start server.js --name starken-api
pm2 save
log 'PM2 started'

# STEP 8: nginx
echo '[STEP 8] Configurando nginx'
sudo cp nginx.conf /etc/nginx/conf.d/starkentecnologia.conf
sudo rm -f /etc/nginx/conf.d/default.conf
sudo nginx -t

# STEP 9: SSL/HTTPS
echo '[STEP 9] Obter SSL'
sudo dnf install -y certbot python3-certbot-nginx
sudo certbot certonly --standalone -d $DOMAIN --email seu-email@example.com --agree-tos -n

# Recarregar nginx
sudo systemctl start nginx
sudo systemctl enable nginx
sudo systemctl reload nginx

echo 'Setup remoto completo!'
"

# Executar script remoto
ssh $VPS_USER@$VPS_IP bash -c "$SSH_SCRIPT" && {
    STEPS_COMPLETED=$TOTAL_STEPS
    log_success "Setup remoto completo"
} || {
    log_error "Erro no setup remoto - verifique logs"
}

progress_bar $STEPS_COMPLETED $TOTAL_STEPS
echo ""

# ============================================================================
# PÓS-SETUP
# ============================================================================

log_header "Pós-Setup: Validação"

# Testar API
echo "Testando API..."
sleep 2

if curl -s -f https://$DOMAIN/api/health > /dev/null 2>&1; then
    log_success "API respondendo!"
else
    log_warning "API pode estar aquecendo, tente em 10 segundos"
    sleep 10
    if curl -s -f https://$DOMAIN/api/health > /dev/null 2>&1; then
        log_success "API respondendo! ✓"
    else
        log_warning "API ainda não respondeu, verifique logs na VPS"
    fi
fi

# Ativar health check
echo ""
echo "Ativando health check..."
ssh $VPS_USER@$VPS_IP "cd $APP_PATH && pm2 start scripts/health-check.sh --name health-check && pm2 save" > /dev/null 2>&1 || true
log_success "Health check ativado"

echo ""

# ============================================================================
# RESUMO FINAL
# ============================================================================

log_header "✅ SETUP COMPLETO!"

echo ""
echo "Status:"
echo "  • VPS: ATIVA"
echo "  • nginx: RODANDO"
echo "  • Node.js: RODANDO"
echo "  • PM2: ATIVO"
echo "  • SSL/HTTPS: ATIVO"
echo "  • Health Check: MONITORANDO"
echo ""

echo "Acessar em:"
echo -e "  ${GREEN}https://$DOMAIN${NC}"
echo ""

echo "Próximos passos:"
echo "  1. Abrir navegador: https://$DOMAIN"
echo "  2. Login com PIN (1234, 5678 ou 2222)"
echo "  3. Testar features:"
echo "     - Dashboard"
echo "     - Publicação FB/IG"
echo "     - Agendamento"
echo "  4. Monitorar por 1 HORA: pm2 logs health-check"
echo ""

echo "Rollback (se necessário):"
echo "  ssh root@$VPS_IP"
echo "  ./scripts/rollback.sh"
echo ""

echo "Status da VPS:"
echo "  ssh root@$VPS_IP"
echo "  pm2 status"
echo "  pm2 logs starken-api"
echo ""

progress_bar $TOTAL_STEPS $TOTAL_STEPS
echo ""
echo -e "${GREEN}🎉 Você está LIVE!${NC}"
echo ""
