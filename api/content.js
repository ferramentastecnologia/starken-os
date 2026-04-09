// =============================================================================
// Content Management API - Multiplexed Vercel Serverless Function
// Single POST endpoint with action-based routing
// =============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

const HEADERS_RETURN = {
  ...HEADERS,
  Prefer: 'return=representation',
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// =============================================================================
// Helpers
// =============================================================================

function ok(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function fail(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

async function supaSelect(table, query = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: HEADERS });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`SELECT ${table} failed: ${err}`);
  }
  return res.json();
}

async function supaInsert(table, record) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: HEADERS_RETURN,
    body: JSON.stringify(record),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`INSERT ${table} failed: ${err}`);
  }
  return res.json();
}

async function supaUpdate(table, id, updates) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: HEADERS_RETURN,
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`UPDATE ${table} failed: ${err}`);
  }
  return res.json();
}

async function supaDelete(table, id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'DELETE',
    headers: HEADERS,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DELETE ${table} failed: ${err}`);
  }
}

async function logActivity(task_id, actor, action, details = null) {
  await supaInsert('content_activity', {
    task_id,
    actor,
    action,
    details: details ? JSON.stringify(details) : null,
    created_at: new Date().toISOString(),
  });
}

// =============================================================================
// Group Actions
// =============================================================================

async function listGroups({ client_id }) {
  if (!client_id) return fail('client_id is required');

  const groups = await supaSelect(
    'content_groups',
    `select=*&client_id=eq.${client_id}&archived=eq.false&order=position.asc`
  );

  const tasks = await supaSelect(
    'content_tasks',
    `select=id,group_id&client_id=eq.${client_id}`
  );

  const countMap = {};
  for (const t of tasks) {
    countMap[t.group_id] = (countMap[t.group_id] || 0) + 1;
  }

  const result = groups.map((g) => ({
    ...g,
    task_count: countMap[g.id] || 0,
  }));

  return ok(result);
}

async function upsertGroup({ id, client_id, name, position, user }) {
  if (!client_id || !name) return fail('client_id and name are required');
  if (!user) return fail('user is required');

  const now = new Date().toISOString();

  if (id) {
    const data = await supaUpdate('content_groups', id, {
      name,
      ...(position !== undefined && { position }),
      updated_at: now,
    });
    return ok(data);
  }

  const data = await supaInsert('content_groups', {
    client_id,
    name,
    position: position ?? 0,
    created_by: user,
    created_at: now,
    updated_at: now,
    archived: false,
  });
  return ok(data);
}

async function deleteGroup({ id, user }) {
  if (!id) return fail('id is required');
  if (!user) return fail('user is required');

  const data = await supaUpdate('content_groups', id, {
    archived: true,
    updated_at: new Date().toISOString(),
  });
  return ok(data);
}

async function duplicateGroup({ source_group_id, target_client_id, new_name, user }) {
  if (!source_group_id) return fail('source_group_id is required');
  if (!target_client_id) return fail('target_client_id is required');
  if (!user) return fail('user is required');

  const now = new Date().toISOString();

  // Fetch source group
  const srcGroups = await supaSelect('content_groups', `select=*&id=eq.${source_group_id}`);
  if (!srcGroups.length) return fail('Source group not found', 404);
  const srcGroup = srcGroups[0];

  // Create new group
  const groupData = await supaInsert('content_groups', {
    client_id: target_client_id,
    name: new_name || srcGroup.name,
    position: 0,
    created_by: user,
    created_at: now,
    updated_at: now,
    archived: false,
  });
  const newGroupId = groupData[0]?.id || groupData.id;
  if (!newGroupId) return fail('Failed to create group');

  // Fetch all tasks from source group
  const allTasks = await supaSelect(
    'content_tasks',
    `select=*&group_id=eq.${source_group_id}&order=position.asc`
  );

  // Recursive copy: map old IDs to new IDs for parent_id references
  const idMap = {};
  let copiedCount = 0;

  // Sort: parents first (null parent_id), then children
  const sorted = allTasks.sort((a, b) => {
    if (!a.parent_id && b.parent_id) return -1;
    if (a.parent_id && !b.parent_id) return 1;
    return (a.position || 0) - (b.position || 0);
  });

  for (const task of sorted) {
    const newParentId = task.parent_id ? idMap[task.parent_id] : null;
    // Skip orphaned subtasks whose parent wasn't copied
    if (task.parent_id && !newParentId) continue;

    const record = {
      group_id: newGroupId,
      parent_id: newParentId || null,
      client_id: target_client_id,
      name: task.name,
      description: task.description || null,
      briefing: task.briefing || null,
      copy_text: task.copy_text || null,
      status: 'backlog',
      assignee: task.assignee || null,
      priority: task.priority || 'medium',
      due_date: null,
      position: task.position || 0,
      publish_config: null,
      created_by: user,
      created_at: now,
      updated_at: now,
    };

    const created = await supaInsert('content_tasks', record);
    const newId = created[0]?.id || created.id;
    if (newId) {
      idMap[task.id] = newId;
      copiedCount++;
    }
  }

  return ok({ group: groupData[0] || groupData, tasks_copied: copiedCount });
}

// =============================================================================
// Task Actions
// =============================================================================

async function listTasks({ group_id, client_id }) {
  if (!group_id && !client_id) return fail('group_id or client_id is required');

  const filter = group_id
    ? `group_id=eq.${group_id}`
    : `client_id=eq.${client_id}`;

  const tasks = await supaSelect(
    'content_tasks',
    `select=*&${filter}&order=position.asc`
  );

  const parentTasks = [];
  const childMap = {};

  for (const t of tasks) {
    if (t.parent_id) {
      if (!childMap[t.parent_id]) childMap[t.parent_id] = [];
      childMap[t.parent_id].push(t);
    } else {
      parentTasks.push(t);
    }
  }

  // Recursive nesting up to 5 levels
  function nestSubtasks(task, depth) {
    const children = childMap[task.id] || [];
    return {
      ...task,
      subtasks: depth < 5 ? children.map(c => nestSubtasks(c, depth + 1)) : children,
    };
  }

  const result = parentTasks.map(t => nestSubtasks(t, 0));

  return ok(result);
}

async function listMyTasks({ assignee }) {
  if (!assignee) return fail('assignee is required');

  // Get all tasks assigned to this user across all clients
  const tasks = await supaSelect(
    'content_tasks',
    `select=*,content_groups!inner(id,name,client_id)&assignee=eq.${encodeURIComponent(assignee)}&parent_id=is.null&order=due_date.asc.nullslast,created_at.desc`
  );

  // Flatten with group/client info
  const result = tasks.map(t => ({
    ...t,
    group_name: t.content_groups?.name || '',
    client_id: t.content_groups?.client_id || '',
    group_id: t.content_groups?.id || t.group_id,
    content_groups: undefined,
  }));

  return ok(result);
}

async function getTask({ id }) {
  if (!id) return fail('id is required');

  const [tasks, comments, attachments, activity] = await Promise.all([
    supaSelect('content_tasks', `select=*&id=eq.${id}`),
    supaSelect('content_comments', `select=*&task_id=eq.${id}&order=created_at.desc`),
    supaSelect('content_attachments', `select=*&task_id=eq.${id}&order=created_at.desc`),
    supaSelect('content_activity', `select=*&task_id=eq.${id}&order=created_at.desc&limit=50`),
  ]);

  if (!tasks.length) return fail('Task not found', 404);

  return ok({
    ...tasks[0],
    comments,
    attachments,
    activity,
  });
}

async function upsertTask(params) {
  const {
    id, group_id, parent_id, client_id, name, description,
    briefing, copy_text, status, assignee, priority,
    due_date, position, publish_config, user,
  } = params;

  if (!user) return fail('user is required');
  const now = new Date().toISOString();

  if (id) {
    // Fetch current task for activity logging
    const existing = await supaSelect('content_tasks', `select=status&id=eq.${id}`);
    const oldStatus = existing.length ? existing[0].status : null;

    const updates = {
      ...(group_id !== undefined && { group_id }),
      ...(parent_id !== undefined && { parent_id }),
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(briefing !== undefined && { briefing }),
      ...(copy_text !== undefined && { copy_text }),
      ...(status !== undefined && { status }),
      ...(assignee !== undefined && { assignee }),
      ...(priority !== undefined && { priority }),
      ...(due_date !== undefined && { due_date }),
      ...(position !== undefined && { position }),
      ...(publish_config !== undefined && { publish_config }),
      updated_at: now,
    };

    const data = await supaUpdate('content_tasks', id, updates);

    if (status !== undefined && status !== oldStatus) {
      await logActivity(id, user, 'status_changed', {
        old_status: oldStatus,
        new_status: status,
      });
    }

    // Cascade priority to child tasks
    if (priority !== undefined) {
      const children = await supaSelect('content_tasks', `select=id&parent_id=eq.${id}`);
      if (children.length) {
        await Promise.all(children.map(c =>
          supaUpdate('content_tasks', c.id, { priority, updated_at: now })
        ));
      }
    }

    return ok(data);
  }

  if (!group_id || !client_id || !name) {
    return fail('group_id, client_id, and name are required for new tasks');
  }

  // Calculate next position (add to bottom)
  let nextPos = 0;
  if (position === undefined || position === null) {
    const existing = await supaSelect('content_tasks',
      `select=position&group_id=eq.${group_id}&parent_id=${parent_id ? 'eq.' + parent_id : 'is.null'}&order=position.desc&limit=1`
    );
    nextPos = existing.length ? (existing[0].position || 0) + 1 : 0;
  }

  const record = {
    group_id,
    parent_id: parent_id || null,
    client_id,
    name,
    description: description || null,
    briefing: briefing || null,
    copy_text: copy_text || null,
    status: status || 'backlog',
    assignee: assignee || null,
    priority: priority || 'medium',
    due_date: due_date || null,
    position: position ?? nextPos,
    publish_config: publish_config || null,
    created_by: user,
    created_at: now,
    updated_at: now,
  };

  const data = await supaInsert('content_tasks', record);

  if (data.length) {
    await logActivity(data[0].id, user, 'task_created', { name });
  }

  return ok(data);
}

async function deleteTask({ id, user }) {
  if (!id) return fail('id is required');
  if (!user) return fail('user is required');

  // Delete subtasks recursively first (up to 5 levels)
  async function deleteChildren(parentId) {
    const children = await supaSelect('content_tasks', `select=id&parent_id=eq.${parentId}`);
    for (const child of children) {
      await deleteChildren(child.id);
      await supaDelete('content_tasks', child.id);
    }
  }
  await deleteChildren(id);

  // Delete related data
  await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/content_comments?task_id=eq.${id}`, { method: 'DELETE', headers: HEADERS }),
    fetch(`${SUPABASE_URL}/rest/v1/content_attachments?task_id=eq.${id}`, { method: 'DELETE', headers: HEADERS }),
    fetch(`${SUPABASE_URL}/rest/v1/content_activity?task_id=eq.${id}`, { method: 'DELETE', headers: HEADERS }),
  ]).catch(() => {});

  await supaDelete('content_tasks', id);
  return ok({ deleted: true });
}

async function changeStatus({ id, status, user }) {
  if (!id || !status) return fail('id and status are required');
  if (!user) return fail('user is required');

  const existing = await supaSelect('content_tasks', `select=status&id=eq.${id}`);
  if (!existing.length) return fail('Task not found', 404);

  const oldStatus = existing[0].status;

  const data = await supaUpdate('content_tasks', id, {
    status,
    updated_at: new Date().toISOString(),
  });

  await logActivity(id, user, 'status_changed', {
    old_status: oldStatus,
    new_status: status,
  });

  return ok(data);
}

async function reorder({ items, user }) {
  if (!items || !Array.isArray(items)) return fail('items array is required');
  if (!user) return fail('user is required');

  const results = await Promise.all(
    items.map(({ id, position }) =>
      supaUpdate('content_tasks', id, { position, updated_at: new Date().toISOString() })
    )
  );

  return ok({ updated: results.length });
}

// =============================================================================
// Comment Actions
// =============================================================================

async function addComment({ task_id, body, user }) {
  if (!task_id || !body) return fail('task_id and body are required');
  if (!user) return fail('user is required');

  const data = await supaInsert('content_comments', {
    task_id,
    author: user,
    body,
    created_at: new Date().toISOString(),
  });

  await logActivity(task_id, user, 'comment_added', {
    preview: body.substring(0, 100),
  });

  return ok(data);
}

async function listComments({ task_id }) {
  if (!task_id) return fail('task_id is required');

  const data = await supaSelect(
    'content_comments',
    `select=*&task_id=eq.${task_id}&order=created_at.desc`
  );
  return ok(data);
}

// =============================================================================
// Attachment Actions
// =============================================================================

async function addAttachment({ task_id, file_name, file_url, file_type, file_size, category, format_type, user }) {
  if (!task_id || !file_name || !file_url) {
    return fail('task_id, file_name, and file_url are required');
  }
  if (!user) return fail('user is required');

  const data = await supaInsert('content_attachments', {
    task_id,
    file_name,
    file_url,
    file_type: file_type || null,
    file_size: file_size || null,
    category: category || null,
    format_type: format_type || 'feed',
    uploaded_by: user,
    created_at: new Date().toISOString(),
  });

  await logActivity(task_id, user, 'attachment_added', {
    file_name,
    category: category || null,
  });

  return ok(data);
}

async function deleteAttachment({ id, user }) {
  if (!id) return fail('id is required');
  if (!user) return fail('user is required');

  await supaDelete('content_attachments', id);
  return ok({ deleted: true });
}

async function listAttachments({ task_id }) {
  if (!task_id) return fail('task_id is required');

  const data = await supaSelect(
    'content_attachments',
    `select=*&task_id=eq.${task_id}&order=created_at.desc`
  );
  return ok(data);
}

// =============================================================================
// Client Info Actions
// =============================================================================

async function getClientInfo({ client_slug }) {
  if (!client_slug) return fail('client_slug is required');

  const data = await supaSelect(
    'client_info',
    `select=*&client_slug=eq.${client_slug}&limit=1`
  );

  return ok(data.length ? data[0] : {});
}

async function saveClientInfo({
  client_slug, client_name, tone_of_voice, persona,
  keywords, forbidden_words, copy_examples, observations, user,
}) {
  if (!client_slug) return fail('client_slug is required');
  if (!user) return fail('user is required');

  const now = new Date().toISOString();

  const record = {
    client_slug,
    ...(client_name !== undefined && { client_name }),
    ...(tone_of_voice !== undefined && { tone_of_voice }),
    ...(persona !== undefined && { persona }),
    ...(keywords !== undefined && { keywords }),
    ...(forbidden_words !== undefined && { forbidden_words }),
    ...(copy_examples !== undefined && { copy_examples }),
    ...(observations !== undefined && { observations }),
    updated_at: now,
    updated_by: user,
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/client_info`, {
    method: 'POST',
    headers: {
      ...HEADERS_RETURN,
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(record),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`UPSERT client_info failed: ${err}`);
  }

  const data = await res.json();
  return ok({ success: true, data: data.length ? data[0] : data });
}

// =============================================================================
// Activity Actions
// =============================================================================

async function listActivity({ task_id, limit }) {
  if (!task_id) return fail('task_id is required');

  const cap = Math.min(limit || 50, 200);
  const data = await supaSelect(
    'content_activity',
    `select=*&task_id=eq.${task_id}&order=created_at.desc&limit=${cap}`
  );

  const parsed = data.map((row) => ({
    ...row,
    details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
  }));

  return ok(parsed);
}

// =============================================================================
// Admin - Create User
// =============================================================================

async function adminCreateUser({ user_name, password, user_role, avatar_color }) {
  if (!user_name || !password) return fail('user_name and password required');

  // Insert into admin_secrets (login credentials) - check if already exists first
  const secretLabel = `Login ${user_name}`;
  const existing = await supaSelect('admin_secrets', `label=eq.${encodeURIComponent(secretLabel)}&select=id`);
  if (!existing || existing.length === 0) {
    await supaInsert('admin_secrets', { label: secretLabel, value: password });
  }

  // Try inserting into users table with all possible column name combos
  const combos = [
    { name: user_name, role: user_role || 'designer', avatar_color: avatar_color || '#ec4899' },
    { user_name, user_role: user_role || 'designer', avatar_color: avatar_color || '#ec4899' },
    { name: user_name, role: user_role || 'designer', color: avatar_color || '#ec4899' },
  ];

  let userResult = null;
  let lastErr = null;
  for (const userData of combos) {
    try {
      userResult = await supaInsert('users', userData);
      break;
    } catch (e) {
      lastErr = e.message;
      continue;
    }
  }

  return ok({ success: true, user: userResult, usersError: lastErr, note: 'admin_secrets OK' });
}

async function adminUpdateUser({ user_name, user_role }) {
  if (!user_name || !user_role) return fail('user_name and user_role required');

  const combos = [
    { filter: `name=eq.${encodeURIComponent(user_name)}`, body: { role: user_role } },
    { filter: `user_name=eq.${encodeURIComponent(user_name)}`, body: { user_role } },
  ];

  let result = null;
  for (const c of combos) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/users?${c.filter}`, {
        method: 'PATCH',
        headers: HEADERS_RETURN,
        body: JSON.stringify(c.body),
      });
      const data = await res.json();
      if (!data.code) { result = data; break; }
    } catch(e) { continue; }
  }

  return ok({ success: true, updated: result });
}

// =============================================================================
// Virtual Office Actions
// =============================================================================

// ─── VO: List Offices ───
async function voListOffices(params) {
  try {
    const { building_id } = params;
    let query = '';
    if (building_id) {
      query = `building_id=eq.${building_id}`;
    }
    const offices = await supaSelect('virtual_offices', query);
    return ok({ offices, total: offices.length });
  } catch (err) {
    return fail(err.message, 500);
  }
}

// ─── VO: List NPCs ───
async function voListNpcs(params) {
  try {
    const { office_id, room_id, status } = params;
    let query = '';
    if (office_id) {
      query += `office_id=eq.${office_id}`;
    }
    if (room_id) {
      query += (query ? '&' : '') + `room_id=eq.${room_id}`;
    }
    if (status) {
      query += (query ? '&' : '') + `status=eq.${status}`;
    }
    const npcs = await supaSelect('virtual_npcs', query);
    return ok({ npcs, total: npcs.length });
  } catch (err) {
    return fail(err.message, 500);
  }
}

// ─── VO: Create Task ───
async function voCreateTask(params) {
  try {
    const {
      office_id,
      room_id,
      npc_id,
      task_type,
      task_name,
      task_description,
      task_content,
      priority = 'normal',
      created_by,
    } = params;

    if (!office_id || !room_id || !task_type || !task_name) {
      return fail('office_id, room_id, task_type, task_name são obrigatórios', 400);
    }

    const task = await supaInsert('virtual_npc_tasks', {
      office_id,
      room_id,
      npc_id: npc_id || null,
      task_type,
      task_name,
      task_description: task_description || null,
      task_content: task_content ? JSON.stringify(task_content) : null,
      priority,
      status: 'pending',
      created_by: created_by || 'system',
      assigned_at: new Date().toISOString(),
    });

    // Log activity
    await supaInsert('virtual_activity_log', {
      office_id,
      room_id,
      npc_id: npc_id || null,
      action: 'task_created',
      action_type: 'task_management',
      entity_id: task[0]?.id,
      details: JSON.stringify({ task_type, task_name }),
      severity: 'info',
      created_at: new Date().toISOString(),
    });

    return ok({ task: task[0], message: 'Tarefa criada com sucesso' });
  } catch (err) {
    return fail(err.message, 500);
  }
}

// ─── VO: Get Reports ───
async function voGetReports(params) {
  try {
    const { office_id, leader_name, report_date, period_type = 'daily' } = params;
    let query = '';

    if (office_id) {
      query += `office_id=eq.${office_id}`;
    }
    if (leader_name) {
      query += (query ? '&' : '') + `leader_name=eq.${leader_name}`;
    }
    if (report_date) {
      query += (query ? '&' : '') + `report_date=eq.${report_date}`;
    }

    // Ordenar por data decrescente
    query += (query ? '&' : '') + 'order=report_date.desc';

    const reports = await supaSelect('virtual_squad_reports', query);

    return ok({
      reports,
      total: reports.length,
      period_type,
    });
  } catch (err) {
    return fail(err.message, 500);
  }
}

// ─── VO: CEO Dashboard ───
async function voCeoDashboard(params) {
  try {
    const { npc_central_id, report_period, period_type = 'daily' } = params;

    if (!npc_central_id) {
      return fail('npc_central_id é obrigatório', 400);
    }

    // Buscar dashboard consolidado
    let query = `npc_central_id=eq.${npc_central_id}`;
    if (report_period) {
      query += `&report_period=eq.${report_period}`;
    }
    query += '&order=report_period.desc&limit=1';

    const dashboard = await supaSelect('virtual_ceo_dashboard', query);

    if (!dashboard.length) {
      // Se não existir, calcular
      const offices = await supaSelect('virtual_offices', 'is_active=eq.true');
      const npcs = await supaSelect('virtual_npcs', 'status=neq.offline');
      const tasks = await supaSelect(
        'virtual_npc_tasks',
        'status=in.(pending,in_progress)'
      );
      const reports = await supaSelect('virtual_squad_reports', `report_date=eq.${report_period}`);

      const aggregated = {
        npc_central_id,
        report_period: report_period || new Date().toISOString().split('T')[0],
        period_type,
        total_clients: offices.length,
        total_offices: offices.length,
        total_rooms: 0,
        total_npcs_active: npcs.length,
        total_tasks_completed: 0,
        total_tasks_pending: tasks.length,
        total_tasks_failed: 0,
        avg_performance_score: Math.round(
          reports.reduce((sum, r) => sum + (r.performance_score || 0), 0) /
            (reports.length || 1)
        ),
        strategic_insights: `Período: ${period_type}. Clientes ativos: ${offices.length}. NPCs online: ${npcs.length}.`,
        alerts: [],
      };

      return ok({
        dashboard: aggregated,
        cached: false,
        message: 'Dashboard calculado em tempo real',
      });
    }

    return ok({
      dashboard: dashboard[0],
      cached: true,
      message: 'Dashboard carregado do cache',
    });
  } catch (err) {
    return fail(err.message, 500);
  }
}

// =============================================================================
// Action Router
// =============================================================================

const ACTIONS = {
  // Groups
  list_groups: listGroups,
  upsert_group: upsertGroup,
  delete_group: deleteGroup,
  duplicate_group: duplicateGroup,
  // Tasks
  list_tasks: listTasks,
  list_my_tasks: listMyTasks,
  get_task: getTask,
  upsert_task: upsertTask,
  delete_task: deleteTask,
  change_status: changeStatus,
  reorder,
  // Comments
  add_comment: addComment,
  list_comments: listComments,
  // Attachments
  add_attachment: addAttachment,
  delete_attachment: deleteAttachment,
  list_attachments: listAttachments,
  // Activity
  list_activity: listActivity,
  // Client Info
  get_client_info: getClientInfo,
  save_client_info: saveClientInfo,
  // Admin
  admin_create_user: adminCreateUser,
  admin_update_user: adminUpdateUser,
  // Virtual Office
  vo_list_offices: voListOffices,
  vo_list_npcs: voListNpcs,
  vo_create_task: voCreateTask,
  vo_get_reports: voGetReports,
  vo_ceo_dashboard: voCeoDashboard,
};

// =============================================================================
// Main Handler
// =============================================================================

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  let action, params;

  if (req.method === 'GET') {
    const q = req.query || {};
    action = q.action;
    params = { ...q };
    delete params.action;
  } else if (req.method === 'POST') {
    const body = req.body || {};
    action = body.action;
    params = { ...body };
    delete params.action;
  } else {
    return res.status(405).json({ error: 'Use GET ou POST' });
  }

  if (!action) return res.status(400).json({ error: 'Campo "action" obrigatório' });

  const handler_fn = ACTIONS[action];
  if (!handler_fn) return res.status(400).json({ error: `Action desconhecida: ${action}` });

  try {
    const response = await handler_fn(params);
    // Response is a Web Response object — extract body and status
    const body = await response.json();
    return res.status(response.status).json(body);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erro interno' });
  }
};
