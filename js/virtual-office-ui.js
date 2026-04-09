/**
 * Virtual Office UI - Main Manager
 * Gerencia escritórios, salas e exibição geral
 */

// ─── State ───
let voCurrentOffice = null;
let voCurrentRoom = null;
let voOffices = [];
let voRooms = [];

// ─── API Call Helper ───
async function voApiCall(action, params) {
  try {
    const response = await fetch('/api/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...params }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API Error');
    }

    return await response.json();
  } catch (err) {
    console.error(`[VO API] Error: ${err.message}`);
    throw err;
  }
}

// ─── Load Offices ───
async function voLoadOffices(buildingId = null) {
  try {
    const params = buildingId ? { building_id: buildingId } : {};
    const result = await voApiCall('vo_list_offices', params);
    voOffices = result.offices || [];
    return voOffices;
  } catch (err) {
    console.error('[VO] Failed to load offices:', err);
    return [];
  }
}

// ─── Select Office ───
async function voSelectOffice(officeId) {
  const office = voOffices.find(o => o.id === officeId);
  if (!office) return false;

  voCurrentOffice = office;
  voCurrentRoom = null;

  // Atualizar UI
  await voRenderOfficeHeader();
  await voRenderRooms();
  return true;
}

// ─── Render Office Header ───
async function voRenderOfficeHeader() {
  const container = document.getElementById('vo-office-header');
  if (!container || !voCurrentOffice) return;

  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:16px;background:var(--bg-surface);border:1px solid var(--border);border-radius:8px">
      <div>
        <h2 style="margin:0;font-size:1.5rem;color:var(--text-primary)">${voCurrentOffice.client_name}</h2>
        <p style="margin:4px 0 0;color:var(--text-secondary);font-size:0.85rem">${voCurrentOffice.office_name || 'Escritório Principal'}</p>
        <p style="margin:4px 0 0;color:var(--text-tertiary);font-size:0.8rem">Líder: ${voCurrentOffice.leader_user || '—'}</p>
      </div>
      <div style="text-align:right">
        <span style="display:inline-block;padding:4px 8px;background:${voCurrentOffice.is_active ? 'var(--color-success-bg)' : 'var(--border-subtle)'};color:${voCurrentOffice.is_active ? 'var(--color-success)' : 'var(--text-muted)'};border-radius:4px;font-size:0.75rem;font-weight:600">
          ${voCurrentOffice.is_active ? '🟢 ATIVO' : '⚪ INATIVO'}
        </span>
      </div>
    </div>
  `;
}

// ─── Render Rooms ───
async function voRenderRooms() {
  const container = document.getElementById('vo-rooms-container');
  if (!container || !voCurrentOffice) return;

  try {
    // Para simplicidade, renderizar placeholders
    // Em produção, teria que buscar as salas do DB
    const roomTypes = ['design', 'content', 'publishing', 'analytics'];
    const roomNames = {
      design: '🎨 Sala de Design',
      content: '✍️ Sala de Conteúdo',
      publishing: '📱 Sala de Publicação',
      analytics: '📊 Sala de Analytics',
    };

    let html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px;margin-top:16px">';

    for (const type of roomTypes) {
      html += `
        <div
          class="vo-room-card"
          onclick="voSelectRoom('${type}')"
          style="cursor:pointer;padding:16px;background:var(--bg-surface);border:2px solid var(--border);border-radius:8px;transition:all 0.2s"
          onmouseover="this.style.borderColor='var(--brand)';this.style.boxShadow='0 4px 12px rgba(42,77,215,0.15)'"
          onmouseout="this.style.borderColor='var(--border)';this.style.boxShadow='none'"
        >
          <div style="font-size:1.5rem;margin-bottom:8px">${roomNames[type].split(' ')[0]}</div>
          <div style="font-weight:600;margin-bottom:8px;color:var(--text-primary)">${roomNames[type]}</div>
          <div style="font-size:0.85rem;color:var(--text-secondary)">
            <div>👥 NPCs: <span id="npc-count-${type}">—</span></div>
            <div>📋 Tarefas: <span id="task-count-${type}">—</span></div>
          </div>
        </div>
      `;
    }

    html += '</div>';
    container.innerHTML = html;

    // Carregar contagens
    await voLoadRoomCounts();
  } catch (err) {
    console.error('[VO] Failed to render rooms:', err);
  }
}

// ─── Load Room Counts ───
async function voLoadRoomCounts() {
  // Implementar busca de contagens por sala
  // Por enquanto, deixar como placeholder
}

// ─── Select Room ───
async function voSelectRoom(roomType) {
  if (!voCurrentOffice) return;

  voCurrentRoom = {
    type: roomType,
    office_id: voCurrentOffice.id,
  };

  // Chamar renderizador de NPCs
  if (typeof voRenderNpcList === 'function') {
    await voRenderNpcList(voCurrentOffice.id, roomType);
  }
}

// ─── Create Task ───
async function voCreateTaskInRoom(roomType, taskType, taskName) {
  if (!voCurrentOffice) {
    alert('Selecione um escritório primeiro');
    return;
  }

  try {
    const result = await voApiCall('vo_create_task', {
      office_id: voCurrentOffice.id,
      room_id: voCurrentOffice.id, // Simplificado para demo
      task_type: taskType,
      task_name: taskName,
      priority: 'normal',
      created_by: gpState?.user || 'system',
    });

    console.log('[VO] Task created:', result);

    // Atualizar UI
    if (typeof voRenderNpcList === 'function') {
      await voRenderNpcList(voCurrentOffice.id, roomType);
    }

    return result;
  } catch (err) {
    alert(`Erro ao criar tarefa: ${err.message}`);
  }
}

// ─── Initialize ───
async function voInit() {
  console.log('[VO] Initializing Virtual Office...');

  try {
    // Carregar primeira edificação (Starken)
    const offices = await voLoadOffices();

    if (offices.length === 0) {
      console.log('[VO] No offices found');
      return;
    }

    // Selecionar primeiro escritório
    await voSelectOffice(offices[0].id);

    console.log('[VO] Initialized successfully');
  } catch (err) {
    console.error('[VO] Initialization failed:', err);
  }
}

// ─── Export para uso global ───
window.VO = {
  init: voInit,
  loadOffices: voLoadOffices,
  selectOffice: voSelectOffice,
  selectRoom: voSelectRoom,
  createTask: voCreateTaskInRoom,
  apiCall: voApiCall,
};
