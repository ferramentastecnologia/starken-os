# 🚀 Guia de Setup — Starken OS em VPS AlmaLinux

**Hostinger VPS AlmaLinux 10**
- IP: `187.77.46.199`
- Host: `srv1620706.hstgr.cloud`
- SSH User: `root`
- Memory: 4 GB
- Disk: 50 GB

**Tempo estimado**: ~2 horas (primeira vez), ~10 minutos (updates futuros)

---

## ⚡ Quick Start (5 minutos de leitura)

```bash
# 1. SSH na VPS
ssh root@187.77.46.199

# 2. Clonar repo
cd /home/ubuntu && git clone https://github.com/ferramentastecnologia/starken-os.git

# 3. Setup automático (se disponível)
cd starken-os && bash setup.sh

# Ou manual: ver STEP-BY-STEP abaixo ↓
```

---

## 📋 Step-by-Step Setup Manual

### STEP 1: Preparação da VPS (5 min)

```bash
ssh root@187.77.46.199

# 1.1 Atualizar sistema
sudo dnf update -y
sudo dnf install -y wget curl git nano vim

# 1.2 Criar user não-root (opcional, mas recomendado)
# (Se quiser, usuário root é ok para primeira vez)

# 1.3 Criar diretório para apps
mkdir -p /home/ubuntu/apps
cd /home/ubuntu/apps
```

**Verificar**:
```bash
node --version  # (não deve existir ainda)
```

---

### STEP 2: Node.js 20 LTS (5 min)

**Opção A: NodeSource (recomendado)**

```bash
# 2.1 Adicionar repositório NodeSource
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -

# 2.2 Instalar Node.js + npm
sudo dnf install -y nodejs

# 2.3 Verificar
node --version   # v20.x.x
npm --version    # 10.x.x
```

**Opção B: AlmaLinux default (versão antiga)**
```bash
# NÃO RECOMENDADO, mas alternativa:
sudo dnf install -y nodejs npm
```

---

### STEP 3: Clonar Repositório (2 min)

```bash
cd /home/ubuntu/apps

# 3.1 Clone do GitHub
git clone https://github.com/ferramentastecnologia/starken-os.git
cd starken-os

# 3.2 Verificar branch
git branch -a
git status
```

**Resultado esperado**:
```
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
```

---

### STEP 4: Instalar Dependências (3 min)

```bash
cd /home/ubuntu/apps/starken-os

# 4.1 Instalar Express
npm install

# 4.2 Verificar
npm list --depth=0
```

**Resultado esperado**:
```
starken-os@2.0.0
└── express@4.18.2
```

---

### STEP 5: Variáveis de Ambiente (3 min)

```bash
# 5.1 Criar .env
nano .env
```

**Colar conteúdo abaixo** (preencher com seus valores reais):

```bash
NODE_ENV=production
PORT=3000

SUPABASE_URL=https://cpwpxckmuecejtkcobre.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...  # (copiar do .env local ou Supabase)
SUPABASE_SERVICE_KEY=eyJhbGc... # (copiar do Supabase console)

META_APP_ID=...
META_APP_SECRET=...
META_API_VERSION=v25.0
```

**Salvar**: Ctrl+O, Enter, Ctrl+X

**Verificar**:
```bash
cat .env | grep NODE_ENV
```

---

### STEP 6: Testar Node.js Localmente (5 min)

```bash
cd /home/ubuntu/apps/starken-os

# 6.1 Iniciar servidor
NODE_ENV=production PORT=3000 node server.js
```

**Resultado esperado**:
```
╔════════════════════════════════════════════╗
║  🚀 Starken OS — Express Server Started   ║
╠════════════════════════════════════════════╣
║  Port: 3000                            ║
║  Env:  production                          ║
║  Time: 2026-05-02T10:00:00.000Z           ║
╚════════════════════════════════════════════╝
   → Frontend: http://localhost:3000
   → API: http://localhost:3000/api/health
```

**6.2 Testar em outro terminal**:
```bash
# SSH novo na VPS
ssh root@187.77.46.199

# Testar API
curl http://localhost:3000/api/health

# Resultado esperado:
# {"status":"ok","timestamp":"2026-05-02T10:00:00.000Z","uptime":...}
```

**6.3 Parar servidor** (no primeiro terminal): `Ctrl+C`

---

### STEP 7: PM2 para Gerenciar Processo (5 min)

```bash
cd /home/ubuntu/apps/starken-os

# 7.1 Instalar PM2 globalmente
sudo npm install -g pm2

# 7.2 Iniciar server.js com PM2
pm2 start server.js --name "starken-api"

# 7.3 Verificar status
pm2 status

# 7.4 Ver logs
pm2 logs starken-api

# 7.5 Salvar lista PM2 (para reboot)
pm2 save
```

**Resultado esperado**:
```
┌─────┬──────────────┬─────────┬─────────┬─────────────┐
│ id  │ name         │ version │ pm_id   │ status      │
├─────┼──────────────┼─────────┼─────────┼─────────────┤
│ 0   │ starken-api  │ 2.0.0   │ 0       │ online      │
└─────┴──────────────┴─────────┴─────────┴─────────────┘
```

**7.6 Configurar para reboot automático**:
```bash
pm2 startup
# Seguir instruções (copiar/colar comando systemd)

# Depois testar reboot
sudo reboot
# (esperar 1 min)
ssh root@187.77.46.199
pm2 status
# Deve mostrar 'starken-api' em 'online'
```

---

### STEP 8: Nginx - Reverse Proxy (10 min)

```bash
# 8.1 Instalar nginx
sudo dnf install -y nginx

# 8.2 Copiar config
sudo cp /home/ubuntu/apps/starken-os/nginx.conf /etc/nginx/conf.d/starkentecnologia.conf

# 8.3 Remover default config (AlmaLinux)
sudo rm -f /etc/nginx/conf.d/default.conf

# 8.4 Testar config nginx
sudo nginx -t

# Resultado esperado:
# nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful
```

**8.5 Iniciar nginx**:
```bash
sudo systemctl start nginx
sudo systemctl status nginx

# Resultado esperado: 'active (running)'

# 8.6 Ativar para reboot
sudo systemctl enable nginx
```

**8.7 Verificar que nginx prova para Node.js**:
```bash
curl -H "Host: starkentecnologia.com" http://localhost/api/health

# Resultado esperado:
# {"status":"ok",...}
```

---

### STEP 9: SSL/HTTPS com Let's Encrypt (10 min)

```bash
# 9.1 Instalar certbot
sudo dnf install -y certbot python3-certbot-nginx

# 9.2 Obter certificado (para subdomínio)
sudo certbot certonly --standalone \
  -d app.starkentecnologia.com \
  --email seu-email@example.com \
  --agree-tos -n

# Resultado esperado:
# Successfully received certificate.
# Certificate is saved at: /etc/letsencrypt/live/app.starkentecnologia.com/...
```

**9.3 Recarregar nginx com SSL**:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

**9.4 Verificar HTTPS**:
```bash
curl -I https://starkentecnologia.com/api/health

# Resultado esperado:
# HTTP/1.1 200 OK
# Content-Type: application/json
```

**9.5 Auto-renovação (automático)**:
```bash
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

---

### STEP 10: Configurar Domínio DNS em Registro.br (5 min)

Este passo é feito no painel Registro.br (seu registrador):

```
1. Abrir painel Registro.br
2. Acessar zona DNS de starkentecnologia.com
3. Adicionar/Editar record A:
   - Nome do Host: app
   - Tipo: A (address)
   - Valor: 187.77.46.199
   - TTL: 3600 (ou padrão)

4. Salvar e esperar propagação (5 min - 2 horas)
```

**Verificar propagação** (terminal local):
```bash
# Terminal do seu computador
nslookup app.starkentecnologia.com

# Resultado esperado:
# Server: ...
# Name: app.starkentecnologia.com
# Address: 187.77.46.199
```

**Enquanto isso**: Site principal continua em `starkentecnologia.com` (Lovable)

---

### STEP 11: Validação Completa (10 min)

```bash
# 11.1 Verificar aplicação online
curl https://app.starkentecnologia.com/api/health

# 11.2 Abrir em navegador (esperar DNS propagação)
# https://app.starkentecnologia.com

# 11.3 Testar features críticas
#  - Login com PIN
#  - Carregar dashboard
#  - Publicar post no Facebook
#  - Agendamento IG
#  - Calendário de posts

# 11.4 Verificar logs
pm2 logs starken-api
tail -f /var/log/nginx/starken_access.log
```

---

## 🔧 Troubleshooting

### Node.js não começa

```bash
# Verificar erros
NODE_ENV=production PORT=3000 node server.js

# Erro comum: "Port 3000 already in use"
lsof -i :3000
kill -9 <PID>

# Erro: ".env not found"
cd /home/ubuntu/apps/starken-os
nano .env  # criar arquivo
```

### nginx retorna 502 Bad Gateway

```bash
# Verificar que Node.js está rodando
pm2 status

# Se não:
pm2 start server.js --name "starken-api"

# Verificar logs
sudo tail -f /var/log/nginx/starken_error.log
```

### SSL certificado expirado

```bash
# Renovar manualmente
sudo certbot renew --force-renewal

# Ou deixar automático (já configurado)
sudo systemctl status certbot.timer
```

### Mudar configuração nginx

```bash
# 1. Editar config
sudo nano /etc/nginx/conf.d/starkentecnologia.conf

# 2. Testar
sudo nginx -t

# 3. Recarregar
sudo systemctl reload nginx
```

---

## 📦 Deploy Futuro (Pull Manual)

Sempre que fizer push no GitHub:

```bash
ssh root@187.77.46.199
cd /home/ubuntu/apps/starken-os

# Pull última versão
git pull origin main

# Instalar novas dependências (se houver)
npm install

# Reiniciar Node.js
pm2 restart starken-api

# Verificar
pm2 logs starken-api
```

---

## 🔄 Rollback para Vercel (Emergência)

Se algo der muito errado:

```bash
# 1. DNS: apontar domínio de volta para Vercel
#    (seu registrador → mudar A record)

# 2. Vercel permanece rodando em:
#    https://starken-os.vercel.app

# 3. VPS continua em segundo plano para troubleshooting
```

---

## 📊 Monitoramento Contínuo

### Logs

```bash
# Node.js (PM2)
pm2 logs starken-api --lines 100

# Nginx (access)
tail -f /var/log/nginx/starken_access.log

# Nginx (errors)
tail -f /var/log/nginx/starken_error.log

# Sistema
dmesg | tail -20
```

### Status

```bash
# Node.js
pm2 status

# Nginx
systemctl status nginx

# Disco
df -h

# Memória
free -h

# Uptime VPS
uptime
```

---

## ✅ Checklist Pós-Setup

- [ ] Node.js 20 LTS instalado
- [ ] Repositório clonado em `/home/ubuntu/apps/starken-os`
- [ ] `.env` criado com credenciais Supabase
- [ ] `npm install` executado
- [ ] `node server.js` testado localmente
- [ ] PM2 configurado para auto-start
- [ ] Nginx configurado como reverse proxy
- [ ] SSL/HTTPS com Let's Encrypt ativo
- [ ] Domínio DNS apontando para IP da VPS
- [ ] Aplicação acessível em `https://starkentecnologia.com`
- [ ] Todas as features testadas
- [ ] Logs monitorados

---

## 🚨 Suporte

Se algo não funcionar, verifique:

1. **SSH acesso**: `ssh root@187.77.46.199`
2. **Node rodando**: `pm2 status`
3. **Nginx rodando**: `systemctl status nginx`
4. **Logs errors**: `tail -f /var/log/nginx/starken_error.log`
5. **Conectividade**: `curl http://localhost:3000/api/health`

Para mais ajuda, abra issue no GitHub ou contate a equipe.

---

**Última atualização**: 2026-05-02
**Versão**: 2.0.0
**Testado em**: AlmaLinux 10, Node.js 20, nginx 1.24
