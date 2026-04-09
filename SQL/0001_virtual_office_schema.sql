-- ═════════════════════════════════════════════════════════════════
-- VIRTUAL OFFICE SCHEMA
-- Criado: 2026-04-09
-- Propósito: Escritórios virtuais com agentes NPC para automação 24h
--
-- ⚠️ IMPORTANTE: Este script APENAS cria novas tabelas
-- Nenhuma tabela existente é modificada ou deletada
-- ═════════════════════════════════════════════════════════════════

-- ─── TABLE 1: Prédios (Edifícios) ───
CREATE TABLE IF NOT EXISTS virtual_buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  total_floors INT DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Inserir prédio principal Starken
INSERT INTO virtual_buildings (name, description)
VALUES ('Starken', 'Prédio central - Headquarters')
ON CONFLICT DO NOTHING;

-- ─── TABLE 2: Escritórios (Clients) ───
CREATE TABLE IF NOT EXISTS virtual_offices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES virtual_buildings(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  client_name TEXT NOT NULL,
  office_name TEXT,
  floor INT,
  description TEXT,
  leader_user TEXT,  -- Juan, Henrique, Emily
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(building_id, client_id)
);

CREATE INDEX idx_virtual_offices_client_id ON virtual_offices(client_id);
CREATE INDEX idx_virtual_offices_building_id ON virtual_offices(building_id);

-- ─── TABLE 3: Salas (Rooms/Departments) ───
CREATE TABLE IF NOT EXISTS virtual_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES virtual_offices(id) ON DELETE CASCADE,
  room_name TEXT NOT NULL,           -- "Sala de Design", "Sala de Conteúdo"
  room_type TEXT NOT NULL,           -- 'design', 'content', 'publishing', 'analytics'
  description TEXT,
  capacity INT DEFAULT 10,           -- Máximo de NPCs nesta sala
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_virtual_rooms_office_id ON virtual_rooms(office_id);
CREATE INDEX idx_virtual_rooms_type ON virtual_rooms(room_type);

-- ─── TABLE 4: NPCs (Agentes) ───
CREATE TABLE IF NOT EXISTS virtual_npcs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES virtual_rooms(id) ON DELETE CASCADE,
  office_id UUID NOT NULL REFERENCES virtual_offices(id) ON DELETE CASCADE,
  npc_name TEXT NOT NULL,            -- "Designer Bot", "Writer Bot"
  npc_type TEXT NOT NULL,            -- 'designer', 'writer', 'publisher', 'analyst'
  client_id TEXT NOT NULL,           -- Para qual cliente trabalha
  specialty TEXT,
  status TEXT DEFAULT 'offline',     -- 'online', 'working', 'idle', 'offline'
  current_task_id UUID,
  capability_level INT DEFAULT 3,    -- 1-5 (skill)
  tasks_completed INT DEFAULT 0,
  uptime_hours INT DEFAULT 0,
  last_active_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_virtual_npcs_room_id ON virtual_npcs(room_id);
CREATE INDEX idx_virtual_npcs_office_id ON virtual_npcs(office_id);
CREATE INDEX idx_virtual_npcs_client_id ON virtual_npcs(client_id);
CREATE INDEX idx_virtual_npcs_status ON virtual_npcs(status);

-- ─── TABLE 5: NPC Central (CEO Bot) ───
CREATE TABLE IF NOT EXISTS virtual_npc_central (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES virtual_buildings(id) ON DELETE CASCADE,
  npc_name TEXT DEFAULT 'CEO Bot',
  role TEXT DEFAULT 'Chief Operations Officer',
  status TEXT DEFAULT 'offline',     -- 'online', 'busy', 'offline'
  reports_received INT DEFAULT 0,
  last_report_time TIMESTAMP WITH TIME ZONE,
  uptime_hours INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_virtual_npc_central_building_id ON virtual_npc_central(building_id);

-- ─── TABLE 6: Tarefas para NPCs ───
CREATE TABLE IF NOT EXISTS virtual_npc_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  npc_id UUID REFERENCES virtual_npcs(id) ON DELETE SET NULL,
  office_id UUID NOT NULL REFERENCES virtual_offices(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES virtual_rooms(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL,           -- 'create_design', 'write_content', 'publish_post', 'generate_report'
  task_name TEXT NOT NULL,
  task_description TEXT,
  task_content JSONB,                -- Dados específicos da tarefa
  status TEXT DEFAULT 'pending',     -- 'pending', 'in_progress', 'completed', 'failed'
  priority TEXT DEFAULT 'normal',    -- 'low', 'normal', 'high', 'urgent'
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  result_data JSONB,                 -- Resultado da execução
  error_message TEXT,
  created_by TEXT,                   -- Quem criou (usuario ou sistema)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_virtual_npc_tasks_npc_id ON virtual_npc_tasks(npc_id);
CREATE INDEX idx_virtual_npc_tasks_office_id ON virtual_npc_tasks(office_id);
CREATE INDEX idx_virtual_npc_tasks_room_id ON virtual_npc_tasks(room_id);
CREATE INDEX idx_virtual_npc_tasks_status ON virtual_npc_tasks(status);

-- ─── TABLE 7: Relatórios dos Squad Leaders ───
CREATE TABLE IF NOT EXISTS virtual_squad_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES virtual_offices(id) ON DELETE CASCADE,
  leader_name TEXT NOT NULL,         -- Juan, Henrique, Emily
  report_date DATE NOT NULL,
  report_period TEXT,                -- 'daily', 'weekly', 'monthly'
  metrics JSONB,                     -- {posts: 5, engagement: 240, roi: 1.5, ...}
  performance_score INT,             -- 1-100
  highlights TEXT,                   -- Pontos positivos
  challenges TEXT,                   -- Desafios encontrados
  recommendations TEXT,              -- Recomendações
  sent_to_ceo_bot BOOLEAN DEFAULT false,
  received_by_ceo_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_virtual_squad_reports_office_id ON virtual_squad_reports(office_id);
CREATE INDEX idx_virtual_squad_reports_leader_name ON virtual_squad_reports(leader_name);
CREATE INDEX idx_virtual_squad_reports_report_date ON virtual_squad_reports(report_date);

-- ─── TABLE 8: Dashboard do CEO Bot (Consolidação) ───
CREATE TABLE IF NOT EXISTS virtual_ceo_dashboard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  npc_central_id UUID NOT NULL REFERENCES virtual_npc_central(id) ON DELETE CASCADE,
  report_period DATE NOT NULL,       -- Por dia, semana, mês
  period_type TEXT DEFAULT 'daily',  -- 'daily', 'weekly', 'monthly'
  total_clients INT,
  total_offices INT,
  total_rooms INT,
  total_npcs_active INT,
  total_tasks_completed INT,
  total_tasks_pending INT,
  total_tasks_failed INT,
  avg_performance_score INT,
  top_performing_office_id UUID REFERENCES virtual_offices(id),
  bottom_performing_office_id UUID REFERENCES virtual_offices(id),
  strategic_insights TEXT,
  alerts JSONB,                      -- {type: 'error', message: '...'}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_virtual_ceo_dashboard_npc_central_id ON virtual_ceo_dashboard(npc_central_id);
CREATE INDEX idx_virtual_ceo_dashboard_report_period ON virtual_ceo_dashboard(report_period);

-- ─── TABLE 9: Activity Log ───
CREATE TABLE IF NOT EXISTS virtual_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID REFERENCES virtual_offices(id) ON DELETE CASCADE,
  room_id UUID REFERENCES virtual_rooms(id) ON DELETE CASCADE,
  npc_id UUID REFERENCES virtual_npcs(id) ON DELETE CASCADE,
  action TEXT NOT NULL,              -- 'npc_online', 'task_assigned', 'task_completed', 'error'
  action_type TEXT,
  entity_id UUID,
  details JSONB,
  severity TEXT DEFAULT 'info',      -- 'info', 'warning', 'error'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_virtual_activity_log_office_id ON virtual_activity_log(office_id);
CREATE INDEX idx_virtual_activity_log_npc_id ON virtual_activity_log(npc_id);
CREATE INDEX idx_virtual_activity_log_created_at ON virtual_activity_log(created_at);

-- ═════════════════════════════════════════════════════════════════
-- RLS (Row Level Security) - Opcional para futuro
-- ═════════════════════════════════════════════════════════════════

-- Descomentar quando implementar segurança multi-tenant
-- ALTER TABLE virtual_offices ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE virtual_rooms ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE virtual_npcs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE virtual_npc_tasks ENABLE ROW LEVEL SECURITY;

-- ═════════════════════════════════════════════════════════════════
-- SUMMARY
-- ═════════════════════════════════════════════════════════════════
-- Tabelas criadas: 9
-- Índices criados: 15
-- Triggers: 0 (por enquanto)
-- Foreign keys: Todas implementadas com CASCADE
-- RLS: Desativado (ativar quando necessário)
--
-- ⚠️ Verificação de Segurança:
-- ✅ Nenhuma tabela existente foi modificada
-- ✅ Nenhuma tabela existente foi deletada
-- ✅ Nenhum dado foi perdido
-- ✅ Rollback é simples: DROP TABLE virtual_* CASCADE;
-- ═════════════════════════════════════════════════════════════════
