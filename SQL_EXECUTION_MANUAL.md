# 🔧 SQL Migration Manual Execution

**Arquivo a Executar**: `SQL/0002_deskrpg_integration.sql`

---

## ✅ PASSO A PASSO

### 1. Abrir Supabase Console
URL: https://app.supabase.com/

### 2. Selecionar Projeto
**Projeto**: starken-os

### 3. Abrir SQL Editor
No sidebar esquerdo → **SQL Editor**

### 4. Criar Nova Query
Clique em **"New Query"** (botão azul no canto superior)

### 5. Copiar SQL Abaixo

```sql
-- ═════════════════════════════════════════════════════════════════
-- PHASE 5: DeskRPG Integration Schema
-- Criado: 2026-04-09
-- Propósito: Adicionar colunas para sincronização com DeskRPG
-- ═════════════════════════════════════════════════════════════════

-- Adicionar colunas de integração DeskRPG à tabela virtual_offices
ALTER TABLE virtual_offices ADD COLUMN IF NOT EXISTS deskrpg_channel_id TEXT;
ALTER TABLE virtual_offices ADD COLUMN IF NOT EXISTS deskrpg_synced_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE virtual_offices ADD COLUMN IF NOT EXISTS deskrpg_sync_status TEXT DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_virtual_offices_deskrpg_channel_id
  ON virtual_offices(deskrpg_channel_id);

-- Adicionar colunas de integração DeskRPG à tabela virtual_npcs
ALTER TABLE virtual_npcs ADD COLUMN IF NOT EXISTS deskrpg_npc_id TEXT;
ALTER TABLE virtual_npcs ADD COLUMN IF NOT EXISTS deskrpg_synced_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE virtual_npcs ADD COLUMN IF NOT EXISTS deskrpg_sync_status TEXT DEFAULT 'pending';
ALTER TABLE virtual_npcs ADD COLUMN IF NOT EXISTS last_task_completed_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_virtual_npcs_deskrpg_npc_id
  ON virtual_npcs(deskrpg_npc_id);

-- Adicionar colunas de integração DeskRPG à tabela virtual_npc_tasks
ALTER TABLE virtual_npc_tasks ADD COLUMN IF NOT EXISTS deskrpg_task_id TEXT;
ALTER TABLE virtual_npc_tasks ADD COLUMN IF NOT EXISTS deskrpg_synced_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE virtual_npc_tasks ADD COLUMN IF NOT EXISTS deskrpg_sync_status TEXT DEFAULT 'pending';
ALTER TABLE virtual_npc_tasks ADD COLUMN IF NOT EXISTS deskrpg_status TEXT;
ALTER TABLE virtual_npc_tasks ADD COLUMN IF NOT EXISTS result_summary TEXT;

CREATE INDEX IF NOT EXISTS idx_virtual_npc_tasks_deskrpg_task_id
  ON virtual_npc_tasks(deskrpg_task_id);
CREATE INDEX IF NOT EXISTS idx_virtual_npc_tasks_deskrpg_sync_status
  ON virtual_npc_tasks(deskrpg_sync_status);

-- Estender tabela virtual_activity_log com metadata DeskRPG
ALTER TABLE virtual_activity_log ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Criar índice composto para queries rápidas
CREATE INDEX IF NOT EXISTS idx_virtual_npc_tasks_npc_status
  ON virtual_npc_tasks(npc_id, status);
```

### 6. Executar Query
Clique no botão **"RUN"** (canto superior direito)

### 7. Verificar Resultado
Você verá:
```
Query executed successfully
```

---

## ✅ VALIDAR EXECUÇÃO

Após executar, rode esta query para confirmar:

```sql
-- Verificar colunas adicionadas à virtual_offices
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'virtual_offices'
AND column_name LIKE 'deskrpg%'
ORDER BY column_name;
```

**Resultado esperado**: 3 linhas
- deskrpg_channel_id (text)
- deskrpg_synced_at (timestamp with time zone)
- deskrpg_sync_status (text)

---

## 📊 Verificar Todas as Mudanças

Execute estas queries para confirmar todas as alterações:

```sql
-- 1. Colunas em virtual_offices
SELECT column_name FROM information_schema.columns
WHERE table_name = 'virtual_offices'
AND column_name LIKE 'deskrpg%';
-- Esperado: 3 colunas

-- 2. Colunas em virtual_npcs
SELECT column_name FROM information_schema.columns
WHERE table_name = 'virtual_npcs'
AND column_name LIKE 'deskrpg%' OR column_name = 'last_task_completed_at';
-- Esperado: 4 colunas

-- 3. Colunas em virtual_npc_tasks
SELECT column_name FROM information_schema.columns
WHERE table_name = 'virtual_npc_tasks'
AND (column_name LIKE 'deskrpg%' OR column_name = 'result_summary');
-- Esperado: 5 colunas

-- 4. Índices criados
SELECT indexname FROM pg_indexes
WHERE tablename IN ('virtual_offices', 'virtual_npcs', 'virtual_npc_tasks', 'virtual_activity_log')
AND indexname LIKE 'idx_virtual_%deskrpg%'
OR indexname LIKE 'idx_virtual_npc_tasks_npc_status';
-- Esperado: 5 índices novos
```

---

## 🆘 Se Algo Deu Errado

### Erro: "relation does not exist"
**Causa**: Tabelas virtual_* não foram criadas (Phase 1)
**Solução**: Execute SQL/0001_virtual_office_schema.sql primeiro

### Erro: "column already exists"
**Causa**: Colunas já foram adicionadas (executou 2x)
**Solução**: Usar `IF NOT EXISTS` (já está no script) - repita a execução

### Erro: "permission denied"
**Causa**: Usando anon key ao invés de service_role key
**Solução**: Verifique que está usando o Supabase Console (não REST API)

---

## 📋 Próxima Etapa

Depois de confirmada a execução:

1. ✅ SQL Migration completa
2. ⏳ Iniciar DeskRPG (próxima etapa)
3. ⏳ Executar testes de integração
4. ⏳ Deploy no Vercel

---

**Status**: Pronto para executar na Supabase Console
