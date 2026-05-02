#!/bin/bash
# ============================================================================
# Starken OS — DEPLOY MASTER SCRIPT
# Automação completa da transição Vercel → VPS
# ============================================================================
# Uso: bash DEPLOY.sh
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ============================================================================
# MENU PRINCIPAL
# ============================================================================

clear

echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║                                                                    ║"
echo "║   🚀 STARKEN OS — AUTOMATED DEPLOYMENT                            ║"
echo "║      Vercel → VPS Hostinger                                       ║"
echo "║                                                                    ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""
echo "Escolha uma opção:"
echo ""
echo "  1. 🔍 PRÉ-VALIDAÇÃO (verifique tudo antes de começar)"
echo "  2. 📊 SETUP AUTOMÁTICO (depois que DNS estiver apontado)"
echo "  3. 🔄 ROLLBACK (volta para Vercel em < 5 min)"
echo "  4. 📋 VER DOCUMENTAÇÃO"
echo "  5. 🔧 SSH NA VPS (acesso direto)"
echo "  6. ❌ SAIR"
echo ""
read -p "Digite o número (1-6): " CHOICE

case $CHOICE in

# ============================================================================
# OPÇÃO 1: PRÉ-VALIDAÇÃO
# ============================================================================
1)
    clear
    echo -e "${BLUE}Executando PRÉ-VALIDAÇÃO...${NC}"
    echo ""
    bash scripts/pre-deploy-check.sh
    ;;

# ============================================================================
# OPÇÃO 2: SETUP AUTOMÁTICO
# ============================================================================
2)
    clear
    echo -e "${BLUE}Executando SETUP AUTOMÁTICO...${NC}"
    echo ""
    echo "⚠️  IMPORTANTE:"
    echo "  • DNS deve estar apontado para 187.77.46.199"
    echo "  • VPS debe ser acessível via SSH"
    echo "  • .env deve conter credenciais Supabase"
    echo ""
    read -p "Continuar? (s/n): " CONFIRM
    if [[ "$CONFIRM" != "s" && "$CONFIRM" != "S" ]]; then
        echo "Cancelado."
        exit 0
    fi

    bash scripts/automated-setup.sh
    ;;

# ============================================================================
# OPÇÃO 3: ROLLBACK
# ============================================================================
3)
    clear
    echo -e "${RED}🚨 ROLLBACK — Volta para Vercel${NC}"
    echo ""
    echo "Isto vai:"
    echo "  • Parar Node.js (PM2)"
    echo "  • Parar nginx"
    echo "  • Instruir deletar DNS record"
    echo ""
    echo "Tempo: < 5 minutos"
    echo "Impacto: ZERO (Vercel volta online)"
    echo ""
    read -p "Tem certeza? (digita 'sim' para confirmar): " CONFIRM
    if [ "$CONFIRM" = "sim" ]; then
        ssh root@187.77.46.199 "bash /home/ubuntu/apps/starken-os/scripts/rollback.sh"
    else
        echo "Cancelado."
    fi
    ;;

# ============================================================================
# OPÇÃO 4: DOCUMENTAÇÃO
# ============================================================================
4)
    clear
    echo -e "${BLUE}📋 DOCUMENTAÇÃO DISPONÍVEL${NC}"
    echo ""
    echo "1. SAFETY-SUMMARY.txt       - Resumo visual das proteções"
    echo "2. SAFE-DEPLOYMENT.md       - Estratégia completa"
    echo "3. START-HERE.md            - Comece aqui"
    echo "4. SETUP-VPS.md             - 11 STEPs detalhados"
    echo "5. REGISTROBR-VISUAL.md     - Guia DNS visual"
    echo "6. SECURITY-LAYERS.md       - 4 camadas de proteção"
    echo ""
    read -p "Qual arquivo quer ver? (1-6 ou outro para sair): " DOC

    case $DOC in
        1) less SAFETY-SUMMARY.txt ;;
        2) less SAFE-DEPLOYMENT.md ;;
        3) less START-HERE.md ;;
        4) less SETUP-VPS.md ;;
        5) less REGISTROBR-VISUAL.md ;;
        6) less SECURITY-LAYERS.md ;;
    esac
    ;;

# ============================================================================
# OPÇÃO 5: SSH NA VPS
# ============================================================================
5)
    clear
    echo -e "${BLUE}SSH na VPS${NC}"
    echo ""
    echo "Conectando em: root@187.77.46.199"
    echo ""
    ssh root@187.77.46.199
    ;;

# ============================================================================
# OPÇÃO 6: SAIR
# ============================================================================
6)
    echo "Até logo! 👋"
    exit 0
    ;;

*)
    echo -e "${RED}Opção inválida!${NC}"
    exit 1
    ;;

esac

echo ""
echo "Pressione ENTER para voltar ao menu..."
read
exec bash DEPLOY.sh
