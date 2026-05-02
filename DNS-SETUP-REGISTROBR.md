# 🌐 Configurar DNS em Registro.br

**Objetivo**: Apontar `app.starkentecnologia.com` para VPS Hostinger (187.77.46.199)

---

## Passo-a-Passo Rápido

### 1. Acessar Painel Registro.br
- Ir para: https://registro.br
- Login com suas credenciais
- Ir para "Meus domínios"

### 2. Selecionar Domínio
- Clique em `starkentecnologia.com`
- Acessar "Gerenciar DNS" ou "Editar zona DNS"

### 3. Adicionar Record A

**Preencher com**:
```
Nome do Host:  app
Tipo:          A
Valor (IP):    187.77.46.199
TTL:           3600  (padrão está OK)
```

**Como fica**:
```
Nome do Host    Tipo  Valor           TTL
app             A     187.77.46.199   3600
```

### 4. Salvar
- Clicar em "Salvar" ou equivalente
- Pode pedir confirmação (email/SMS)

### 5. Esperar Propagação
- Até **5 minutos**: DNS propagado (geralmente)
- Até **2 horas**: Máximo
- Você vai receber verificar com:

```bash
# Terminal local
nslookup app.starkentecnologia.com

# Ou
dig app.starkentecnologia.com

# Esperado:
# app.starkentecnologia.com has address 187.77.46.199
```

---

## ✅ Resultado Esperado

Após propagação (5 min - 2h):

```bash
# No seu computador
nslookup app.starkentecnologia.com

# Saída:
# Server:         8.8.8.8
# Address:        8.8.8.8#53
# 
# Non-authoritative answer:
# Name:   app.starkentecnologia.com
# Address: 187.77.46.199
```

---

## 🔄 Se Não Funcionar

### Verificar record foi salvo
```bash
# SSH na VPS
ssh root@187.77.46.199

# Testar localmente
curl http://localhost/

# Deve retornar HTML do frontend
```

### Forçar atualização DNS (seu computador)
```bash
# macOS
sudo dscacheutil -flushcache

# Linux
sudo systemctl restart systemd-resolved

# Windows (PowerShell como admin)
Clear-DnsClientCache
```

### Limpar cache DNS
```bash
# Esperar 5 minutos sem teste
# Depois testar novamente
nslookup app.starkentecnologia.com
```

---

## 📋 Registro.br — Screenshots Ajuda

Se tiver dúvida na interface do Registro.br:

1. Acesse sua conta
2. "Meus domínios" → `starkentecnologia.com`
3. Procure por "Zona DNS", "DNS", "Editar DNS" ou "Nameserver"
4. Procure seção "Records" ou "Hosts"
5. Adicione record com:
   - **Nome**: `app`
   - **Tipo**: `A`
   - **Valor**: `187.77.46.199`

---

## 🎯 Resumo

| O Quê | Valor |
|-------|-------|
| **Domínio** | `starkentecnologia.com` (Registro.br) |
| **Subdomínio** | `app.starkentecnologia.com` |
| **IP VPS** | `187.77.46.199` |
| **Tipo Record** | A (Address) |
| **TTL** | 3600 (padrão) |

---

## 🚀 Depois

Após DNS apontado, siga [SETUP-VPS.md](SETUP-VPS.md) STEP 10+

---

**Dúvidas?** Verifique os logs na VPS:
```bash
ssh root@187.77.46.199
tail -f /var/log/nginx/starken_error.log
pm2 logs starken-api
```
