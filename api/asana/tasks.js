/**
 * /api/asana/tasks — CRUD de tarefas no Asana
 *
 * GET  — Lista tarefas de um projeto (ou workspace)
 *   Query: project (required), section (optional), completed (optional, default "false")
 *
 * POST — Cria uma tarefa
 *   Body: { name, project, section, assignee, due_on, notes, tags[] }
 *
 * PUT  — Atualiza uma tarefa
 *   Body: { task_gid, completed, name, due_on, notes }
 */

const ASANA_BASE = 'https://app.asana.com/api/1.0';

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.ASANA_PAT;
  if (!token) {
    return res.status(500).json({ error: 'ASANA_PAT not configured' });
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // ─── GET: Lista tarefas ───────────────────────────────────
  if (req.method === 'GET') {
    const project = req.query.project;
    const section = req.query.section;
    const completed = req.query.completed || 'false';
    const assignee = req.query.assignee;

    if (!project && !section) {
      return res.status(400).json({ error: 'project or section query param required' });
    }

    try {
      const optFields = 'name,completed,completed_at,due_on,due_at,assignee.name,notes,created_at,modified_at,memberships.project.name,memberships.section.name,tags.name,custom_fields';

      let url;
      if (section) {
        url = `${ASANA_BASE}/sections/${section}/tasks?opt_fields=${optFields}&completed_since=${completed === 'true' ? '' : 'now'}&limit=100`;
      } else {
        url = `${ASANA_BASE}/tasks?project=${project}&opt_fields=${optFields}&completed_since=${completed === 'true' ? '' : 'now'}&limit=100`;
      }

      // For listing incomplete tasks, use completed_since=now trick
      // For listing all tasks, remove the filter
      if (completed === 'all') {
        url = `${ASANA_BASE}/tasks?project=${project}&opt_fields=${optFields}&limit=100`;
      }

      const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return res.status(response.status).json({ error: 'Asana API error', details: err });
      }

      const data = await response.json();

      // Filter by assignee client-side if needed
      if (assignee && data.data) {
        data.data = data.data.filter(t => t.assignee && t.assignee.gid === assignee);
      }

      return res.status(200).json(data);
    } catch (e) {
      return res.status(500).json({ error: 'Internal error', message: e.message });
    }
  }

  // ─── POST: Cria tarefa ────────────────────────────────────
  if (req.method === 'POST') {
    const { name, project, section, assignee, due_on, notes, tags } = req.body || {};

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (!project) {
      return res.status(400).json({ error: 'project is required' });
    }

    const taskData = {
      name,
      notes: notes || '',
    };

    // Assign to project + section via memberships
    if (section) {
      taskData.memberships = [{ project, section }];
    } else {
      taskData.projects = [project];
    }

    if (assignee) taskData.assignee = assignee;
    if (due_on) taskData.due_on = due_on;

    try {
      const response = await fetch(`${ASANA_BASE}/tasks`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ data: taskData }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return res.status(response.status).json({ error: 'Asana API error', details: err });
      }

      const data = await response.json();
      return res.status(201).json(data);
    } catch (e) {
      return res.status(500).json({ error: 'Internal error', message: e.message });
    }
  }

  // ─── PUT: Atualiza tarefa ─────────────────────────────────
  if (req.method === 'PUT') {
    const { task_gid, completed, name, due_on, notes } = req.body || {};

    if (!task_gid) {
      return res.status(400).json({ error: 'task_gid is required' });
    }

    const updateData = {};
    if (typeof completed === 'boolean') updateData.completed = completed;
    if (name) updateData.name = name;
    if (due_on) updateData.due_on = due_on;
    if (typeof notes === 'string') updateData.notes = notes;

    try {
      const response = await fetch(`${ASANA_BASE}/tasks/${task_gid}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ data: updateData }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return res.status(response.status).json({ error: 'Asana API error', details: err });
      }

      const data = await response.json();
      return res.status(200).json(data);
    } catch (e) {
      return res.status(500).json({ error: 'Internal error', message: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
