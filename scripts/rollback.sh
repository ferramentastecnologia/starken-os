#!/bin/bash
# ============================================================================
# Starken OS — Rollback Script
# Desativa VPS e aponta DNS de volta para Vercel
# ============================================================================
# Uso: ./scripts/rollback.sh
# ============================================================================

set -e  # Exit on error

echo "╔════════════════════════════════════════════╗"
echo "║  🔄 STARKEN OS — ROLLBACK SCRIPT          ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# ============================================================================
# PASSO 1: Parar Node.js
# ============================================================================

echo -e "${YELLOW}[1/3] Parando Node.js (PM2)...${NC}"

if command -v pm2 &> /dev/null; then
    pm2 stop starken-api 2>/dev/null || true
    echo -e "${GREEN}✓ PM2 parado${NC}"
else
    echo -e "${YELLOW}⚠ PM2 não encontrado (pode estar rodando manualmente)${NC}"
fi

# ============================================================================
# PASSO 2: Parar nginx
# ============================================================================

echo -e "${YELLOW}[2/3] Parando nginx...${NC}"

if command -v systemctl &> /dev/null; then
    sudo systemctl stop nginx 2>/dev/null || true
    echo -e "${GREEN}✓ nginx parado${NC}"
else
    echo -e "${YELLOW}⚠ systemctl não disponível${NC}"
fi

# ============================================================================
# PASSO 3: Instruções DNS
# ============================================================================

echo ""
echo -e "${RED}[3/3] AÇÃO MANUAL NECESSÁRIA - DNS${NC}"
echo ""
echo "PASOS:"
echo "  1. Abrir: https://registro.br"
echo "  2. Domínio: starkentecnologia.com"
echo "  3. Zona DNS → Editar"
echo "  4. Record 'app' A 187.77.46.199:"
echo "     • DELETAR ou"
echo "     • MUDAR para outro IP (não fazer agora)"
echo ""
echo "  ISSO APONTA API DE VOLTA PARA:"
echo "  https://starken-os.vercel.app"
echo ""
echo "Após deletar em Registro.br (5-60 min para propagar):"
echo ""

# ============================================================================
# PASSO 4: Verificação
# ============================================================================

echo -e "${YELLOW}Verificando status...${NC}"
echo ""

if command -v pm2 &> /dev/null; then
    echo "PM2 status:"
    pm2 status 2>/dev/null || echo "  (PM2 não disponível)"
fi

echo ""
echo "nginx status:"
if command -v systemctl &> /dev/null; then
    sudo systemctl status nginx 2>/dev/null || echo "  (nginx não está rodando)"
fi

# ============================================================================
# Resumo
# ============================================================================

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║  ✓ ROLLBACK PREPARADO                     ║"
echo "╠════════════════════════════════════════════╣"
echo "║  VPS: DESATIVADO                           ║"
echo "║  Próximo: Deletar DNS app em Registro.br  ║"
echo "║  Resultado: API volta para Vercel          ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo "Tempo até propagação DNS: 5-60 minutos"
echo "Impacto: ZERO (Vercel permanece online)"
echo ""

# ============================================================================
# Instruções para reverter rollback (se necessário)
# ============================================================================

echo -e "${YELLOW}Para reverter este rollback (reativar VPS):${NC}"
echo "  1. Apontar DNS para 187.77.46.199 novamente"
echo "  2. SSH na VPS: ssh root@187.77.46.199"
echo "  3. Iniciar PM2: pm2 start starken-api"
echo "  4. Verificar: curl https://app.starkentecnologia.com/api/health"
echo ""
