/**
 * DeskRPG Bridge - Phase 5A
 *
 * Communicates with DeskRPG API to:
 * - Create channels for client offices
 * - Create NPCs for virtual agents
 * - Assign tasks to NPCs
 * - Sync NPC status back to Starken OS
 * - Receive task completion callbacks
 *
 * Configuration via environment variables:
 * - DESKRPG_BASE_URL: DeskRPG API base URL (e.g., http://localhost:3000 or http://deskrpg:3000)
 * - DESKRPG_AUTH_TOKEN: Authentication token (if required)
 * - DESKRPG_AUTH_TYPE: 'bearer' | 'apikey' | 'none' (default: none)
 * - DESKRPG_WEBHOOK_URL: URL for DeskRPG to callback (e.g., https://starken-os.vercel.app/api/deskrpg-webhook)
 */

const BASE_URL = process.env.DESKRPG_BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = process.env.DESKRPG_AUTH_TOKEN || null;
const AUTH_TYPE = process.env.DESKRPG_AUTH_TYPE || 'none'; // 'bearer' | 'apikey' | 'none'
const WEBHOOK_URL = process.env.DESKRPG_WEBHOOK_URL || 'http://localhost:7001/api/deskrpg-webhook';

/**
 * Helper: Build headers with authentication
 */
function buildHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    'x-user-id': 'starken-os-bridge', // DeskRPG expects x-user-id header
  };

  if (AUTH_TOKEN && AUTH_TYPE === 'bearer') {
    headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
  } else if (AUTH_TOKEN && AUTH_TYPE === 'apikey') {
    headers['X-API-Key'] = AUTH_TOKEN;
  }

  return headers;
}

/**
 * Helper: Make HTTP request to DeskRPG
 */
async function deskrpgFetch(method, path, body = null) {
  const url = `${BASE_URL}${path}`;
  const options = {
    method,
    headers: buildHeaders(),
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      console.error(`[DeskRPG] ${method} ${path} failed:`, response.status, data);
      return { success: false, status: response.status, error: data };
    }

    return { success: true, status: response.status, data };
  } catch (err) {
    console.error(`[DeskRPG] ${method} ${path} error:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Phase 5A.1: Create a channel in DeskRPG for a client office
 *
 * Maps: Starken Client Office → DeskRPG Channel
 *
 * @param {string} clientId - Starken client ID (e.g., "cliente-001")
 * @param {string} clientName - Starken client name (e.g., "Empresa XYZ")
 * @returns {Promise<object>} { success, channelId, channel }
 */
async function deskrpgCreateChannel(clientId, clientName) {
  console.log(`[DeskRPG] Creating channel for client: ${clientId} (${clientName})`);

  const body = {
    name: clientName,
    description: `Office channel for Starken client: ${clientId}`,
    // DeskRPG may accept additional metadata
    metadata: {
      starkenClientId: clientId,
      createdAt: new Date().toISOString(),
      source: 'starken-os-bridge',
    },
  };

  const result = await deskrpgFetch('POST', '/api/channels', body);

  if (result.success && result.data) {
    const channelId = result.data.id || result.data.channelId;
    console.log(`[DeskRPG] Channel created: ${channelId}`);
    return { success: true, channelId, channel: result.data };
  }

  return { success: false, error: result.error };
}

/**
 * Phase 5A.2: Create an NPC in DeskRPG within a channel
 *
 * Maps: Starken Virtual NPC → DeskRPG NPC
 *
 * @param {string} channelId - DeskRPG channel ID
 * @param {string} npcName - NPC name (e.g., "Designer Bot")
 * @param {object} options - { persona, agentId, appearance, positionX, positionY, direction }
 * @returns {Promise<object>} { success, npcId, npc }
 */
async function deskrpgCreateNpc(channelId, npcName, options = {}) {
  console.log(`[DeskRPG] Creating NPC: ${npcName} in channel ${channelId}`);

  const body = {
    channelId,
    name: npcName,
    persona: options.persona || '',
    appearance: options.appearance || {},
    positionX: options.positionX || 10,
    positionY: options.positionY || 10,
    direction: options.direction || 'down',
    // If agentId provided, link to existing OpenClaw agent
    ...(options.agentId && { agentId: options.agentId, agentAction: 'select' }),
  };

  const result = await deskrpgFetch('POST', '/api/npcs', body);

  if (result.success && result.data) {
    const npcId = result.data.id;
    console.log(`[DeskRPG] NPC created: ${npcId}`);
    return { success: true, npcId, npc: result.data };
  }

  return { success: false, error: result.error };
}

/**
 * Phase 5A.3: Create and assign a task to an NPC in DeskRPG
 *
 * Maps: Starken Virtual Task → DeskRPG Task
 *
 * @param {string} channelId - DeskRPG channel ID
 * @param {string} npcId - DeskRPG NPC ID
 * @param {string} title - Task title
 * @param {string} summary - Task description
 * @param {object} metadata - Additional metadata (starkenTaskId, etc)
 * @returns {Promise<object>} { success, taskId, task }
 */
async function deskrpgCreateTask(channelId, npcId, title, summary, metadata = {}) {
  console.log(`[DeskRPG] Creating task: "${title}" for NPC ${npcId} in channel ${channelId}`);

  const body = {
    channelId,
    npcId,
    title: title.slice(0, 200),
    summary: summary ? summary.slice(0, 1000) : '',
    // Additional fields for callback tracking
    metadata: {
      webhookUrl: WEBHOOK_URL,
      ...metadata,
    },
  };

  const result = await deskrpgFetch('POST', '/api/tasks', body);

  if (result.success && result.data) {
    const taskId = result.data.id;
    console.log(`[DeskRPG] Task created: ${taskId}`);
    return { success: true, taskId, task: result.data };
  }

  return { success: false, error: result.error };
}

/**
 * Phase 5A.4: Get NPC status from DeskRPG
 *
 * Fetches current status of an NPC (online/offline, tasks running, etc)
 *
 * @param {string} npcId - DeskRPG NPC ID
 * @returns {Promise<object>} { success, npc }
 */
async function deskrpgGetNpcStatus(npcId) {
  const result = await deskrpgFetch('GET', `/api/npcs/${npcId}`);

  if (result.success && result.data) {
    return { success: true, npc: result.data };
  }

  return { success: false, error: result.error };
}

/**
 * Phase 5A.5: Get task result from DeskRPG
 *
 * Fetches task completion status and result from DeskRPG
 *
 * @param {string} taskId - DeskRPG task ID
 * @returns {Promise<object>} { success, task }
 */
async function deskrpgGetTaskResult(taskId) {
  // DeskRPG tasks endpoint might list or need specific ID endpoint
  // Adjust based on actual API structure
  const result = await deskrpgFetch('GET', `/api/tasks/${taskId}`);

  if (result.success && result.data) {
    return { success: true, task: result.data };
  }

  return { success: false, error: result.error };
}

/**
 * Health check: Verify DeskRPG is reachable
 */
async function deskrpgHealthCheck() {
  console.log(`[DeskRPG] Health check: ${BASE_URL}`);

  try {
    const response = await fetch(`${BASE_URL}/api/npcs`, {
      method: 'GET',
      headers: buildHeaders(),
    });

    return response.ok;
  } catch (err) {
    console.error(`[DeskRPG] Health check failed: ${err.message}`);
    return false;
  }
}

module.exports = {
  // Core bridge functions
  deskrpgCreateChannel,
  deskrpgCreateNpc,
  deskrpgCreateTask,
  deskrpgGetNpcStatus,
  deskrpgGetTaskResult,
  // Utilities
  deskrpgHealthCheck,
  // Config (for debugging)
  getConfig: () => ({ BASE_URL, AUTH_TYPE, WEBHOOK_URL }),
};
