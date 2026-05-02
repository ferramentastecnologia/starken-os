# 🚀 COMEÇAR AGORA — Checklist Executivo

**Tempo total**: ~2 horas | **Dificuldade**: Média | **Suporte**: Logs + troubleshooting

---

## ⏱️ FASE 1: DNS (5 minutos)

### Registro.br — Configurar Subdomínio

```
1. Abrir: https://registro.br
2. Login → Meus domínios → starkentecnologia.com
3. Editar Zona DNS
4. ADICIONAR REGISTRO:
   
   Host: app
   Tipo: A
   Valor: 187.77.46.199
   TTL: 3600

5. SALVAR
6. Confirmar (pode pedir email/SMS)
```

### Esperar Propagação (5-120 minutos)

⏳ **Enquanto espera**: Prepare credenciais Supabase (copie `.env` atual)

### Verificar Propagação

```bash
# Terminal seu computador
nslookup app.starkentecnologia.com

# Esperado:
# Address: 187.77.46.199
```

✅ **Quando apontou**: Vá para FASE 2

---

## 🔧 FASE 2: VPS Setup (2 horas)

### Terminal 1: SSH na VPS

```bash
ssh root@187.77.46.199
```

### Terminal 2: Clonar Repositório

```bash
cd /home/ubuntu/apps
git clone https://github.com/ferramentastecnologia/starken-os.git
cd starken-os
```

### Copiar Guia de Setup

```bash
cat SETUP-VPS.md
# Ler os 11 STEPs
# Ir seguindo cada um na sequência
```

---

## 📋 STEPs do SETUP-VPS.md

| STEP | Ação | Tempo | Checklist |
|------|------|-------|-----------|
| 1 | Preparação VPS | 5 min | `sudo dnf update -y` ✓ |
| 2 | Node.js 20 LTS | 5 min | `node --version` mostra v20 ✓ |
| 3 | Clone repo | 2 min | `git status` clean ✓ |
| 4 | npm install | 3 min | `npm list` mostra express ✓ |
| 5 | `.env` | 3 min | `cat .env \| grep SUPABASE_URL` ✓ |
| 6 | Testar Node | 5 min | `curl http://localhost:3000/api/health` ✓ |
| 7 | PM2 | 5 min | `pm2 status` mostra online ✓ |
| 8 | nginx | 10 min | `sudo nginx -t` success ✓ |
| 9 | SSL/HTTPS | 10 min | `sudo certbot` certificado obtido ✓ |
| 10 | DNS | 1 min | Já feito (FASE 1) ✓ |
| 11 | Validar | 10 min | `curl https://app.starkentecnologia.com` ✓ |

**Total**: ~90 minutos

---

## 🔑 Credenciais Necesárias

### Supabase (obter antes)

```bash
# No seu computador, abra arquivo existente:
# .env ou arquivo de configuração Supabase

# Copiar:
SUPABASE_URL=https://cpwpxckmuecejtkcobre.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
```

### Email para Let's Encrypt

```
seu-email@example.com (ou qualquer email)
```

---

## 💻 Comandos Críticos

### Testar Node.js Localmente (STEP 6)
```bash
NODE_ENV=production PORT=3000 node server.js
# Em outro terminal:
curl http://localhost:3000/api/health
```

### Testar nginx (STEP 8)
```bash
sudo nginx -t
# Esperado: syntax is ok
```

### Testar SSL (STEP 9)
```bash
sudo certbot certonly --standalone -d app.starkentecnologia.com
# Esperado: Successfully received certificate
```

### Validar Final (STEP 11)
```bash
curl https://app.starkentecnologia.com/api/health
# Esperado: {"status":"ok",...}
```

---

## 🚨 Se Travar em Algum STEP

### Problema: Port 3000 já em uso
```bash
lsof -i :3000
kill -9 <PID>
```

### Problema: nginx não inicia
```bash
sudo systemctl start nginx
sudo tail -f /var/log/nginx/starken_error.log
```

### Problema: DNS não propagou
```bash
# Esperar mais tempo (TTL = 3600 = 1 hora máximo)
# Enquanto isso, continuar STEPs (não depende de DNS até STEP 11)
```

### Problema: npm install falha
```bash
# Verificar Node.js instalado
node --version

# Tentar novamente
npm install
```

### Leia Mais: [SETUP-VPS.md](SETUP-VPS.md) → Troubleshooting

---

## ✅ Validação Final

Quando terminar STEP 11, testar:

```bash
# 1. API health check
curl https://app.starkentecnologia.com/api/health
# Esperado: {"status":"ok", ...}

# 2. Frontend carrega
curl https://app.starkentecnologia.com/ | head -n 5
# Esperado: <!DOCTYPE html>

# 3. Abrir em navegador
# https://app.starkentecnologia.com

# 4. Login com PIN: 1234 (ou 5678, 2222)
# 5. Testar features:
#    - Dashboard carrega
#    - Publicação FB/IG funciona
#    - Agendamento IG funciona
#    - Calendário mostra posts
```

---

## 🎉 Pronto!

Quando tudo estiver validado:

```bash
# Verificar status
pm2 status
# Esperado: starken-api → online

# Ver logs em tempo real
pm2 logs starken-api
```

---

## 📱 Próximas Atualizações

```bash
# Sempre que fizer push no GitHub:

ssh root@187.77.46.199
cd /home/ubuntu/apps/starken-os

git pull origin main
npm install
pm2 restart starken-api

# Pronto! Atualizado em 1 minuto
```

---

## 📞 Precisa de Ajuda?

**Leia em ordem**:
1. Este arquivo (START-HERE.md) ← você está aqui
2. [DNS-SETUP-REGISTROBR.md](DNS-SETUP-REGISTROBR.md) — se travar em DNS
3. [SETUP-VPS.md](SETUP-VPS.md) — se travar em qualquer STEP (tem troubleshooting)

**Checklist de Debugging**:
- [ ] DNS apontado? (`nslookup app.starkentecnologia.com`)
- [ ] Node.js 20? (`node --version`)
- [ ] npm install ok? (`npm list`)
- [ ] .env criado? (`cat .env | grep SUPABASE_URL`)
- [ ] PM2 rodando? (`pm2 status`)
- [ ] nginx rodando? (`systemctl status nginx`)
- [ ] SSL certificado? (`ls /etc/letsencrypt/live/app.starkentecnologia.com/`)

---

**Você está 100% preparado para começar! 🚀**

**Próximo**: Configurar DNS em Registro.br (5 minutos)

---

*Versão: 2.0.0 | Data: 2026-05-02 | Testado: AlmaLinux 10, Node.js 20*
