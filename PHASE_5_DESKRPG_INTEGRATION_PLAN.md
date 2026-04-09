# 🔌 PLANO DE INTEGRAÇÃO: DeskRPG com Starken OS

**Status**: Análise Completa
**Data**: 2026-04-09

---

## 📊 O QUE É DeskRPG

**DeskRPG** é um Virtual Office 2D em pixel art com:
- ✅ Sistema de Canais (escritórios compartilhados)
- ✅ Agentes NPC com IA (OpenClaw)
- ✅ Task Management (atribuição e relatórios)
- ✅ Meeting Room (reuniões multi-agente)
- ✅ Map Editor (criar/editar mapas de escritório)

---

## 🏗️ ARQUITETURA DESKRPG

```
DeskRPG (Next.js + Drizzle ORM)
├── src/app/api/
│   ├── npcs/route.ts          ← Criar/listar NPCs
│   ├── npcs/[id]/route.ts     ← Detalhe NPC
│   ├── tasks/route.ts          ← Criar/listar tarefas
│   ├── channels/               ← Gerenciar canais/escritórios
│   └── ...
├── src/lib/
│   ├── task-manager.ts         ← Gerenciador de tarefas
│   ├── npc-agent-defaults.ts   ← Configurações de NPC
│   ├── task-prompt.js          ← Prompts para tarefas
│   └── ...
└── db/ (Drizzle ORM)
    ├── npcs                    ← Tabela de NPCs
    ├── tasks                   ← Tabela de tarefas
    ├── channels                ← Tabela de canais
    └── ...
```

---

## 🔑 DADOS PRINCIPAIS

### NPC (Agente)
```typescript
{
  id: string,
  name: string,                    // "Designer Bot"
  channelId: string,              // Escritório
  appearance: {},                 // Aparência pixel-art
  positionX: number,
  positionY: number,
  direction: string,
  openclawConfig: {
    agentId: string,              // ID do agente IA
  },
  hasAgent: boolean,
}
```

### Task (Tarefa)
```typescript
{
  id: string,
  channelId: string,              // Escritório
  npcId: string,                  // NPC responsável
  title: string,                  // "Criar post Instagram"
  summary: string,                // Descrição
  status: 'pending' | 'running' | 'completed' | 'failed',
  assignerId: string,             // Quem atribuiu
  createdAt: Date,
  completedAt?: Date,
}
```

### Channel (Escritório)
```typescript
{
  id: string,
  name: string,                   // "Starken - Design"
  createdAt: Date,
}
```

---

## 🔗 ESTRATÉGIA DE INTEGRAÇÃO

### MAPEAR Escritórios Starken → Canais DeskRPG

```
Starken OS (Virtual Office)
├── Prédio Starken
│   ├── Escritório Cliente A
│   │   ├── Sala de Design      →  DeskRPG Channel: "Cliente A - Design"
│   │   ├── Sala de Conteúdo    →  DeskRPG Channel: "Cliente A - Content"
│   │   └── ...
│   └── Escritório Cliente B
│       └── ...
```

### MAPEAR NPCs Starken → NPCs DeskRPG

```
virtual_npcs (Starken OS)
├── Designer Bot (Cliente A)     →  DeskRPG NPC em "Cliente A - Design"
├── Writer Bot (Cliente A)       →  DeskRPG NPC em "Cliente A - Content"
├── Publisher Bot (Cliente B)    →  DeskRPG NPC em "Cliente B - Publish"
└── ...
```

### MAPEAR Tarefas Starken → Tarefas DeskRPG

```
virtual_npc_tasks (Starken OS)
├── [1] Criar post (Starken OS)  →  Task no DeskRPG
├── [2] Publicar IG (Starken OS) →  Task no DeskRPG
└── ...

DeskRPG Task
├── Quando completada             → Callback para Starken OS
├── Resultado é salvo             → virtual_npc_tasks.result_data
├── Status atualizado             → virtual_npc_tasks.status = 'completed'
└── Activity log criado           → virtual_activity_log
```

---

## 🚀 FLUXO DE FUNCIONAMENTO

### CENÁRIO: Atribuir tarefa ao NPC

```
1. USUÁRIO (Starken OS)
   ├─ Clica "Atribuir Tarefa" em um Designer Bot
   └─ Preenche: "Criar banner para Instagram"
                    ↓
2. VO.apiCall('vo_create_task', {...})
   ├─ Cria virtual_npc_task no Starken OS
   └─ Chama DeskRPG API
                    ↓
3. DeskRPG CREATE TASK
   ├─ POST /api/tasks
   ├─ Cria task no channel do cliente
   ├─ Atribui ao NPC correspondente
   └─ Inicia execução do agente IA
                    ↓
4. AGENTE IA EXECUTA
   ├─ Recebe prompt com contexto
   ├─ Executa ação (criar conteúdo)
   └─ Retorna resultado
                    ↓
5. CALLBACK WEBHOOK (DeskRPG → Starken OS)
   ├─ POST /api/deskrpg-webhook
   ├─ Atualiza virtual_npc_tasks
   ├─ Atualiza virtual_npcs status
   └─ Cria virtual_activity_log
                    ↓
6. UI ATUALIZA EM TEMPO REAL
   ├─ NPC mostra "Trabalhando..." ➜ "Completo"
   ├─ Resultado exibido no modal
   └─ Dashboard CEO atualiza
```

---

## 🛠️ IMPLEMENTAÇÃO

### ARQUIVO 1: `api/deskrpg-bridge.js`
Funções para comunicar com DeskRPG API:
- `deskrpgCreateChannel(clientId, roomType)` - Criar canal para cliente
- `deskrpgCreateNpc(channelId, npcName, persona)` - Criar agente
- `deskrpgCreateTask(npcId, taskTitle, taskSummary)` - Atribuir tarefa
- `deskrpgGetNpcStatus(npcId)` - Verificar status
- `deskrpgGetTaskResult(taskId)` - Obter resultado

### ARQUIVO 2: `api/content.js` (Adicionar 3 ações)
```javascript
ACTIONS = {
  ...existing,
  // DeskRPG Bridge
  vo_sync_deskrpg_npc: voSyncDeskrpgNpc,       // Sincronizar status
  vo_fetch_deskrpg_task: voFetchDeskrpgTask,   // Buscar resultado
  vo_webhook_deskrpg: voWebhookDeskrpg,        // Receber callback
}
```

### ARQUIVO 3: `api/deskrpg-webhook.js`
Endpoint para DeskRPG enviar resultados:
```javascript
// POST /api/deskrpg-webhook
// Body: {
//   taskId: "xyz",
//   npcId: "abc",
//   status: "completed",
//   result: {...},
//   timestamp: "2026-04-09T..."
// }
```

### ARQUIVO 4: Atualizar `js/virtual-npc-ui.js`
Integrar callbacks do DeskRPG:
```javascript
// Quando tarefa é atribuída, usar DeskRPG
// Quando resultado chega via webhook, atualizar UI
// Polling para sincronizar status
```

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

- [ ] **Fase 5A**: Criar `api/deskrpg-bridge.js`
  - [ ] Função para criar canais
  - [ ] Função para criar NPCs
  - [ ] Função para atribuir tarefas
  - [ ] Função para sincronizar status

- [ ] **Fase 5B**: Criar `api/deskrpg-webhook.js`
  - [ ] Endpoint para receber callbacks
  - [ ] Validação de requests
  - [ ] Atualizar virtual_npc_tasks
  - [ ] Atualizar virtual_npcs status
  - [ ] Criar activity log

- [ ] **Fase 5C**: Adicionar 3 ações a `api/content.js`
  - [ ] `vo_sync_deskrpg_npc` - sincronizar
  - [ ] `vo_fetch_deskrpg_task` - buscar resultado
  - [ ] `vo_webhook_deskrpg` - webhook handler

- [ ] **Fase 5D**: Atualizar `js/virtual-npc-ui.js`
  - [ ] Integrar DeskRPG ao criar tarefa
  - [ ] Polling para sincronizar
  - [ ] Atualizar UI com progresso
  - [ ] Mostrar resultado quando completo

- [ ] **Fase 5E**: Testes de integração
  - [ ] Criar tarefa Starken → Executa DeskRPG
  - [ ] DeskRPG completa → Retorna para Starken
  - [ ] Status sincronizado
  - [ ] Activity logs criados

---

## 🌐 ENDPOINTS DESKRPG (HOST??)

Para integrar, preciso saber:
1. **Onde rodar DeskRPG?**
   - Localhost (`:3000`)?
   - Docker container?
   - URL remoto?

2. **Qual é a base URL?**
   - `http://localhost:3000`?
   - `http://deskrpg:3000` (docker)?
   - Outra?

3. **Autenticação?**
   - Token bearer?
   - API key?
   - Nenhuma (dev)?

4. **Webhooks?**
   - DeskRPG pode fazer POST callbacks?
   - Qual seria a URL que DeskRPG usaria?
     - `https://starken-os.vercel.app/api/deskrpg-webhook`?
     - `http://localhost:7001/api/deskrpg-webhook`?

---

## 📌 PRÓXIMOS PASSOS

1. **Responder 4 perguntas acima** sobre DeskRPG setup
2. **Criar `api/deskrpg-bridge.js`** com funções base
3. **Criar `api/deskrpg-webhook.js`** para receber callbacks
4. **Adicionar 3 ações** em `api/content.js`
5. **Atualizar UI** para usar DeskRPG
6. **Testes end-to-end**

---

*Plano de Integração DeskRPG*
*Criado: 2026-04-09*
