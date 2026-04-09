-- ═════════════════════════════════════════════════════════════════
-- PHASE 5: DeskRPG Integration Schema
-- Criado: 2026-04-09
-- Propósito: Adicionar colunas para sincronização com DeskRPG
--
-- ⚠️ IMPORTANTE: Este script APENAS adiciona colunas e índices
-- Nenhuma tabela existente é deletada
-- ═════════════════════════════════════════════════════════════════

-- ─── Adicionar colunas de integração DeskRPG à tabela virtual_offices ───
-- Mapeia escritórios Starken → canais DeskRPG
ALTER TABLE virtual_offices ADD COLUMN IF NOT EXISTS deskrpg_channel_id TEXT;
ALTER TABLE virtual_offices ADD COLUMN IF NOT EXISTS deskrpg_synced_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE virtual_offices ADD COLUMN IF NOT EXISTS deskrpg_sync_status TEXT DEFAULT 'pending'; -- 'pending', 'synced', 'failed'

CREATE INDEX IF NOT EXISTS idx_virtual_offices_deskrpg_channel_id
  ON virtual_offices(deskrpg_channel_id);

-- ─── Adicionar colunas de integração DeskRPG à tabela virtual_npcs ───
-- Mapeia NPCs Starken → NPCs DeskRPG
ALTER TABLE virtual_npcs ADD COLUMN IF NOT EXISTS deskrpg_npc_id TEXT;
ALTER TABLE virtual_npcs ADD COLUMN IF NOT EXISTS deskrpg_synced_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE virtual_npcs ADD COLUMN IF NOT EXISTS deskrpg_sync_status TEXT DEFAULT 'pending'; -- 'pending', 'synced', 'failed'
ALTER TABLE virtual_npcs ADD COLUMN IF NOT EXISTS last_task_completed_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_virtual_npcs_deskrpg_npc_id
  ON virtual_npcs(deskrpg_npc_id);

-- ─── Adicionar colunas de integração DeskRPG à tabela virtual_npc_tasks ───
-- Mapeia tarefas Starken → tarefas DeskRPG
ALTER TABLE virtual_npc_tasks ADD COLUMN IF NOT EXISTS deskrpg_task_id TEXT;
ALTER TABLE virtual_npc_tasks ADD COLUMN IF NOT EXISTS deskrpg_synced_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE virtual_npc_tasks ADD COLUMN IF NOT EXISTS deskrpg_sync_status TEXT DEFAULT 'pending'; -- 'pending', 'synced', 'failed'
ALTER TABLE virtual_npc_tasks ADD COLUMN IF NOT EXISTS deskrpg_status TEXT; -- Espelho do status no DeskRPG
ALTER TABLE virtual_npc_tasks ADD COLUMN IF NOT EXISTS result_summary TEXT;

CREATE INDEX IF NOT EXISTS idx_virtual_npc_tasks_deskrpg_task_id
  ON virtual_npc_tasks(deskrpg_task_id);
CREATE INDEX IF NOT EXISTS idx_virtual_npc_tasks_deskrpg_sync_status
  ON virtual_npc_tasks(deskrpg_sync_status);

-- ─── Estender tabela virtual_activity_log com metadata DeskRPG ───
-- (Tabela já existe, apenas garantir coluna metadata)
ALTER TABLE virtual_activity_log ADD COLUMN IF NOT EXISTS metadata JSONB;

-- ─── Criar índice composto para queries rápidas ───
CREATE INDEX IF NOT EXISTS idx_virtual_npc_tasks_npc_status
  ON virtual_npc_tasks(npc_id, status);

-- ═════════════════════════════════════════════════════════════════
-- COMENTÁRIOS DE IMPLEMENTAÇÃO
-- ═════════════════════════════════════════════════════════════════
--
-- MAPEAMENTO: Starken OS ↔ DeskRPG
--
-- virtual_offices.deskrpg_channel_id
--   → DeskRPG channel_id (cada cliente = 1 channel)
--   → Armazenar quando channel é criado em DeskRPG
--
-- virtual_npcs.deskrpg_npc_id
--   → DeskRPG npc_id (cada NPC Starken = 1 NPC DeskRPG)
--   → Armazenar quando NPC é criado/importado em DeskRPG
--
-- virtual_npc_tasks.deskrpg_task_id
--   → DeskRPG task_id (cada tarefa Starken = 1 tarefa DeskRPG)
--   → Armazenar quando tarefa é criada em DeskRPG
--   → Usar para polling de status e resultados
--
-- WORKFLOW:
--
-- 1. User cria tarefa em Starken OS
--    → Cria registro em virtual_npc_tasks
--    → Frontend chama api/content.js?action=vo_create_task
--
-- 2. Backend (api/content.js) executa voCreateTask()
--    → Verifica se npc_id tem deskrpg_npc_id
--    → Se sim, chama deskrpg-bridge.deskrpgCreateTask()
--    → Recebe deskrpg_task_id e armazena em virtual_npc_tasks.deskrpg_task_id
--
-- 3. Frontend inicia polling (voStartTaskStatusPolling)
--    → Chama api/content.js?action=vo_fetch_deskrpg_task&task_id=...
--    → Backend chama deskrpg-bridge.deskrpgGetTaskResult()
--    → Atualiza virtual_npc_tasks com resultado
--
-- 4. DeskRPG completa tarefa
--    → DeskRPG envia POST /api/deskrpg-webhook com resultado
--    → Handler atualiza virtual_npc_tasks
--    → Cria registro em virtual_activity_log
--
-- 5. Frontend atualiza UI em tempo real
--    → Mostra status "Completo" e resultado
--
-- ═════════════════════════════════════════════════════════════════
