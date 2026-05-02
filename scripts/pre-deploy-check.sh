#!/bin/bash
# ============================================================================
# Starken OS — Pre-Deploy Validation Script
# Verifica se está seguro começar SETUP-VPS.md
# ============================================================================
# Uso: ./scripts/pre-deploy-check.sh
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

CHECKS_PASSED=0
CHECKS_FAILED=0

# ============================================================================
# Funções
# ============================================================================

check() {
    local name="$1"
    local command="$2"

    echo -n "Checking: $name ... "

    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
        ((CHECKS_PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC}"
        ((CHECKS_FAILED++))
        return 1
    fi
}

warn() {
    echo -e "${YELLOW}⚠  $1${NC}"
}

success() {
    echo -e "${GREEN}✓  $1${NC}"
}

fail() {
    echo -e "${RED}✗  $1${NC}"
}

# ============================================================================
# Banner
# ============================================================================

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║  🔍 PRE-DEPLOY VALIDATION                 ║"
echo "║  Verificando se está seguro começar       ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# ============================================================================
# SEÇÃO 1: Vercel Production Check
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "SEÇÃO 1: Vercel Production Checks"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

check "Vercel API /api/health" \
    "curl -s https://starken-os.vercel.app/api/health | grep -q 'ok'"

# ============================================================================
# SEÇÃO 2: VPS Connectivity
# ============================================================================

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "SEÇÃO 2: VPS Connectivity"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

check "VPS SSH Access" \
    "ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no root@187.77.46.199 'echo ok' > /dev/null 2>&1"

if [ $? -eq 0 ]; then
    success "SSH: Você consegue acessar a VPS"
else
    fail "SSH: Não consegue acessar a VPS (verifique IP e credenciais)"
fi

# ============================================================================
# SEÇÃO 3: Local Environment
# ============================================================================

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "SEÇÃO 3: Local Environment"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

check "Git Installed" "git --version"
check "Git Repository" "git rev-parse --is-inside-work-tree"
check "curl Installed" "curl --version"
check ".env.backup exists (optional)" "test -f .env*backup*"

if [ -f .env ]; then
    success ".env: Arquivo existe localmente"

    if grep -q SUPABASE_URL .env; then
        success ".env: Contém SUPABASE_URL"
    else
        warn ".env: NÃO contém SUPABASE_URL (adicione antes de SETUP-VPS.md)"
    fi
else
    warn ".env: Arquivo não encontrado (você precisa copiar para VPS manualmente)"
fi

# ============================================================================
# SEÇÃO 4: Documentação
# ============================================================================

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "SEÇÃO 4: Documentação"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

check "SETUP-VPS.md exists" "test -f SETUP-VPS.md"
check "SAFE-DEPLOYMENT.md exists" "test -f SAFE-DEPLOYMENT.md"
check "START-HERE.md exists" "test -f START-HERE.md"

# ============================================================================
# SEÇÃO 5: DNS
# ============================================================================

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "SEÇÃO 5: DNS Configuration"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if dig +short app.starkentecnologia.com A 2>/dev/null | grep -q "187.77.46.199"; then
    warn "⚠️  DNS: Já aponta para VPS"
    warn "   Se está em erro, execute: ./scripts/rollback.sh"
elif dig +short app.starkentecnologia.com A 2>/dev/null | grep -q "."; then
    warn "⚠️  DNS: Aponta para outro lugar (não VPS)"
    warn "   Configure em Registro.br quando pronto"
else
    success "DNS: Ainda não foi configurado (OK, configure em Registro.br depois)"
fi

# ============================================================================
# Resumo
# ============================================================================

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║  RESUMO DA VALIDAÇÃO                       ║"
echo "╠════════════════════════════════════════════╣"

if [ $CHECKS_FAILED -eq 0 ]; then
    echo "║  Status: PRONTO PARA COMEÇAR ✓            ║"
    echo "║  Checks: $CHECKS_PASSED Passed, $CHECKS_FAILED Failed             ║"
    echo "╚════════════════════════════════════════════╝"
    echo ""
    echo -e "${GREEN}Você está 100% pronto para iniciar SETUP-VPS.md${NC}"
    echo ""
    echo "Próximos passos:"
    echo "  1. Ler: START-HERE.md"
    echo "  2. Configurar DNS em Registro.br"
    echo "  3. Seguir: SETUP-VPS.md (11 STEPs)"
    echo ""
    exit 0
else
    echo "║  Status: PROBLEMAS ENCONTRADOS ✗          ║"
    echo "║  Checks: $CHECKS_PASSED Passed, $CHECKS_FAILED Failed             ║"
    echo "╚════════════════════════════════════════════╝"
    echo ""
    echo -e "${RED}Você tem $CHECKS_FAILED problema(s) a resolver:${NC}"
    echo ""
    echo "Ações:"
    echo "  1. Revisar mensagens acima (⚠  e ✗)"
    echo "  2. Resolver cada problema"
    echo "  3. Rodar script novamente: ./scripts/pre-deploy-check.sh"
    echo ""
    exit 1
fi
