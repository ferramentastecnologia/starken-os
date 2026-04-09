/**
 * Virtual NPC UI - NPC Manager
 * Gerencia agentes NPC, status e tarefas
 */

// ─── State ───
let voNpcs = [];
let voNpcTasks = {};

// ─── Load NPCs ───
async function voLoadNpcs(officeId, roomId = null) {
  try {
    const params = { office_id: officeId };
    if (roomId) {
      params.room_id = roomId;
    }

    const result = await VO.apiCall('vo_list_npcs', params);
    voNpcs = result.npcs || [];
    return voNpcs;
  } catch (err) {
    console.error('[VO NPC] Failed to load NPCs:', err);
    return [];
  }
}

// ─── Render NPC List ───
async function voRenderNpcList(officeId, roomType) {
  const container = document.getElementById('vo-npcs-container');
  if (!container) return;

  try {
    const npcs = await voLoadNpcs(officeId);

    if (npcs.length === 0) {
      container.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:40px">Nenhum NPC nesta sala</p>';
      return;
    }

    let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px">';

    for (const npc of npcs) {
      const statusColor = {
        online: '#16a34a',
        working: '#f59e0b',
        idle: '#6b7280',
        offline: '#d1d5db',
      }[npc.status] || '#6b7280';

      const statusLabel = {
        online: '🟢 Online',
        working: '🔵 Trabalhando',
        idle: '⚪ Ocioso',
        offline: '⚫ Offline',
      }[npc.status] || '?';

      html += `
        <div
          class="vo-npc-card"
          style="padding:16px;background:var(--bg-surface);border:2px solid #e5e7eb;border-radius:8px;cursor:pointer;transition:all 0.2s"
          onclick="voShowNpcDetail('${npc.id}')"
          onmouseover="this.style.borderColor='${statusColor}';this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'"
          onmouseout="this.style.borderColor='#e5e7eb';this.style.boxShadow='none'"
        >
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px">
            <div>
              <h3 style="margin:0;color:var(--text-primary);font-size:1rem">${npc.npc_name}</h3>
              <p style="margin:4px 0 0;color:var(--text-secondary);font-size:0.8rem">${npc.specialty || 'Especialista'}</p>
            </div>
            <span style="display:inline-block;padding:4px 8px;background:${statusColor};color:white;border-radius:4px;font-size:0.7rem;font-weight:600;white-space:nowrap">
              ${statusLabel}
            </span>
          </div>

          <div style="background:#f9fafb;padding:12px;border-radius:6px;margin-bottom:12px;font-size:0.85rem">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <span style="color:var(--text-secondary)">Skill:</span>
              <strong style="color:var(--brand)">${npc.capability_level || 3}/5</strong>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <span style="color:var(--text-secondary)">Tarefas:</span>
              <strong style="color:var(--text-primary)">${npc.tasks_completed || 0}</strong>
            </div>
            <div style="display:flex;justify-content:space-between">
              <span style="color:var(--text-secondary)">Ativo há:</span>
              <strong style="color:var(--text-primary)">${npc.uptime_hours || 0}h</strong>
            </div>
          </div>

          <button
            onclick="event.stopPropagation();voShowAssignTaskModal('${npc.id}','${npc.npc_name}')"
            style="width:100%;padding:8px;background:var(--brand);color:white;border:none;border-radius:4px;cursor:pointer;font-size:0.85rem;font-weight:600;transition:background 0.2s"
            onmouseover="this.style.background='var(--brand-dark)'"
            onmouseout="this.style.background='var(--brand)'"
          >
            📋 Atribuir Tarefa
          </button>
        </div>
      `;
    }

    html += '</div>';
    container.innerHTML = html;
  } catch (err) {
    console.error('[VO NPC] Failed to render NPCs:', err);
  }
}

// ─── Show NPC Detail ───
async function voShowNpcDetail(npcId) {
  const npc = voNpcs.find(n => n.id === npcId);
  if (!npc) return;

  const modal = document.getElementById('vo-npc-detail-modal');
  if (!modal) {
    console.warn('[VO NPC] Modal not found');
    return;
  }

  modal.innerHTML = `
    <div style="background:var(--bg-surface);border-radius:8px;padding:24px;max-width:600px;width:90%">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:24px">
        <div>
          <h2 style="margin:0;color:var(--text-primary);font-size:1.5rem">${npc.npc_name}</h2>
          <p style="margin:8px 0 0;color:var(--text-secondary)">${npc.specialty || 'Especialista'}</p>
        </div>
        <button
          onclick="voCloseNpcDetail()"
          style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--text-muted)"
        >
          ✕
        </button>
      </div>

      <div style="background:var(--bg-elevated);padding:16px;border-radius:6px;margin-bottom:16px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;font-size:0.9rem">
          <div>
            <span style="color:var(--text-secondary)">Status:</span>
            <p style="margin:4px 0 0;color:var(--text-primary);font-weight:600">${npc.status || 'offline'}</p>
          </div>
          <div>
            <span style="color:var(--text-secondary)">Tipo:</span>
            <p style="margin:4px 0 0;color:var(--text-primary);font-weight:600">${npc.npc_type || '?'}</p>
          </div>
          <div>
            <span style="color:var(--text-secondary)">Skill Level:</span>
            <p style="margin:4px 0 0;color:var(--brand);font-weight:600">${npc.capability_level || 3}/5</p>
          </div>
          <div>
            <span style="color:var(--text-secondary)">Tarefas Completas:</span>
            <p style="margin:4px 0 0;color:var(--text-primary);font-weight:600">${npc.tasks_completed || 0}</p>
          </div>
          <div>
            <span style="color:var(--text-secondary)">Uptime:</span>
            <p style="margin:4px 0 0;color:var(--text-primary);font-weight:600">${npc.uptime_hours || 0}h</p>
          </div>
          <div>
            <span style="color:var(--text-secondary)">Última Atividade:</span>
            <p style="margin:4px 0 0;color:var(--text-primary);font-weight:600">${npc.last_active_at ? new Date(npc.last_active_at).toLocaleDateString('pt-BR') : '—'}</p>
          </div>
        </div>
      </div>

      <button
        onclick="voShowAssignTaskModal('${npc.id}','${npc.npc_name}');voCloseNpcDetail()"
        style="width:100%;padding:12px;background:var(--brand);color:white;border:none;border-radius:4px;cursor:pointer;font-weight:600;transition:background 0.2s"
        onmouseover="this.style.background='var(--brand-dark)'"
        onmouseout="this.style.background='var(--brand)'"
      >
        📋 Atribuir Nova Tarefa
      </button>
    </div>
  `;

  modal.style.display = 'flex';
}

// ─── Close NPC Detail ───
function voCloseNpcDetail() {
  const modal = document.getElementById('vo-npc-detail-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// ─── Show Assign Task Modal ───
function voShowAssignTaskModal(npcId, npcName) {
  const modal = document.getElementById('vo-assign-task-modal');
  if (!modal) {
    console.warn('[VO NPC] Assign task modal not found');
    return;
  }

  modal.innerHTML = `
    <div style="background:var(--bg-surface);border-radius:8px;padding:24px;max-width:500px;width:90%">
      <h2 style="margin:0 0 16px;color:var(--text-primary)">Atribuir Tarefa</h2>
      <p style="margin:0 0 24px;color:var(--text-secondary)">Para: <strong>${npcName}</strong></p>

      <div style="margin-bottom:16px">
        <label style="display:block;margin-bottom:8px;color:var(--text-secondary);font-weight:600;font-size:0.9rem">Nome da Tarefa</label>
        <input
          type="text"
          id="vo-task-name"
          placeholder="Ex: Criar post para Instagram"
          style="width:100%;padding:10px;border:1px solid var(--border);border-radius:4px;font-size:0.9rem"
        />
      </div>

      <div style="margin-bottom:16px">
        <label style="display:block;margin-bottom:8px;color:var(--text-secondary);font-weight:600;font-size:0.9rem">Descrição (Opcional)</label>
        <textarea
          id="vo-task-desc"
          placeholder="Detalhes da tarefa..."
          style="width:100%;padding:10px;border:1px solid var(--border);border-radius:4px;font-size:0.9rem;min-height:80px;resize:vertical"
        ></textarea>
      </div>

      <div style="display:flex;gap:10px">
        <button
          onclick="voAssignTaskAndClose('${npcId}')"
          style="flex:1;padding:10px;background:var(--brand);color:white;border:none;border-radius:4px;cursor:pointer;font-weight:600;transition:background 0.2s"
          onmouseover="this.style.background='var(--brand-dark)'"
          onmouseout="this.style.background='var(--brand)'"
        >
          ✓ Atribuir
        </button>
        <button
          onclick="voCloseAssignTaskModal()"
          style="flex:1;padding:10px;background:var(--border);color:var(--text-primary);border:none;border-radius:4px;cursor:pointer;font-weight:600;transition:background 0.2s"
          onmouseover="this.style.background:' var(--border-strong)'"
          onmouseout="this.style.background='var(--border)'"
        >
          ✕ Cancelar
        </button>
      </div>
    </div>
  `;

  modal.style.display = 'flex';
}

// ─── Assign Task and Close ───
async function voAssignTaskAndClose(npcId) {
  const taskName = document.getElementById('vo-task-name')?.value;
  const taskDesc = document.getElementById('vo-task-desc')?.value;

  if (!taskName) {
    alert('Digite o nome da tarefa');
    return;
  }

  try {
    // Create task in Starken OS virtual office
    const result = await VO.apiCall('vo_create_task', {
      npc_id: npcId,
      title: taskName,
      summary: taskDesc,
    });

    if (!result.success) {
      throw new Error(result.error || 'Falha ao criar tarefa');
    }

    const task = result.task;

    // Phase 5: If NPC is linked to DeskRPG, also create task there
    const npc = voNpcs.find(n => n.id === npcId);
    if (npc && npc.deskrpg_npc_id) {
      try {
        // Spawn background sync for DeskRPG (non-blocking)
        voSyncTaskWithDeskrpg(task.id, npc.deskrpg_npc_id, taskName, taskDesc);
      } catch (err) {
        console.warn('[VO NPC] DeskRPG sync failed (non-blocking):', err);
        // Don't fail the entire task if DeskRPG sync fails
      }
    }

    alert('Tarefa atribuída com sucesso!');
    voCloseAssignTaskModal();

    // Recarregar lista de NPCs
    if (voCurrentOffice) {
      await voRenderNpcList(voCurrentOffice.id, voCurrentRoom?.type);
    }
  } catch (err) {
    alert(`Erro: ${err.message}`);
  }
}

// ─── Sync Task with DeskRPG (Phase 5) ───
async function voSyncTaskWithDeskrpg(taskId, deskrpgNpcId, title, summary) {
  console.log(`[VO NPC] Syncing task ${taskId} with DeskRPG NPC ${deskrpgNpcId}`);

  try {
    // Call bridge to create task in DeskRPG
    // Note: This requires api/deskrpg-bridge.js to be properly configured
    // with DESKRPG_BASE_URL, DESKRPG_AUTH_TYPE, etc.

    // For now, log a message - actual implementation depends on DeskRPG setup
    console.log(`[VO NPC] Task sync queued: ${title} → DeskRPG`);

    // Future: Implement polling to sync task status back
    // voStartTaskStatusPolling(taskId, deskrpgNpcId);
  } catch (err) {
    console.error('[VO NPC] DeskRPG sync error:', err);
  }
}

// ─── Poll Task Status from DeskRPG ───
let voTaskPollingIntervals = {};

async function voStartTaskStatusPolling(taskId, deskrpgNpcId, interval = 5000) {
  console.log(`[VO NPC] Starting status polling for task ${taskId} (interval: ${interval}ms)`);

  const poll = async () => {
    try {
      const result = await VO.apiCall('vo_fetch_deskrpg_task', { task_id: taskId });

      if (result.deskrpg_task && result.deskrpg_task.status === 'completed') {
        console.log(`[VO NPC] Task ${taskId} completed in DeskRPG`);
        clearInterval(voTaskPollingIntervals[taskId]);
        delete voTaskPollingIntervals[taskId];

        // Update UI with result
        if (voCurrentOffice) {
          await voRenderNpcList(voCurrentOffice.id, voCurrentRoom?.type);
        }
      }
    } catch (err) {
      console.warn(`[VO NPC] Polling error for task ${taskId}:`, err);
    }
  };

  // Start polling
  voTaskPollingIntervals[taskId] = setInterval(poll, interval);

  // Initial immediate poll
  await poll();
}

// ─── Close Assign Task Modal ───
function voCloseAssignTaskModal() {
  const modal = document.getElementById('vo-assign-task-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// ─── Export para uso global ───
window.VO_NPC = {
  loadNpcs: voLoadNpcs,
  renderList: voRenderNpcList,
  showDetail: voShowNpcDetail,
  closeDetail: voCloseNpcDetail,
  showAssignTask: voShowAssignTaskModal,
  closeAssignTask: voCloseAssignTaskModal,
};
