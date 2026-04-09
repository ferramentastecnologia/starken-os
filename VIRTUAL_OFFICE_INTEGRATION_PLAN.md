# 📋 PLANO DE IMPLEMENTAÇÃO: ESCRITÓRIO VIRTUAL

## 📌 VISÃO GERAL
Integração de um sistema de "Escritório Virtual" ao Starken OS, permitindo que agentes trabalhem 24h/dia em tarefas automáticas, com salas específicas por cliente.

**Status**: Planejamento (Aguardando aprovação antes de implementação)

---

## 🏗️ ARQUITETURA PROPOSTA

### 1. ESTRUTURA DO MENU (Sidebar)
```
┌─────────────────────────────┐
│   STARKEN OS                │
│   SISTEMA OPERACIONAL       │
├─────────────────────────────┤
│ [STARKEN] [ALPHA]           │
├─────────────────────────────┤
│ 📊 Dashboard                │  ← Existente
│ 🏢 Escritório Virtual      │  ← NOVO
│ 📋 Minhas Tasks            │  ← Existente
│ 📅 Calendário de Postagens │  ← Existente
│ ★ Starken Performance      │  ← Existente
│    ├ Conteúdo Geral        │
│    └ Stories Recorrentes   │
└─────────────────────────────┘
```

### 2. ESTRUTURA DE DADOS (Supabase)

#### Tabela: `virtual_office_agents`
```sql
CREATE TABLE virtual_office_agents (
  id UUID PRIMARY KEY,
  name TEXT,
  status ENUM('online', 'offline', 'busy', 'idle'),
  client_id TEXT REFERENCES meta_config(client_id),
  room_id UUID REFERENCES virtual_office_rooms(id),
  capabilities TEXT[],  -- ['content-creation', 'publishing', 'scheduling', etc]
  last_activity TIMESTAMP,
  current_task_id UUID,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

#### Tabela: `virtual_office_rooms`
```sql
CREATE TABLE virtual_office_rooms (
  id UUID PRIMARY KEY,
  client_id TEXT REFERENCES meta_config(client_id),
  client_name TEXT,
  room_name TEXT DEFAULT 'Sala Principal',
  active BOOLEAN DEFAULT true,
  max_agents INT DEFAULT 10,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

#### Tabela: `virtual_office_tasks`
```sql
CREATE TABLE virtual_office_tasks (
  id UUID PRIMARY KEY,
  room_id UUID REFERENCES virtual_office_rooms(id),
  client_id TEXT,
  task_type ENUM('content-creation', 'scheduling', 'publishing', 'analytics', 'custom'),
  task_name TEXT,
  description TEXT,
  status ENUM('pending', 'in-progress', 'completed', 'failed'),
  assigned_agent_id UUID REFERENCES virtual_office_agents(id),
  scheduled_time TIMESTAMP,
  completed_at TIMESTAMP,
  result_data JSONB,
  error_message TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

#### Tabela: `virtual_office_activity_log`
```sql
CREATE TABLE virtual_office_activity_log (
  id UUID PRIMARY KEY,
  room_id UUID REFERENCES virtual_office_rooms(id),
  agent_id UUID REFERENCES virtual_office_agents(id),
  action TEXT,
  task_id UUID,
  details JSONB,
  created_at TIMESTAMP
);
```

---

## 🎯 FLUXO DE FUNCIONAMENTO

### Integração com DeskRPG
```
┌──────────────────┐
│   Agentes RPG    │  (Projeto DeskRPG)
│   - Funções      │
│   - Habilidades  │
│   - Estado       │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────┐
│ Escritório Virtual       │
│ - Salas por Cliente      │
│ - Queue de Tarefas       │
│ - Status dos Agentes     │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│  Starken OS Frontend     │
│  - Visualização          │
│  - Controle              │
│  - Analytics             │
└──────────────────────────┘
```

### Fluxo de Execução de Tarefa
```
1. Usuario cria tarefa no Starken OS
   ↓
2. Tarefa vai para fila (virtual_office_tasks)
   ↓
3. Agente (DeskRPG) recebe tarefa
   ↓
4. Agente executa (segundo suas capacidades)
   ↓
5. Resultado retorna para Starken OS
   ↓
6. Status atualizado em tempo real (WebSocket/Polling)
```

---

## 📂 ESTRUTURA DE ARQUIVOS PROPOSTA

```
/home/user/starken-os/
├── checklist-relatorios.html          (Main SPA - será modificado)
├── api/
│   ├── virtual-office.js              (NOVO - Gerenciamento de Escritório)
│   ├── agents.js                      (NOVO - Integração com DeskRPG)
│   └── ...
├── deskrpg/                           (NOVO - Cópia do projeto)
│   ├── agents/
│   ├── functions/
│   ├── tasks/
│   └── ...
├── VIRTUAL_OFFICE_INTEGRATION_PLAN.md (Este arquivo)
└── ...
```

---

## 🔧 MODIFICAÇÕES NO HTML (checklist-relatorios.html)

### 1. Adicionar Menu Item

**Localização**: Sidebar navigation (após Dashboard, antes de Minhas Tasks)

```html
<!-- Novo Menu Item -->
<div class="sidebar-menu-item" onclick="switchTab('escritorio-virtual')" id="nav-escritorio">
  <span class="icon">🏢</span>
  <span class="label">Escritório Virtual</span>
  <span class="badge-online" id="badge-agents-online">0</span>
</div>
```

### 2. Adicionar Seção de Conteúdo

**Localização**: Após a seção de Dashboard

```html
<div id="escritorio-virtual-tab" class="main-content-area hidden">
  <div class="escritorio-header">
    <h1>🏢 Escritório Virtual - Centro de Operações</h1>
    <div class="controls">
      <button onclick="evoOpenAgentSettings()">⚙️ Configurar Agentes</button>
      <button onclick="evoRefreshStatus()">🔄 Atualizar Status</button>
    </div>
  </div>
  
  <!-- Estatísticas Globais -->
  <div class="evo-stats-grid">
    <div class="stat-card">
      <span class="stat-label">Agentes Online</span>
      <span class="stat-value" id="stat-agents-online">0</span>
    </div>
    <div class="stat-card">
      <span class="stat-label">Tarefas em Progresso</span>
      <span class="stat-value" id="stat-tasks-active">0</span>
    </div>
    <div class="stat-card">
      <span class="stat-label">Taxa de Sucesso</span>
      <span class="stat-value" id="stat-success-rate">0%</span>
    </div>
    <div class="stat-card">
      <span class="stat-label">Salas Ativas</span>
      <span class="stat-value" id="stat-rooms-active">0</span>
    </div>
  </div>

  <!-- Seletor de Cliente/Sala -->
  <div class="evo-client-selector">
    <label>Selecionar Sala:</label>
    <select id="evo-room-selector" onchange="evoSwitchRoom(this.value)">
      <option value="">Todas as Salas</option>
      <!-- Preenchido dinamicamente -->
    </select>
  </div>

  <!-- Conteúdo Principal: Abas -->
  <div class="evo-tabs">
    <button class="evo-tab-button active" onclick="evoSwitchEvoTab('agentes')">
      👥 Agentes Ativos
    </button>
    <button class="evo-tab-button" onclick="evoSwitchEvoTab('tarefas')">
      📋 Fila de Tarefas
    </button>
    <button class="evo-tab-button" onclick="evoSwitchEvoTab('atividade')">
      📊 Atividade & Logs
    </button>
    <button class="evo-tab-button" onclick="evoSwitchEvoTab('configuracao')">
      ⚙️ Configuração
    </button>
  </div>

  <!-- Aba: Agentes -->
  <div id="evo-tab-agentes" class="evo-tab-content">
    <div class="evo-agents-grid" id="evo-agents-container">
      <!-- Preenchido dinamicamente -->
    </div>
  </div>

  <!-- Aba: Tarefas -->
  <div id="evo-tab-tarefas" class="evo-tab-content hidden">
    <div class="evo-tasks-list" id="evo-tasks-container">
      <!-- Preenchido dinamicamente -->
    </div>
  </div>

  <!-- Aba: Atividade -->
  <div id="evo-tab-atividade" class="evo-tab-content hidden">
    <div class="evo-activity-log" id="evo-activity-container">
      <!-- Preenchido dinamicamente -->
    </div>
  </div>

  <!-- Aba: Configuração -->
  <div id="evo-tab-configuracao" class="evo-tab-content hidden">
    <div class="evo-settings-panel" id="evo-settings-container">
      <!-- Preenchido dinamicamente -->
    </div>
  </div>
</div>
```

### 3. Adicionar CSS Styling

```css
/* ─── ESCRITÓRIO VIRTUAL ─── */
.evo-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  font-weight: 600;
}

.stat-value {
  font-size: var(--text-2xl);
  font-weight: 800;
  color: var(--brand);
}

.evo-agents-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
}

.evo-agent-card {
  background: var(--bg-surface);
  border: 2px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  transition: all 0.2s;
}

.evo-agent-card.online {
  border-color: var(--color-success);
  box-shadow: 0 0 8px rgba(22, 163, 74, 0.2);
}

.evo-agent-card.busy {
  border-color: var(--color-warning);
  box-shadow: 0 0 8px rgba(217, 119, 6, 0.2);
}

.evo-agent-card.offline {
  opacity: 0.6;
  border-color: var(--border);
}

/* ─── AGENT CARD CONTENT ─── */
.evo-agent-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.evo-agent-name {
  font-weight: 700;
  font-size: var(--text-lg);
}

.evo-agent-status {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: var(--text-xs);
  font-weight: 600;
}

.evo-agent-status.online {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.evo-agent-status.busy {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.evo-agent-status.offline {
  background: var(--border-subtle);
  color: var(--text-tertiary);
}

/* ─── TABS ─── */
.evo-tabs {
  display: flex;
  gap: 8px;
  border-bottom: 2px solid var(--border);
  margin-bottom: 24px;
  overflow-x: auto;
}

.evo-tab-button {
  padding: 12px 16px;
  background: none;
  border: none;
  cursor: pointer;
  font-weight: 600;
  color: var(--text-secondary);
  transition: all 0.2s;
  border-bottom: 3px solid transparent;
  margin-bottom: -2px;
}

.evo-tab-button.active {
  color: var(--brand);
  border-bottom-color: var(--brand);
}

.evo-tab-content.hidden {
  display: none;
}
```

---

## 🔌 INTEGRAÇÃO COM DeskRPG

### Funções a Serem Mapeadas

Quando você copiar o projeto deskrpg, identificaremos:

1. **Agentes Disponíveis**
   - [ ] Quais agentes existem
   - [ ] Quais são suas capacidades
   - [ ] Como inicializá-los

2. **Tarefas/Funções**
   - [ ] Quais tarefas eles podem executar
   - [ ] Qual é a API delas
   - [ ] Qual é o formato de input/output

3. **Estado & Persistência**
   - [ ] Como verificar status
   - [ ] Como armazenar estado
   - [ ] Como fazer callbacks

### Exemplo de Integração (Pseudocódigo)

```javascript
// Inicializar Agente
async function evoSpawnAgent(agentType, clientId) {
  const agent = await DeskRPG.createAgent({
    type: agentType,
    capabilities: ['content-creation', 'publishing', 'scheduling'],
    roomId: clientId,
    onTaskComplete: evoHandleTaskComplete,
    onStatusChange: evoHandleStatusChange
  });
  return agent;
}

// Enviar Tarefa para Agente
async function evoAssignTask(agentId, task) {
  const result = await DeskRPG.assignTask(agentId, {
    type: task.type,
    payload: task.data,
    deadline: task.due_date
  });
  return result;
}

// Receber Callback de Conclusão
function evoHandleTaskComplete(taskId, result) {
  // Atualizar Supabase
  // Notificar UI
  // Logs
}
```

---

## 📊 SALAS POR CLIENTE

### Estrutura de Salas

Cada cliente terá uma "sala" no escritório virtual:

```
┌─────────────────────────────────────┐
│ Cliente: Hamburgueria Feio          │
├─────────────────────────────────────┤
│ Sala Principal                      │
│ ├─ Agente #1: Content Creator      │
│ ├─ Agente #2: Publisher Bot        │
│ └─ Agente #3: Scheduler Helper     │
│                                     │
│ Fila de Tarefas:                   │
│ ├─ [Pendente] Criar post Feed      │
│ ├─ [Em Progresso] Postar Story     │
│ └─ [Agendada] Publicar Carrossel   │
│                                     │
│ Atividades Recentes:               │
│ └─ 14:32 - Agente #1 criou post   │
└─────────────────────────────────────┘
```

### Layout da Sala (UI)

```
[Cliente: Hamburgueria Feio] [Mudar Sala ▼]

┌─────────────────────────────────────────┐
│ AGENTES NESTA SALA                      │
├─────────────────────────────────────────┤
│ [👤 Content Creator] [ONLINE]           │
│ └─ Criando post de café ☕ (50%)         │
│                                         │
│ [👤 Publisher Bot] [IDLE]               │
│ └─ Aguardando tarefa...                 │
│                                         │
│ [👤 Scheduler] [OFFLINE]                │
│ └─ Último visto: há 2h                 │
├─────────────────────────────────────────┤
│ FILA DE TAREFAS (3 pendentes)           │
├─────────────────────────────────────────┤
│ [1] Criar conteúdo para Instagram      │
│     Atribuído a: Content Creator        │
│     Status: [████░░░░░░] 40%            │
│                                         │
│ [2] Publicar carousel de fotos         │
│     Atribuído a: (não atribuído)        │
│     Status: [░░░░░░░░░░] Pendente      │
│                                         │
│ [3] Agendar Stories para amanhã        │
│     Atribuído a: Scheduler              │
│     Status: [░░░░░░░░░░] Pendente      │
└─────────────────────────────────────────┘
```

---

## 🔄 FLUXO DE POLLING/WEBSOCKET

Para manter a UI atualizada em tempo real:

```javascript
// Polling cada 5-10 segundos (fallback)
const evoPollingInterval = setInterval(evoRefreshVirtualOfficeData, 5000);

// WebSocket (ideal, mas com fallback)
const evoWS = new WebSocket('wss://...');
evoWS.onmessage = (event) => {
  const { type, data } = JSON.parse(event.data);
  if (type === 'agent-status-change') evoUpdateAgentUI(data);
  if (type === 'task-progress') evoUpdateTaskProgress(data);
  if (type === 'activity-log') evoAddActivityLog(data);
};
```

---

## ⚙️ FUNÇÕES JAVASCRIPT A IMPLEMENTAR

```javascript
// Inicialização
function evoInit()
function evoLoadRooms()
function evoLoadAgents(roomId)

// Gerenciamento de Salas
function evoSwitchRoom(roomId)
function evoCreateRoom(clientId)
function evoDeleteRoom(roomId)

// Gerenciamento de Agentes
function evoSpawnAgent(agentType, roomId, capabilities)
function evoKillAgent(agentId)
function evoGetAgentStatus(agentId)

// Gerenciamento de Tarefas
function evoCreateTask(roomId, taskData)
function evoAssignTask(taskId, agentId)
function evoCheckTaskProgress(taskId)
function evoCompleteTask(taskId)

// UI Updates
function evoSwitchEvoTab(tabName)
function evoRenderAgents(agents)
function evoRenderTasks(tasks)
function evoRenderActivityLog(logs)
function evoUpdateStats()

// Polling & Real-time
function evoRefreshVirtualOfficeData()
function evoHandleAgentStatusChange(agentId, newStatus)
function evoHandleTaskProgress(taskId, progress)
function evoAddActivityLog(activity)
```

---

## 🚀 FASES DE IMPLEMENTAÇÃO

### Fase 1: Setup Base (Hoje)
- [ ] Copiar projeto DeskRPG para `/deskrpg/`
- [ ] Analisar estrutura do DeskRPG
- [ ] Criar tabelas Supabase
- [ ] Mapear funções/agentes disponíveis

### Fase 2: UI & Frontend (Dia 2)
- [ ] Adicionar menu "Escritório Virtual"
- [ ] Criar layout de salas/agentes
- [ ] Implementar abas
- [ ] Adicionar CSS styling

### Fase 3: Backend & Integração (Dia 3)
- [ ] Criar API endpoints
- [ ] Integrar com DeskRPG agents
- [ ] Implementar polling/WebSocket
- [ ] Testes básicos

### Fase 4: Otimização & Deploy (Dia 4)
- [ ] Performance tuning
- [ ] Error handling
- [ ] Deploy para Vercel
- [ ] Documentação

---

## 📋 CHECKLIST PRÉ-IMPLEMENTAÇÃO

- [ ] Projeto DeskRPG copiado e analisado
- [ ] Estrutura de dados aprovada
- [ ] Fluxo de integração validado
- [ ] Mockups UI apresentados
- [ ] Funções JavaScript documentadas
- [ ] Plano de phases aprovado

---

## ⚠️ CONSIDERAÇÕES

1. **Limite de Vercel**: Atualmente 12/12 funções. Pode precisar upgrade ou reorganização.
2. **WebSockets**: Supabase suporta via realtime, ou usar polling simples.
3. **Segurança**: Validar que agentes só acessem dados do seu cliente.
4. **Performance**: Começar com polling, migrar para WebSocket se necessário.
5. **Backup**: Versionar tabelas Supabase antes de mudanças.

---

## 📞 PRÓXIMAS PASSOS

1. **Você aprova este plano?** ✅/❌
2. **Copiar projeto DeskRPG**
3. **Eu analisar estrutura**
4. **Você revisar detalhes de integração**
5. **Começar Fase 1**

---

*Documento de Planejamento - Aguardando Aprovação*
*Última atualização: 2026-04-09*
