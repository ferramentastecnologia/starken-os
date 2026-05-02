# 🛡️ 4 Camadas de Proteção — Resumo Executivo

**Objetivo**: Deploy para VPS **zero risco** ao sistema em produção

---

## 📊 As 4 Camadas

```
┌─────────────────────────────────────────────────────────┐
│ CAMADA 1: PRÉ-DEPLOY VALIDATION                         │
│ Scripts que verificam se está seguro começar             │
│ → scripts/pre-deploy-check.sh                           │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ CAMADA 2: ISOLATED STAGING SETUP                        │
│ VPS testada isoladamente, Vercel continua online        │
│ → SETUP-VPS.md (normal, mas sem afetar produção)        │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ CAMADA 3: ACCEPTANCE TESTING                            │
│ Testes via IP direto (http://187.77.46.199)             │
│ Antes de apontar DNS                                    │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ CAMADA 4: MONITORING & AUTOMATIC ROLLBACK               │
│ Health checks contínuos + script de rollback rápido     │
│ → scripts/health-check.sh                               │
│ → scripts/rollback.sh (< 5 minutos)                     │
└─────────────────────────────────────────────────────────┘
```

---

## 🔄 Fluxo Seguro (Passo-a-Passo)

### Dia 1: PRÉ-VALIDAÇÃO (5 min)

```bash
# Seu computador
./scripts/pre-deploy-check.sh

# Esperado:
# ✓ Vercel está OK
# ✓ VPS é acessível via SSH
# ✓ Documentação OK
# ✓ Pronto para começar
```

### Dia 1-2: STAGING SETUP (2h)

```bash
# VPS
ssh root@187.77.46.199
cd /home/ubuntu/apps/starken-os

# Seguir SETUP-VPS.md normalmente
# Nenhuma mudança em DNS ainda
# Vercel continua 100% operacional
```

### Dia 2: ACCEPTANCE TEST (30 min)

```bash
# Seu computador - testar via IP
curl -H "Host: app.starkentecnologia.com" http://187.77.46.199/api/health

# Navegador - testar UI
http://187.77.46.199

# Testes manuais:
# - Login com PIN
# - Dashboard
# - Publicação test
# - Agendamento

# Verificar logs
ssh root@187.77.46.199
pm2 logs starken-api
tail -f /var/log/nginx/starken_error.log
```

### Dia 2: CUTOVER COM FALLBACK (DNS)

```bash
# Registro.br: Apontar app A 187.77.46.199

# VPS: Ativar monitoring
ssh root@187.77.46.199
pm2 start scripts/health-check.sh --name health-check

# Seu computador: Monitorar por 1 HORA
watch -n 10 'curl -s https://app.starkentecnologia.com/api/health'
```

### Qualquer Hora: ROLLBACK RÁPIDO

```bash
# Se algo der errado (< 5 minutos):
ssh root@187.77.46.199
./scripts/rollback.sh

# Depois em Registro.br:
# Deletar ou desativar record app

# Resultado: API volta para Vercel
```

---

## 🛠️ Scripts Disponíveis

### 1. Pre-Deploy Check (LOCAL)

```bash
./scripts/pre-deploy-check.sh
```

**O que faz**:
- ✅ Verifica Vercel está saudável
- ✅ Testa SSH na VPS
- ✅ Valida documentação
- ✅ Verifica DNS status
- ✅ Confirma .env existe

**Quando usar**: Antes de começar SETUP-VPS.md

---

### 2. Rollback Script (VPS)

```bash
# SSH na VPS
ssh root@187.77.46.199

# Executar rollback
./scripts/rollback.sh

# O que faz:
#  1. Parar Node.js (PM2)
#  2. Parar nginx
#  3. Instruir deletar DNS record em Registro.br
```

**Tempo**: < 5 minutos
**Impacto**: Zero (Vercel continua online)
**Dados**: Nenhum perdido (Supabase intacto)

---

### 3. Health Check Monitor (VPS)

```bash
# SSH na VPS
ssh root@187.77.46.199

# Instalar
pm2 start scripts/health-check.sh --name health-check
pm2 save

# O que faz:
#  • Checa /api/health a cada 60s
#  • Alerta se falhar
#  • Log de histórico de alertas

# Ver logs
pm2 logs health-check
cat /tmp/starken-health-alerts.log
```

**Rodando após**: DNS apontado para VPS

---

## 📋 Checklist: Cada Fase

### ANTES de Começar

- [ ] Ler SAFE-DEPLOYMENT.md (compreender estratégia)
- [ ] Ler este documento
- [ ] Rodar: `./scripts/pre-deploy-check.sh`
- [ ] Todos os checks passaram ✓
- [ ] Vercel testado e OK

### DURANTE Setup (VPS)

- [ ] SSH acesso ✓
- [ ] SETUP-VPS.md executado ✓
- [ ] Sem erros nos logs ✓
- [ ] PM2 rodando ✓
- [ ] nginx testado ✓

### ANTES de Apontar DNS

- [ ] Testar via IP: `curl http://187.77.46.199/api/health`
- [ ] Abrir navegador: `http://187.77.46.199`
- [ ] Login funciona ✓
- [ ] Dashboard OK ✓
- [ ] Publicação test OK ✓
- [ ] Logs limpos de erros ✓

### APÓS Apontar DNS

- [ ] Monitoring ativado: `pm2 start health-check.sh`
- [ ] Monitorar por 1 HORA
- [ ] Testar via HTTPS: `https://app.starkentecnologia.com`
- [ ] Zero erros 500/502/503 ✓
- [ ] Users acessando normalmente ✓

### ROLLBACK (se necessário)

- [ ] `./scripts/rollback.sh`
- [ ] Deletar DNS em Registro.br
- [ ] Esperar propagação (5-60 min)
- [ ] Verificar Vercel respondendo ✓

---

## 🚨 Cenários & Respostas

| Cenário | Risco | Resposta | Tempo |
|---------|-------|----------|-------|
| Erro em SETUP-VPS STEP 2 | BAIXO | Reexecuta STEP 2 | 5 min |
| Erro em nginx config | MÉDIO | `sudo nginx -t`, corrigir, `sudo systemctl reload nginx` | 5 min |
| API retorna 500 | MÉDIO | `pm2 logs`, investigar, `pm2 restart` | 5 min |
| DNS não propaga | BAIXO | Esperar, não afeta produção | N/A |
| Vercel offline | N/A | VPS ativa como backup | 0 impacto |
| Erro critico (não resolve) | ALTO | `./scripts/rollback.sh`, volta para Vercel | < 5 min |

---

## 🎯 Por Que Você Está Seguro

```
┌─ VERCEL (PRODUÇÃO)
│  └─ 100% operacional durante setup
│  └─ Mantém até após DNS cutover
│  └─ Pode reativar em < 5 min
│
├─ VPS (STAGING)
│  └─ Teste isolado
│  └─ Sem afetar produção
│  └─ Validação completa antes de "go live"
│
└─ SUPABASE (DADOS)
   └─ Compartilhado entre Vercel e VPS
   └─ Nenhum dado é perdido em rollback
   └─ Backups automáticos do Supabase
```

---

## 📊 Timeline Recomendada

```
SEGUNDA (Dia 1):
  09:00 - Rodar pre-deploy-check.sh (5 min)
  10:00 - Configurar DNS Registro.br (5 min)
  10:30 - Esperar DNS propagar (30-120 min)
  12:00 - Começar SETUP-VPS.md se DNS OK

TERÇA (Dia 2):
  10:00 - SETUP-VPS.md continuado
  12:00 - SETUP completo (2h total)
  14:00 - Acceptance test via IP
  16:00 - Se tudo OK: apontar DNS
  17:00 - Monitoring por 1 HORA
  18:00 - PRONTO! ✓

BACKUP:
  Qualquer hora: ./scripts/rollback.sh (< 5 min)
```

---

## 🔐 Checklist Final de Segurança

Antes de "ir para produção":

- [ ] Vercel está online
- [ ] VPS testada isoladamente
- [ ] API responde via IP
- [ ] Login funciona
- [ ] Dashboard OK
- [ ] Publicações funcionam
- [ ] Agendamentos funcionam
- [ ] Logs sem erros
- [ ] PM2 rodando
- [ ] nginx rodando
- [ ] SSL/HTTPS valid
- [ ] Health check script instalado
- [ ] Rollback script pronto
- [ ] Alguém disponível por 1 hora pós-cutover

---

## 📞 Se Algo Der Errado

**Nunca entre em pânico**:

1. **Manter calma** — Você tem rollback em < 5 min
2. **Diagnosticar**
   ```bash
   pm2 logs starken-api
   tail -f /var/log/nginx/starken_error.log
   ```
3. **Se for rápido de consertar** → Consertar
4. **Se for complexo** → Rollback (`./scripts/rollback.sh`)

---

## 💡 Resumo de Segurança

| Camada | Proteção | Script |
|--------|----------|--------|
| PRÉ-VALIDAÇÃO | Verifica tudo antes | `pre-deploy-check.sh` |
| STAGING | Isolamento completo | (SETUP-VPS.md normal) |
| TESTES | Aceitação antes de DNS | (Manual via IP) |
| PRODUCTION | Health checks + Rollback | `health-check.sh` + `rollback.sh` |

**Resultado**: Zero risco ao sistema em operação

---

**Você está 100% protegido!** 🛡️

Próximo: Ler [START-HERE.md](START-HERE.md) e começar!

---

*Versão: 2.0.0 | Data: 2026-05-02*
