# Plano de Transição: Vercel → VPS Hostinger (Starken OS)

## Context

Starken OS está atualmente no Vercel Hobby plan com 12 funções serverless (máximo atingido). A transição para VPS Hostinger resolve:

1. **Limite de funções**: Hobby tem limite de 12 funções, não pode crescer mais
2. **Custo escalável**: Vercel Pro está aguardando fatura; VPS oferece custo fixo
3. **Controle**: Acesso total ao servidor Linux para customizações futuras
4. **Performance**: Sem timeout de 60s (atual em `publish.js` e `media.js`)

**Resultado esperado**: Aplicação rodando em `starkentecnologia.com` (ou similar) com frontend + APIs backend no mesmo servidor VPS, Supabase mantido para dados.

**Expertise**: Usuário usa GitHub Desktop e faz pull manual → plano focado em simplicidade, sem automação complexa por enquanto.

---

## Visão Geral da Transição

### Fase 1: Preparação (2-3 horas)
- [ ] Provisionar VPS Hostinger (Node.js, nginx)
- [ ] Clonar repositório na VPS
- [ ] Instalar dependências + configurar env vars
- [ ] Testar APIs localmente

### Fase 2: Configuração nginx (1-2 horas)
- [ ] Configurar nginx como reverse proxy
- [ ] Servir frontend estático (HTML/CSS/JS)
- [ ] Rotear `/api/*` para Node.js
- [ ] Configurar SSL/HTTPS (Let's Encrypt)

### Fase 3: Deployment Manual (1 hora)
- [ ] Criar estrutura de pastas na VPS
- [ ] Fazer clone do repositório com `git`
- [ ] Iniciar APIs em background (PM2 ou direct)
- [ ] Testar aplicação completa

### Fase 4: Validação + DNS (30 min - 2 dias)
- [ ] Mapear domínio para IP da VPS
- [ ] Testar funcionalidades críticas
- [ ] Preparar rollback para Vercel

### Fase 5: Go-Live (15 min)
- [ ] Apontar DNS para VPS
- [ ] Monitorar por 24h

---

## Detalhes Técnicos

### A. Estrutura na VPS

```
/home/ubuntu/apps/
├── starken-os/
│   ├── checklist-relatorios.html  (frontend estático)
│   ├── data-deletion.html
│   ├── privacy.html
│   ├── api/                       (backend Node.js)
│   │   ├── meta/
│   │   ├── asana/
│   │   ├── content.js
│   │   └── _lib/
│   └── .env                       (Supabase + secrets)
├── logs/
│   ├── api.log
│   └── nginx.log
└── .git/                          (para pull updates)
```

### B. Stack recomendado

| Componente | Tecnologia | Função |
|-----------|-----------|--------|
| **OS** | Ubuntu 22.04 LTS | Padrão Hostinger |
| **Runtime** | Node.js 20 LTS | Rodar APIs |
| **Webserver** | nginx | Reverse proxy + static serving |
| **Process Manager** | PM2 ou systemd | Keep APIs alive |
| **VCS** | Git | Deploy via git pull |
| **DB** | Supabase (não toca) | Dados permanecem |
| **Deployment** | Manual `git pull` | Simplicidade |

### C. Funcionamento

```
Cliente → starkentecnologia.com
         ↓
       nginx:80/443
         ↓
    ┌────┴────┐
    ↓         ↓
  /        /api/*
(HTML)   (Node.js:3000)
  ↓         ↓
checklist  → Supabase
-relatorios
  + JS
  ↓
Supabase (dados)
```

**Fluxo**: 
1. Usuário acessa `starkentecnologia.com`
2. nginx retorna `checklist-relatorios.html`
3. JavaScript faz fetch para `/api/content`, `/api/meta/publish`, etc
4. nginx roteia `/api/*` → `localhost:3000` (Node.js)
5. Node.js responde com dados de Supabase

### D. Migração de Funções Serverless

Cada função em `/api` (atualmente serverless Vercel) se torna:
- **Arquivo individual** em `/api/*.js` (compatível com Vercel)
- **Handler HTTP** em Node.js
- **Rota** em `/api/<caminho>`

**Exemplo de conversão**:

```js
// Vercel (serverless)
export default function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ ... });
  }
}

// Node.js direto
app.get('/api/meta/balance', (req, res) => {
  // mesmo código
  return res.status(200).json({ ... });
});
```

**Opções para servir APIs em Node.js**:

#### Opção 1: Express.js (recomendado)
```js
// server.js
const express = require('express');
const app = express();
app.use(express.static('.'));  // serve HTML/CSS/JS
app.post('/api/content', require('./api/content.js').default);
app.post('/api/meta/publish', require('./api/meta/publish.js').default);
// ... mais rotas
app.listen(3000);
```

**Pros**: Simples, familiar, 1 arquivo `server.js`
**Cons**: Precisa criar `package.json` e instalar `express`

#### Opção 2: Node.js nativo (sem framework)
```js
// server.js
const http = require('http');
const fs = require('fs');
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    // rotear para função correta
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(fs.readFileSync('./checklist-relatorios.html'));
  }
});
```

**Pros**: Zero dependências, menor footprint
**Cons**: Mais verboso, complexo para muitas rotas

#### Opção 3: nginx + Node.js separado (padrão indústria)
- nginx: serve HTML estático + proxy `/api` para Node
- Node: roda em localhost:3000, apenas APIs
- **Recomendado para esta transição**

### E. Configuração nginx

**Arquivo**: `/etc/nginx/sites-available/starkentecnologia`

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name starkentecnologia.com www.starkentecnologia.com;

    # Redirect HTTP → HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name starkentecnologia.com www.starkentecnologia.com;

    # SSL (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/starkentecnologia.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/starkentecnologia.com/privkey.pem;

    # Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    # Root diretório (frontend estático)
    root /home/ubuntu/apps/starken-os;
    index checklist-relatorios.html;

    # Frontend: servir HTML/CSS/JS
    location / {
        try_files $uri $uri/ /checklist-relatorios.html;
    }

    # APIs: proxy para Node.js
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static files (cache 1 ano)
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Deny access to .env, .git, etc
    location ~ /\. {
        deny all;
    }
}
```

### F. Node.js Server (Express)

**Arquivo**: `/home/ubuntu/apps/starken-os/server.js`

```js
const express = require('express');
const path = require('path');
const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));

// Servir frontend estático
app.use(express.static(path.join(__dirname)));

// ========== ROTAS API ==========

// Content Management
app.post('/api/content', async (req, res) => {
  try {
    const handler = require('./api/content.js').default;
    await handler(req, res);
  } catch (err) {
    console.error('[/api/content]', err);
    res.status(500).json({ error: err.message });
  }
});

// Meta APIs
app.post('/api/meta/publish', async (req, res) => {
  try {
    const handler = require('./api/meta/publish.js').default;
    await handler(req, res);
  } catch (err) {
    console.error('[/api/meta/publish]', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/meta/media', async (req, res) => {
  // ... similar
});

// ... outras rotas (descrita no step 2.1 abaixo)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Server running on port ${PORT}`);
});
```

### G. Variáveis de Ambiente

**Arquivo**: `/home/ubuntu/apps/starken-os/.env`

```bash
# Supabase (same as current)
SUPABASE_URL=https://cpwpxckmuecejtkcobre.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...

# Node.js
NODE_ENV=production
PORT=3000

# Meta (same as current)
META_APP_ID=... (if stored server-side)
META_APP_SECRET=... (if needed)

# Secrets
JWT_SECRET=... (if needed later)
```

**Importante**: `.env` NÃO é commitado, precisa ser criado manualmente na VPS.

### H. Deployment Manual

**Passo 1**: SSH na VPS Hostinger
```bash
ssh ubuntu@<IP-da-VPS>
```

**Passo 2**: Clone repositório
```bash
cd /home/ubuntu/apps
git clone https://github.com/ferramentastecnologia/starken-os.git
cd starken-os
```

**Passo 3**: Criar `.env`
```bash
nano .env
# Colar variáveis acima (Supabase, etc)
# Salvar: Ctrl+O, Enter, Ctrl+X
```

**Passo 4**: Instalar Node.js + dependências
```bash
# Node.js (se não tiver)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Criar package.json se não existir
npm init -y
npm install express body-parser --save
```

**Passo 5**: Testar server.js localmente
```bash
node server.js
# Deve dizer: "Server running on port 3000"
# Abrir outro terminal: curl http://localhost:3000/api/health
```

**Passo 6**: Configurar nginx + SSL
```bash
sudo cp server.js /etc/nginx/sites-available/starkentecnologia
sudo ln -s /etc/nginx/sites-available/starkentecnologia /etc/nginx/sites-enabled/
sudo certbot certonly --standalone -d starkentecnologia.com
sudo nginx -t
sudo systemctl restart nginx
```

**Passo 7**: Iniciar server.js em background (PM2)
```bash
sudo npm install -g pm2
pm2 start server.js --name "starken-api"
pm2 save
pm2 startup
```

**Passo 8**: Testar aplicação
```bash
curl https://starkentecnologia.com/api/health
# Deve responder: {"status":"ok", ...}
```

### I. Atualização Futura (Pull Manual)

Quando fizer push no GitHub:

```bash
# SSH na VPS
ssh ubuntu@<IP>

# Ir para pasta
cd /home/ubuntu/apps/starken-os

# Pull e reiniciar
git pull origin main
pm2 restart starken-api
```

---

## Roteiros de Implementação

### Roteiro 1: Simples (nginx + Node direto)
**Tempo**: ~4-6 horas, sem frameworks extras

1. Provisionar VPS com Node.js 20 LTS
2. Criar `server.js` manualmente em Express
3. Clonar repositório
4. Configurar `.env` (Supabase)
5. Instalar dependências (`npm install express`)
6. Testar localmente
7. Configurar nginx como reverse proxy
8. SSL com Let's Encrypt
9. PM2 para gerenciar processo
10. Apontar DNS
11. Validar

**Arquivos a criar**:
- `/home/ubuntu/apps/starken-os/server.js` (400-500 linhas)
- `/etc/nginx/sites-available/starkentecnologia` (config)
- `.env` na VPS (manual)

**Arquivos a modificar**: Nenhum no repositório (compatível com Vercel)

### Roteiro 2: Com Docker (futuro)
Se quiser automação depois:
- Dockerfile + docker-compose.yml
- GitHub Actions para build/push
- Webhook para auto-deploy na VPS

---

## Validação & Testing

### Teste de Sanidade (antes de DNS)

```bash
# 1. Acessar via IP (curl ou navegador privado)
curl -H "Host: starkentecnologia.com" https://<IP-VPS>/api/health

# 2. Testar endpoints críticos
curl -X POST https://<IP-VPS>/api/content \
  -H "Content-Type: application/json" \
  -d '{"action":"list_groups"}'

# 3. Verificar frontend
curl https://<IP-VPS>/ | head -n 20

# 4. Logs
ssh ubuntu@<IP>
pm2 logs starken-api
tail -f /var/log/nginx/access.log
```

### Teste de Usuário

1. **Login**: Digitar PIN (1234, 5678, 2222) → deve funcionar
2. **Dashboard**: Carregar gráficos, stats
3. **Content Management**: Listar grupos, criar task
4. **Publicação**: Publicar post no FB/IG (via Supabase)
5. **Calendário**: Navegar meses, ver posts
6. **Tema**: Trocar tema (light/dark/warm)

---

## Rollback

Se algo der errado:

1. **DNS rápido**: Apontar domínio de volta para Vercel (5 min)
2. **Vercel continua**: `starken-os.vercel.app` está ativo
3. **VPS troubleshoot**: Pode continuar diagnosticando sem afetar usuários

---

## Próximos Passos (Pós-Transição)

1. **CI/CD**: GitHub Actions (opcional futura)
2. **Monitoramento**: PM2 monitoring / Sentry (opcional)
3. **Backup**: Scripts de backup automático (importante)
4. **Upgrade**: Mover para Docker (simplifica updates)
5. **Escalabilidade**: Load balancer se necessário (futuro)

---

## Checklist Pré-Transição

- [ ] Notificar stakeholders (Juan, Henrique, Emily)
- [ ] Testar todas as features no Vercel (baseline)
- [ ] Fazer backup do repositório (clone local)
- [ ] Ter acesso SSH Hostinger pronto
- [ ] Domínio `starkentecnologia.com` registrado + apontando DNS temporário
- [ ] Ter `.env` com credenciais Supabase
- [ ] Testar Meta API tokens (não expiram?)
- [ ] Plano de rollback comunicado

---

## Decisões Arquiteturais

| Decisão | Motivo |
|---------|--------|
| **nginx + Node.js** | Padrão indústria, escalável, simples |
| **Express.js** | Famoso, documentação, 1 arquivo |
| **PM2 para processo** | Restart automático, logs |
| **Supabase mantido** | Menos complexidade, funciona |
| **Deployment manual** | Compatível com GitHub Desktop |
| **Sem Docker (v1)** | Simplificação inicial |

