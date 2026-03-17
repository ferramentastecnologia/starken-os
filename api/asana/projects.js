/**
 * GET /api/asana/projects
 * Lista projetos do workspace configurado no Asana.
 *
 * Query params:
 *   workspace (required) — Workspace GID
 */

const ASANA_BASE = 'https://app.asana.com/api/1.0';

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.ASANA_PAT;
  if (!token) {
    return res.status(500).json({ error: 'ASANA_PAT not configured' });
  }

  const workspace = req.query.workspace;
  if (!workspace) {
    return res.status(400).json({ error: 'workspace query param required' });
  }

  try {
    const url = `${ASANA_BASE}/projects?workspace=${workspace}&opt_fields=name,color,archived,created_at,modified_at,notes,owner.name&limit=100&archived=false`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
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
};
