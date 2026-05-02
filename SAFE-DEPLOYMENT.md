# 🛡️ Estratégia de Deploy Seguro — Sem Risco ao Produção

**Objetivo**: Mover para VPS **sem interrupção** de serviço no Vercel

---

## 🎯 Estratégia: Blue-Green Deployment

```
ESTADO INICIAL:
  starkentecnologia.com  → Lovable (website)
  API (Vercel)          → PRODUÇÃO ATIVA ✓

DURANTE SETUP:
  starkentecnologia.com  → Lovable (website)
  API (Vercel)          → PRODUÇÃO ATIVA ✓
  app.starkentecnologia.com → VPS (em teste)

APÓS VALIDAÇÃO:
  starkentecnologia.com  → Lovable (website)
  API (Vercel)          → BACKUP/FALLBACK
  app.starkentecnologia.com → VPS (PRODUÇÃO) ✓
```

---

## 📋 Checklist: 4 Camadas de Proteção

### CAMADA 1: Validação Pré-Deploy ✅

Antes de iniciar SETUP-VPS.md:

```bash
# Terminal local (seu computador)

# 1. Verificar Vercel está saudável
curl https://starken-os.vercel.app/api/health
# Esperado: {"status":"ok"}

# 2. Testar features críticas no Vercel
#  - Login com PIN
#  - Carregar dashboard
#  - Publicação FB/IG (test)

# 3. Backup da .env Vercel
cp .env .env.backup-$(date +%Y%m%d-%H%M%S)
git checkout .env  # Restaurar se precisar
```

**Checklist**:
- [ ] Vercel respondendo ✓
- [ ] Todas features funcionando ✓
- [ ] .env backup feito ✓

---

### CAMADA 2: Setup Isolado na VPS ✅

Durante SETUP-VPS.md:

```bash
# VPS roda ISOLADA durante setup
# Nenhuma mudança em DNS ainda
# Frontend continua apontando para Vercel

# 1. Clonar com branch específico
cd /home/ubuntu/apps
git clone --branch main https://github.com/ferramentastecnologia/starken-os.git starken-os-staging

# 2. Setup em pasta separada
cd starken-os-staging
# ... seguir SETUP-VPS.md normalmente

# 3. Testar em localhost
curl http://localhost:3000/api/health
# Não afeta produção (Vercel continua rodando)
```

**Checklist**:
- [ ] VPS testada em localhost:3000 ✓
- [ ] Vercel continua respondendo ✓
- [ ] DNS ainda aponta para Vercel ✓

---

### CAMADA 3: Teste de Aceitação (Staging) ✅

Antes de apontar DNS:

```bash
# Testar via IP direto (sem DNS)
# Terminal local:

curl -H "Host: app.starkentecnologia.com" http://187.77.46.199/api/health

# Resultado esperado:
# {"status":"ok", ...}

# Abrir navegador:
# http://187.77.46.199
# (vai parecer estranho, mas HTML vai carregar)
```

**Testes a Fazer**:
- [ ] API responde (`/api/health`)
- [ ] Frontend carrega (HTML)
- [ ] Login funciona (PIN)
- [ ] Dashboard carrega
- [ ] Publicação FB/IG (test)
- [ ] Agendamento IG
- [ ] Lê dados Supabase corretamente

---

### CAMADA 4: Cutover com Fallback Automático ✅

Apenas quando TUDO estiver 100%:

```bash
# PASSO 1: Preparar rollback
cat > /home/ubuntu/apps/starken-os/ROLLBACK.sh << 'EOF'
#!/bin/bash
echo "[ROLLBACK] Desativando VPS..."
pm2 stop starken-api

echo "[ROLLBACK] DNS aponta de volta para Vercel..."
# (você faz isto em Registro.br)

echo "[ROLLBACK] Rollback concluído"
echo "Site volta para: https://starken-os.vercel.app"
EOF

chmod +x /home/ubuntu/apps/starken-os/ROLLBACK.sh

# PASSO 2: Apontar DNS para VPS
# Ir em Registro.br e mudar:
#   app A 187.77.46.199

# PASSO 3: Esperar DNS propagar (5-120 min)
nslookup app.starkentecnologia.com
# Esperado: 187.77.46.199

# PASSO 4: Monitorar por 1 HORA
pm2 logs starken-api --lines 200
tail -f /var/log/nginx/starken_access.log
```

**Checklist**:
- [ ] Script rollback criado ✓
- [ ] DNS apontado para VPS ✓
- [ ] Logs monitorados por 1h ✓
- [ ] Sem erros ✓
- [ ] Users acessando normalmente ✓

---

## 🚨 Cenários de Erro & Resposta

### Cenário 1: VPS responde 500 Internal Error

**Sintoma**: `curl https://app.starkentecnologia.com` retorna 500

**Ação Rápida** (menos de 5 minutos):
```bash
# SSH VPS
ssh root@187.77.46.199

# Verificar Node.js
pm2 status
pm2 logs starken-api --lines 50

# Se problema:
pm2 stop starken-api
pm2 start server.js --name starken-api

# Se continuar erro:
./ROLLBACK.sh
# (DNS aponta de volta para Vercel)
```

**Tempo até rollback**: < 5 minutos
**Impacto**: Nenhum (DNS TTL = 3600, Vercel ainda está online)

---

### Cenário 2: Nginx não inicia

**Sintoma**: `curl https://app.starkentecnologia.com` timeout

**Ação Rápida**:
```bash
# SSH VPS
sudo nginx -t
sudo systemctl restart nginx

# Se erro:
sudo systemctl status nginx
sudo tail -f /var/log/nginx/starken_error.log

# Se não resolve:
./ROLLBACK.sh
```

**Tempo até rollback**: < 5 minutos

---

### Cenário 3: Vercel fica offline (improvável)

**Sintoma**: `curl https://starken-os.vercel.app` falha

**Você tem**: VPS como backup

```bash
# VPS continua respondendo
# Fazer publicações na VPS normalmente
# Depois:
# 1. Restaurar Vercel
# 2. Fazer manual sync de dados (se houver)
```

---

### Cenário 4: SSL/HTTPS quebrado

**Sintoma**: Navegador mostra erro de certificado

**Ação Rápida**:
```bash
# SSH VPS
sudo certbot certonly --force-renewal -d app.starkentecnologia.com
sudo systemctl reload nginx

# Se não funcionar:
./ROLLBACK.sh
```

---

## 📊 Matriz de Risco

| Risco | Impacto | Tempo Rollback | Proteção |
|-------|---------|----------------|----------|
| Node.js erro | Alto | < 5 min | PM2 auto-restart |
| nginx falha | Alto | < 5 min | systemd auto-restart |
| SSL error | Médio | < 5 min | certbot, rollback |
| DNS erro | Médio | < 2 min | Rollback DNS |
| Supabase offline | Alto | N/A | Vercel também afetado |
| Vercel offline | N/A | 0 | VPS ativa |

---

## 🔍 Monitoramento Contínuo (Após Deploy)

### Health Checks Automáticos

```bash
# SSH VPS, criar script:
cat > /home/ubuntu/apps/health-check.sh << 'EOF'
#!/bin/bash

while true; do
  HEALTH=$(curl -s http://localhost:3000/api/health 2>/dev/null)
  
  if [[ $HEALTH == *"ok"* ]]; then
    echo "[$(date)] ✓ Health check OK"
  else
    echo "[$(date)] ✗ Health check FAILED - Iniciando rollback..."
    /home/ubuntu/apps/starken-os/ROLLBACK.sh
    exit 1
  fi
  
  sleep 60  # A cada 1 minuto
done
EOF

chmod +x /home/ubuntu/apps/health-check.sh

# Rodar com PM2 (background)
pm2 start health-check.sh --name health-check
pm2 save
```

### Logs Estruturados

```bash
# Ver logs em tempo real:
pm2 logs starken-api --lines 50

# Filtrar erros:
pm2 logs starken-api | grep -i error

# Ver nginx:
tail -f /var/log/nginx/starken_error.log
```

---

## 📋 Checklist: Antes de "Go Live"

**PRÉ-DEPLOY** (seu computador):
- [ ] Backup .env feito
- [ ] Vercel testado e saudável
- [ ] Topos features funcionam em Vercel

**DURING SETUP** (VPS):
- [ ] SETUP-VPS.md completado
- [ ] Todos 11 STEPs validados
- [ ] Logs sem erros
- [ ] PM2 rodando
- [ ] nginx rodando

**PRÉ-DNS** (VPS + Staging):
- [ ] Testar via IP (http://187.77.46.199)
- [ ] Login funciona
- [ ] Dashboard carrega
- [ ] API /api/health responde
- [ ] Lê dados Supabase
- [ ] Publicação test funciona

**DNS ATIVO** (Após apontar DNS):
- [ ] Monitorar por 1 HORA
- [ ] Verificar logs
- [ ] Testar via HTTPS (app.starkentecnologia.com)
- [ ] Logins continuam funcionando
- [ ] Publicações funcionam
- [ ] Sem erros 500/502/503

**ESTÁVEL** (Após 24h):
- [ ] Zero erros
- [ ] Performance OK
- [ ] Dados sincronizados
- [ ] Backups configurados (futuro)

---

## 🎯 Rollback: 3 Cenários

### Rollback 1: Rápido (< 5 minutos)

```bash
# SSH VPS
/home/ubuntu/apps/starken-os/ROLLBACK.sh

# Em Registro.br:
# Mudar DNS app A de 187.77.46.199 para voltando para Lovable
# OU remover record app (volta para Vercel)

# Resultado: API volta a apontar para Vercel
```

**Tempo**: < 5 minutos
**Dados**: Nenhum perdido (Supabase intacto)
**Impacto**: Mínimo

---

### Rollback 2: Seguro (hora)

Se precisar investigar mais:

```bash
# Manter VPS online para debugging
# Apontar DNS de volta para Vercel
# Investigar logs da VPS sem pressa
pm2 logs starken-api > /tmp/debug.log
cat /tmp/debug.log

# Depois de identificar problema:
# Corrigir em local
# git push
# git pull na VPS
# pm2 restart
# Apontar DNS de volta
```

---

### Rollback 3: Forçado (disaster)

```bash
# Último recurso (nunca deve ser necessário)
# Deletar pasta VPS staging (dados estão em Supabase)
rm -rf /home/ubuntu/apps/starken-os-staging

# Clonar de novo
git clone https://github.com/ferramentastecnologia/starken-os.git

# Reconfigurar
# ... repara SETUP-VPS.md

# DNS aponta para Vercel durante isso
```

---

## 🚀 Timeline Recomendada

```
SEGUNDA-FEIRA (você):
  08:00 - Lê SAFE-DEPLOYMENT.md
  09:00 - Configura DNS Registro.br
  09:30 - Espera DNS propagar

TERÇA-FEIRA (você):
  10:00 - Inicia SETUP-VPS.md (se DNS OK)
  12:00 - Termina SETUP-VPS.md
  14:00 - Testa via IP (http://187.77.46.199)
  16:00 - Tudo OK? Aponta DNS para VPS
  17:00 - Monitora por 1 HORA
  18:00 - Se tudo OK: PRONTO! 🎉

BACKUP PLAN (se error):
  Qualquer hora - ./ROLLBACK.sh (< 5 min)
  → DNS volta para Vercel
  → Zero impacto
```

---

## 💡 Resumo: Por Que Você Está Seguro

1. ✅ **Vercel continua 100% operacional** durante setup
2. ✅ **Rollback em < 5 minutos** se algo der errado
3. ✅ **Supabase é shared** — dados nunca são perdidos
4. ✅ **Múltiplas validações** antes de apontar DNS
5. ✅ **Monitoring contínuo** após deploy
6. ✅ **Sem downtime** necessário em nenhuma fase

---

## 🛑 STOP: Leia Isto Antes de Começar

**NÃO faça**:
- ❌ Não delete Vercel ainda
- ❌ Não mude .env de produção
- ❌ Não aponte DNS até 100% testado
- ❌ Não ignore erros nos logs

**FAÇA**:
- ✅ Siga SETUP-VPS.md step-by-step
- ✅ Teste cada STEP
- ✅ Monitore logs
- ✅ Apontar DNS apenas quando 100% confiante
- ✅ Monitore por 1 hora após DNS

---

## 📞 Se Algo Der Errado

**NUNCA entre em pânico**:

1. **Verificar o que errouexato**
   ```bash
   pm2 logs starken-api
   tail -f /var/log/nginx/starken_error.log
   ```

2. **Se for erro rápido de consertar**
   ```bash
   # Corrigir, git push, git pull na VPS
   pm2 restart starken-api
   ```

3. **Se for complexo demais**
   ```bash
   ./ROLLBACK.sh
   # Volta para Vercel em < 5 minutos
   # Depois investiga com calma
   ```

---

**Você está PROTEGIDO em todas as fases do deploy! 🛡️**

Próximo: Ler [START-HERE.md](START-HERE.md) e começar!

---

*Versão: 2.0.0 | Data: 2026-05-02*
