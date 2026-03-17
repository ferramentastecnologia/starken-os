/**
 * /api/asana/config — Configuração do Asana
 *
 * GET  — Retorna configuração atual (workspace, mapeamento)
 * POST — Salva configuração
 *
 * A configuração é armazenada no Supabase na tabela asana_config,
 * ou localmente via JSON se Supabase não estiver disponível.
 */

const ASANA_BASE = 'https://app.asana.com/api/1.0';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.ASANA_PAT;
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';

  // ─── GET: Retorna config + valida token ───────────────────
  if (req.method === 'GET') {
    const result = {
      connected: !!token,
      workspace: null,
      user: null,
      config: null,
    };

    // Validate token by fetching user info
    if (token) {
      try {
        const meRes = await fetch(`${ASANA_BASE}/users/me?opt_fields=name,email,workspaces.name`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (meRes.ok) {
          const me = await meRes.json();
          result.user = { name: me.data.name, email: me.data.email };
          result.workspaces = (me.data.workspaces || []).map(w => ({ gid: w.gid, name: w.name }));
        } else {
          result.connected = false;
          result.error = 'Token inválido';
        }
      } catch (e) {
        result.connected = false;
        result.error = e.message;
      }
    }

    // Try to read config from Supabase
    if (supabaseUrl && supabaseKey) {
      try {
        const cfgRes = await fetch(
          `${supabaseUrl}/rest/v1/asana_config?id=eq.default&select=*`,
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
          }
        );
        if (cfgRes.ok) {
          const rows = await cfgRes.json();
          if (rows.length > 0) result.config = rows[0];
        }
      } catch (e) {
        // Config não disponível — ok, frontend vai usar defaults
      }
    }

    return res.status(200).json(result);
  }

  // ─── POST: Salva config ───────────────────────────────────
  if (req.method === 'POST') {
    const { workspace_gid, default_assignee_gid, default_project_gid, client_project_map } = req.body || {};

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase not configured on server' });
    }

    const configData = {
      id: 'default',
      workspace_gid: workspace_gid || null,
      default_assignee_gid: default_assignee_gid || null,
      default_project_gid: default_project_gid || null,
      client_project_map: client_project_map || {},
      updated_at: new Date().toISOString(),
    };

    try {
      const upsertRes = await fetch(
        `${supabaseUrl}/rest/v1/asana_config`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates',
          },
          body: JSON.stringify(configData),
        }
      );

      if (!upsertRes.ok) {
        const err = await upsertRes.text();
        return res.status(500).json({ error: 'Failed to save config', details: err });
      }

      return res.status(200).json({ ok: true, config: configData });
    } catch (e) {
      return res.status(500).json({ error: 'Internal error', message: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
