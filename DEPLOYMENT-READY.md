# ✅ Starken OS — Preparação Completa para VPS Hostinger

**Status**: Todos os arquivos criados e prontos para deploy
**Data**: 2026-05-02
**Próximo Passo**: SSH na VPS e seguir SETUP-VPS.md

---

## 📦 O Que Foi Preparado

### Arquivos Criados (5 arquivos novos)

| Arquivo | Tipo | Descrição | Ação |
|---------|------|-----------|------|
| **server.js** | Backend | Express server que multiplexar 12 funções serverless Vercel → Node.js | ✅ Pronto |
| **package.json** | Config | Dependências (apenas `express`) + scripts npm | ✅ Pronto |
| **.env.example** | Template | Variáveis de ambiente necessárias (copiar → .env) | ✅ Pronto |
| **nginx.conf** | Config | Reverse proxy nginx (copiar para /etc/nginx/conf.d/) | ✅ Pronto |
| **SETUP-VPS.md** | Guia | Instruções passo-a-passo para AlmaLinux | ✅ Pronto |
| **.claude/launch.json** | Config | Configuração local para development | ✅ Pronto |

---

## 🎯 Arquitetura Final

```
app.starkentecnologia.com        app.app.starkentecnologia.com
   (Lovable)                 (VPS 187.77.46.199)
      ↓                              ↓
   Front                         nginx:443
  (website)                         ├─ Frontend (HTML/CSS/JS)
                                    └─ /api/* → localhost:3000
                                         ↓
                                    Node.js/Express (PM2)
                                         ↓
                                    Supabase (dados)
```

---

## 🚀 Como Usar — Quick Start

### 1️⃣ SSH na VPS
```bash
ssh root@187.77.46.199
```

### 2️⃣ Clonar Repositório
```bash
cd /home/ubuntu/apps
git clone https://github.com/ferramentastecnologia/starken-os.git
cd starken-os
```

### 3️⃣ Seguir Guia de Setup
```bash
# Abra o arquivo (ou copie o conteúdo dele)
cat SETUP-VPS.md

# Depois execute cada passo manualmente (STEP 1 → STEP 11)
# Total: ~2 horas primeira vez
```

---

## 📋 Pré-Requisitos Checklist

**Antes de começar, você precisa ter**:

- [ ] Acesso SSH à VPS: `ssh root@187.77.46.199` funciona
- [ ] Credenciais Supabase (copiar de `.env` atual ou Supabase console)
- [ ] Domínio `app.starkentecnologia.com` registrado (ou outro)
- [ ] Acesso a registrador de domínio para configurar DNS

---

## 🔧 Estrutura de Arquivos Criados

### server.js (420 linhas)
```javascript
// Express server que:
// 1. Serve frontend estático (checklist-relatorios.html)
// 2. Roteia /api/* para handlers corretos
// 3. Multiplexar 12 funções serverless
// 4. Adiciona CORS, logging, error handling

// 12 rotas de API mapeadas:
✅ /api/content (1 função)
✅ /api/meta/config (1 função)
✅ /api/meta/publish (1 função)
✅ /api/meta/media (1 função)
✅ /api/meta/discover (1 função)
✅ /api/meta/balance (1 função)
✅ /api/meta/insights (1 função)
✅ /api/meta/campaigns (1 função)
✅ /api/meta/traffic (1 função)
✅ /api/asana/config (1 função)
✅ /api/asana/tasks (1 função)
✅ /api/health (bonus endpoint)
```

**Verificação Rápida**:
```bash
# Na VPS após setup
curl http://localhost:3000/api/health
# Deve responder: {"status":"ok", ...}
```

---

### package.json
```json
{
  "name": "starken-os",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "pm2:start": "pm2 start server.js --name 'starken-api'",
    "pm2:restart": "pm2 restart starken-api"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}
```

**O que faz**: Define dependências mínimas (só Express), scripts convenientes.

---

### nginx.conf (180 linhas)
```nginx
upstream starken_api {
    server localhost:3000;
}

# Redirect HTTP → HTTPS
server {
    listen 80;
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    ssl_certificate /etc/letsencrypt/live/app.starkentecnologia.com/...;
    
    # Servir frontend
    root /home/ubuntu/apps/starken-os;
    location / {
        try_files $uri $uri/ /checklist-relatorios.html;
    }
    
    # Rotear API para Node.js
    location /api/ {
        proxy_pass http://starken_api;
    }
}
```

**O que faz**: 
- Redireciona HTTP → HTTPS
- Serve HTML/CSS/JS estático
- Proxy `/api/*` para Node.js em 3000
- SSL/HTTPS com Let's Encrypt

---

### .env.example
```bash
# Copiar para .env e preencher

NODE_ENV=production
PORT=3000

SUPABASE_URL=https://cpwpxckmuecejtkcobre.supabase.co
SUPABASE_ANON_KEY=... # (copiar seu)
SUPABASE_SERVICE_KEY=... # (copiar seu)

META_APP_ID=... # (se necessário)
META_APP_SECRET=...
```

**O que faz**: Template para variáveis de ambiente (NÃO commitado).

---

### SETUP-VPS.md (300+ linhas)
**11 STEPs detalhados**:

1. Preparação da VPS
2. Node.js 20 LTS
3. Clone do repositório
4. Instalar dependências
5. Variáveis de ambiente (.env)
6. Testar Node.js localmente
7. PM2 para auto-restart
8. Nginx - Reverse Proxy
9. SSL/HTTPS Let's Encrypt
10. Configurar Domínio DNS
11. Validação Completa

+ Troubleshooting
+ Deploy Futuro
+ Rollback

---

## ✨ Destaques da Implementação

### ✅ Compatibilidade Vercel
- Código das funções serverless **não foi modificado**
- Apenas wrappado em Express com mesma interface
- **Zero mudanças nos arquivos `/api/*.js`**

### ✅ PM2 para Gerenciamento
- Auto-restart se processo morrer
- Logs persistentes
- Auto-start no reboot

### ✅ Nginx como Reverse Proxy
- Padrão indústria (escalável)
- GZIP compression automático
- Cache headers para assets
- Security headers (X-Frame-Options, etc)

### ✅ SSL/HTTPS Automático
- Let's Encrypt (gratuito)
- Auto-renewal (automático)
- HTTP → HTTPS redirect

### ✅ Sem Docker (para começar)
- Simplicidade máxima
- Setup manual = melhor controle
- Futuro: Docker se necessário

---

## 📊 Comparativa: Vercel vs VPS

| Aspecto | Vercel (agora) | VPS (novo) |
|---------|-------|-----------|
| **Custo** | ~$25/mês (Pro) | ~$10-15/mês |
| **Funções serverless** | 12 (máx Hobby) | Ilimitadas |
| **Timeout** | 60s | Ilimitado |
| **Controle** | Limitado | Total |
| **Deploy** | Git push automático | Manual `git pull` |
| **Escalabilidade** | Vercel cuida | Você gerencia |

---

## 🔄 Fluxo de Deploy Futuro

Sempre que fizer push no GitHub:

```bash
# SSH na VPS
ssh root@187.77.46.199

# Ir para pasta
cd /home/ubuntu/apps/starken-os

# Puxar última versão
git pull origin main

# Instalar novas deps (se houver)
npm install

# Reiniciar Node
pm2 restart starken-api

# Verificar
pm2 logs starken-api
```

**Tempo**: ~1 minuto

---

## 🚨 Rollback Rápido

Se algo der muito errado:

1. **DNS rápido**: Apontar domínio de volta para Vercel
2. **Vercel permanece**: `starken-os.vercel.app` está ativo
3. **Zero downtime**: Usuários redirecionados em 5 minutos (TTL)

---

## 📞 Próximos Passos

### Imediatamente
1. Ler este documento (✓ você fez!)
2. Ler SETUP-VPS.md
3. Ter credenciais Supabase prontas

### Quando pronto
1. SSH na VPS
2. Executar SETUP-VPS.md step-by-step
3. Testar aplicação
4. Apontar DNS

### Após deploy
1. Monitorar por 24h
2. Testar todas features
3. Desativar Vercel (opcional)

---

## 💡 Dicas

### Desenvolvimento Local (opcional)
```bash
# Na máquina local, para testar antes de deploy:
npm install
npm run dev

# Vai rodar em http://localhost:3000
# Com auto-reload via nodemon (depois instale)
```

### Monitoring (futuro)
```bash
# Na VPS, ver logs em tempo real:
pm2 logs starken-api --lines 100

# Ver status:
pm2 status

# Dashboard (opcional):
pm2 web  # http://localhost:9615
```

### Troubleshooting Rápido
```bash
# Port já em uso?
lsof -i :3000

# Nginx error?
sudo tail -f /var/log/nginx/starken_error.log

# Node error?
pm2 logs starken-api --err

# DNS propagado?
nslookup app.starkentecnologia.com
```

---

## 📝 Checklist Final

**Antes de SSH**:
- [ ] Ler DEPLOYMENT-READY.md (este arquivo)
- [ ] Ler SETUP-VPS.md
- [ ] Ter credenciais Supabase anotadas
- [ ] Domínio pronto

**Durante SETUP-VPS.md**:
- [ ] Cada STEP executado
- [ ] Verificações passaram

**Após Deploy**:
- [ ] Login funciona
- [ ] Dashboard carrega
- [ ] Publicação FB/IG funciona
- [ ] Logs limpos

---

## 🎉 Você está pronto!

Todos os arquivos estão preparados e prontos para deploy. Agora é executar SETUP-VPS.md na VPS AlmaLinux.

**Tempo estimado**: ~2 horas (primeira vez)
**Dificuldade**: Média (siga os passos!)
**Suporte**: Se travar em algum STEP, verifique logs e troubleshooting em SETUP-VPS.md

**Boa sorte!** 🚀

---

**Versão**: 2.0.0  
**Data**: 2026-05-02  
**Criado por**: Claude Code  
**Próximo**: Execute SETUP-VPS.md na VPS
