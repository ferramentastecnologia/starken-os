# 🚀 Phase 5: DeskRPG Integration - Deployment Guide

**Data**: 2026-04-09  
**Status**: Pronto para Deployment  
**Tempo Estimado**: 30 minutos

---

## ✅ Configuração Concluída

**Arquivo**: `.env.local`

```env
DESKRPG_BASE_URL=http://localhost:3000
DESKRPG_AUTH_TYPE=none
DESKRPG_WEBHOOK_URL=http://localhost:7001/api/deskrpg-webhook
```

---

## 📋 PASSO 1: Executar Migração SQL no Supabase

### Opção A: Via Console (Recomendado)

1. Abra https://app.supabase.com/
2. Selecione o projeto **starken-os**
3. Clique em **SQL Editor** (sidebar esquerda)
4. Clique em **New Query**
5. **Cole o SQL abaixo** e clique **RUN**:

```sql
-- PHASE 5: DeskRPG Integration Schema
-- Adiciona colunas para sincronização com DeskRPG

-- Tabela: virtual_offices
ALTER TABLE virtual_offices ADD COLUMN IF NOT EXISTS deskrpg_channel_id TEXT;
ALTER TABLE virtual_offices ADD COLUMN IF NOT EXISTS deskrpg_synced_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE virtual_offices ADD COLUMN IF NOT EXISTS deskrpg_sync_status TEXT DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_virtual_offices_deskrpg_channel_id
  ON virtual_offices(deskrpg_channel_id);

-- Tabela: virtual_npcs
ALTER TABLE virtual_npcs ADD COLUMN IF NOT EXISTS deskrpg_npc_id TEXT;
ALTER TABLE virtual_npcs ADD COLUMN IF NOT EXISTS deskrpg_synced_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE virtual_npcs ADD COLUMN IF NOT EXISTS deskrpg_sync_status TEXT DEFAULT 'pending';
ALTER TABLE virtual_npcs ADD COLUMN IF NOT EXISTS last_task_completed_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_virtual_npcs_deskrpg_npc_id
  ON virtual_npcs(deskrpg_npc_id);

-- Tabela: virtual_npc_tasks
ALTER TABLE virtual_npc_tasks ADD COLUMN IF NOT EXISTS deskrpg_task_id TEXT;
ALTER TABLE virtual_npc_tasks ADD COLUMN IF NOT EXISTS deskrpg_synced_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE virtual_npc_tasks ADD COLUMN IF NOT EXISTS deskrpg_sync_status TEXT DEFAULT 'pending';
ALTER TABLE virtual_npc_tasks ADD COLUMN IF NOT EXISTS deskrpg_status TEXT;
ALTER TABLE virtual_npc_tasks ADD COLUMN IF NOT EXISTS result_summary TEXT;

CREATE INDEX IF NOT EXISTS idx_virtual_npc_tasks_deskrpg_task_id
  ON virtual_npc_tasks(deskrpg_task_id);
CREATE INDEX IF NOT EXISTS idx_virtual_npc_tasks_deskrpg_sync_status
  ON virtual_npc_tasks(deskrpg_sync_status);

-- Tabela: virtual_activity_log
ALTER TABLE virtual_activity_log ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Índice composto
CREATE INDEX IF NOT EXISTS idx_virtual_npc_tasks_npc_status
  ON virtual_npc_tasks(npc_id, status);
```

✅ **Resultado esperado**: "Query executed successfully"

---

## 📋 PASSO 2: Iniciar DeskRPG Localmente

Se ainda não tem DeskRPG rodando, inicie:

```bash
# Clone (se ainda não tem)
git clone https://github.com/dandacompany/deskrpg.git
cd deskrpg

# Setup e run
npm install
npm run setup:lite  # SQLite mode (mais simples)
npm run dev
```

✅ DeskRPG deve estar em `http://localhost:3000`

---

## 📋 PASSO 3: Verificar Conectividade

### Test 1: Health Check

No Vercel Functions Preview ou localmente:

```javascript
// Abra o browser console (F12) e execute:
fetch('http://localhost:7001/api/content?action=vo_sync_deskrpg_npc&npc_id=test')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

**Resultado esperado**: Erro 404 (NPC não existe) - isso é OK, prova que a API responde.

### Test 2: DeskRPG Bridge

```bash
# Teste se consegue alcançar DeskRPG
curl -s http://localhost:3000/api/npcs -H "x-user-id: test" | head -20
```

✅ Deve retornar JSON (mesmo que vazio)

---

## 📋 PASSO 4: Testes de Integração (Phase 5E)

### Teste 1: Criar Escritório Cliente

1. Abra **Escritório Virtual** no Starken OS
2. Crie novo cliente (ou selecione existente)
3. Aguarde verificar se `deskrpg_channel_id` é populado

```sql
-- Verificar no Supabase Console
SELECT id, client_id, client_name, deskrpg_channel_id 
FROM virtual_offices 
ORDER BY created_at DESC 
LIMIT 5;
```

### Teste 2: Sincronizar NPC com DeskRPG

1. Crie um NPC no Starken OS
2. Verifique se `deskrpg_npc_id` é preenchido

```sql
SELECT id, npc_name, deskrpg_npc_id, deskrpg_sync_status 
FROM virtual_npcs 
ORDER BY created_at DESC 
LIMIT 5;
```

### Teste 3: Atribuir Tarefa (End-to-End)

1. Clique em NPC → **Atribuir Tarefa**
2. Preencha: "Teste tarefa DeskRPG"
3. Envie

**Esperado**:
- Tarefa criada em Starken OS
- Payload enviado para DeskRPG (via bridge)
- `deskrpg_task_id` preenchido em `virtual_npc_tasks`
- Frontend começa polling

```sql
-- Verificar tarefa
SELECT id, npc_id, task_name, status, deskrpg_task_id, deskrpg_sync_status 
FROM virtual_npc_tasks 
ORDER BY created_at DESC 
LIMIT 5;
```

### Teste 4: Webhook Callback (Simulado)

Se DeskRPG completar a tarefa, ele envia POST para webhook:

```bash
curl -X POST http://localhost:7001/api/deskrpg-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "test-task-123",
    "npcId": "test-npc-456",
    "status": "completed",
    "result": {"summary": "Tarefa completada com sucesso"},
    "resultSummary": "Teste OK",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }'
```

**Resultado esperado**: `{"success": true, "message": "Webhook processed successfully"}`

---

## 📋 PASSO 5: Verificar Activity Log

```sql
-- Ver todas as atividades DeskRPG
SELECT event_type, object_id, description, created_at 
FROM virtual_activity_log 
WHERE event_type LIKE '%deskrpg%' 
ORDER BY created_at DESC 
LIMIT 10;
```

---

## 📋 PASSO 6: Deploy para Produção (Vercel)

### 6.1 Definir Variáveis de Ambiente no Vercel

1. Abra https://vercel.com/
2. Selecione projeto **starken-os**
3. Vá para **Settings** → **Environment Variables**
4. Adicione:

| Key | Value |
|-----|-------|
| `DESKRPG_BASE_URL` | `http://localhost:3000` (ou URL remota) |
| `DESKRPG_AUTH_TYPE` | `none` |
| `DESKRPG_WEBHOOK_URL` | `https://starken-os.vercel.app/api/deskrpg-webhook` |

### 6.2 Redeploy

```bash
# No terminal local
git push -u origin claude/open-project-1jI1N
```

Vercel faz auto-deploy 🎯

### 6.3 Verificar Deploy

```bash
# Testar endpoint em produção
curl https://starken-os.vercel.app/api/content?action=vo_sync_deskrpg_npc
```

---

## ✅ Checklist Final

- [ ] SQL migration executada no Supabase
- [ ] `.env.local` criado com configurações
- [ ] DeskRPG rodando em `http://localhost:3000`
- [ ] Teste 1: Health check passa
- [ ] Teste 2: Bridge conecta ao DeskRPG
- [ ] Teste 3: Tarefa criada end-to-end
- [ ] Teste 4: Webhook callback simula corretamente
- [ ] Activity log mostra eventos
- [ ] Variáveis de ambiente definidas no Vercel
- [ ] Deploy realizado e verificado
- [ ] ✨ Phase 5 completo!

---

## 🆘 Troubleshooting

### "DeskRPG não responde"
```bash
# Verificar se está rodando
curl -s http://localhost:3000 | head -20
# Deve retornar HTML da página

# Se não, reinicie:
cd deskrpg
npm run dev
```

### "Webhook não funciona"
```sql
-- Verificar se tabela existe
SELECT * FROM virtual_activity_log LIMIT 1;

-- Testar manualmente
curl -X POST http://localhost:7001/api/deskrpg-webhook \
  -H "Content-Type: application/json" \
  -d '{"taskId":"test","npcId":"test","status":"completed"}'
```

### "Erro 403 no Supabase"
- Verificar se `SUPABASE_SERVICE_KEY` está correto
- Confirmar que está usando a chave service_role (não anon)

### "Timeout nas requisições"
- Verificar CORS headers
- Confirmar firewall permite conexões

---

## 📞 Contato

Se tiver dúvidas ou problemas, verifique:
- PHASE_5_IMPLEMENTATION_STATUS.md (resumo técnico)
- PHASE_5_DESKRPG_INTEGRATION_PLAN.md (arquitetura)
- api/deskrpg-bridge.js (código do bridge)

---

**Status**: 🟢 Pronto para Deploy  
**Próximo Passo**: Execute Passo 1 (SQL no Supabase)
