/**
 * /api/asana/provision.js
 *
 * Provisiona um novo cliente com 3 projetos Asana (Conteúdo, Tráfego, Criativos)
 * + custom fields + seções padrão
 *
 * POST /api/asana/provision
 * {
 *   "client_name": "Acme Corp",
 *   "client_email": "admin@acme.com",
 *   "workspace_gid": "1234567890"
 * }
 *
 * Response:
 * {
 *   "ok": true,
 *   "client_id": "uuid",
 *   "projects": {
 *     "conteudo": { "gid": "proj_123", "name": "Conteúdo" },
 *     "trafego": { "gid": "proj_456", "name": "Tráfego" },
 *     "criativos": { "gid": "proj_789", "name": "Criativos" }
 *   },
 *   "timestamp": "2026-03-17T10:30:00Z"
 * }
 */

const ASANA_BASE = 'https://app.asana.com/api/1.0';

// ─────────────────────────────────────────────────────────────────────
// PROJECT TEMPLATES: Seções padrão para cada tipo de projeto
// ─────────────────────────────────────────────────────────────────────

const PROJECT_TEMPLATES = {
  conteudo: {
    name: 'Conteúdo',
    description: 'Gestão de conteúdo: blog, vídeos, podcasts, infográficos',
    sections: ['📝 Blog', '🎥 Vídeos', '🎙️ Podcasts', '📊 Infográficos'],
    color: 'light-blue',
  },
  trafego: {
    name: 'Tráfego',
    description: 'Campanhas de tráfego pago em todas as plataformas',
    sections: ['🔍 Google Ads', '📘 Facebook Ads', '💼 LinkedIn', '📌 Pinterest'],
    color: 'light-green',
  },
  criativos: {
    name: 'Criativos',
    description: 'Produção de criativos, assets e materiais',
    sections: ['🎨 Design', '✍️ Copy', '🎬 Roteiros', '📦 Assets'],
    color: 'light-purple',
  },
};

// ─────────────────────────────────────────────────────────────────────
// CUSTOM FIELDS PADRÃO
// ─────────────────────────────────────────────────────────────────────

const CUSTOM_FIELDS = [
  {
    name: 'Status da Entrega',
    type: 'enum',
    enum_options: [
      { name: 'Planejado', color: 'light-gray' },
      { name: 'Em Andamento', color: 'light-yellow' },
      { name: 'Pronto', color: 'light-green' },
      { name: 'Entregue', color: 'light-blue' },
    ],
  },
  {
    name: 'Deadline',
    type: 'date',
  },
  {
    name: 'Responsável',
    type: 'text',
  },
];

// ─────────────────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ─── ENVIRONMENT VARIABLES ────────────────────────────────────────
  const asanaPat = process.env.ASANA_PAT;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!asanaPat) {
    return res.status(500).json({ error: 'ASANA_PAT not configured' });
  }
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  // ─── INPUT VALIDATION ────────────────────────────────────────────
  const { client_name, client_email, workspace_gid } = req.body || {};

  if (!client_name || !client_email || !workspace_gid) {
    return res.status(400).json({
      error: 'Missing required fields: client_name, client_email, workspace_gid',
    });
  }

  if (!client_email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  try {
    // ─── STEP 1: CRIAR CLIENTE NO SUPABASE ───────────────────────
    console.log(`[PROVISION] Creating client: ${client_name} (${client_email})`);

    const clientRes = await fetch(`${supabaseUrl}/rest/v1/clients`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: client_name,
        email: client_email,
        asana_workspace_gid: workspace_gid,
      }),
    });

    if (!clientRes.ok) {
      const err = await clientRes.text();
      console.error('Supabase error:', err);
      return res.status(500).json({ error: 'Failed to create client in Supabase', details: err });
    }

    const clientData = await clientRes.json();
    const clientId = clientData[0]?.id;

    if (!clientId) {
      return res.status(500).json({ error: 'Client created but ID not returned' });
    }

    console.log(`[PROVISION] Client created: ${clientId}`);

    // ─── STEP 2: CRIAR 3 PROJETOS NO ASANA ───────────────────────
    const projects = {};
    const projectErrors = [];

    for (const [projectType, template] of Object.entries(PROJECT_TEMPLATES)) {
      try {
        console.log(`[PROVISION] Creating project: ${template.name}`);

        // Criar projeto
        const projRes = await fetch(`${ASANA_BASE}/projects`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${asanaPat}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            data: {
              name: template.name,
              workspace: workspace_gid,
              color: template.color,
            },
          }),
        });

        if (!projRes.ok) {
          const err = await projRes.text();
          throw new Error(`Asana API error: ${err}`);
        }

        const projData = await projRes.json();
        const projectGid = projData.data.gid;

        console.log(`[PROVISION] Project created: ${projectGid}`);

        // ─── CRIAR SEÇÕES PADRÃO ───────────────────────────────
        const sections = [];
        for (const sectionName of template.sections) {
          const secRes = await fetch(
            `${ASANA_BASE}/projects/${projectGid}/sections`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${asanaPat}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                data: { name: sectionName },
              }),
            }
          );

          if (secRes.ok) {
            const secData = await secRes.json();
            sections.push({
              gid: secData.data.gid,
              name: sectionName,
            });
          }
        }

        console.log(`[PROVISION] Created ${sections.length} sections`);

        // ─── CRIAR CUSTOM FIELDS ───────────────────────────────
        const customFields = [];
        for (const field of CUSTOM_FIELDS) {
          const fieldRes = await fetch(`${ASANA_BASE}/projects/${projectGid}/custom_fields`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${asanaPat}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              data: {
                name: field.name,
                type: field.type,
                ...(field.enum_options && {
                  enum_options: field.enum_options,
                }),
              },
            }),
          });

          if (fieldRes.ok) {
            const fieldData = await fieldRes.json();
            customFields.push({
              gid: fieldData.data.gid,
              name: field.name,
            });
          }
        }

        console.log(`[PROVISION] Created ${customFields.length} custom fields`);

        // ─── GUARDAR NO SUPABASE ───────────────────────────────
        const saveRes = await fetch(`${supabaseUrl}/rest/v1/asana_projects`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: clientId,
            project_gid: projectGid,
            project_name: template.name,
            project_type: projectType,
          }),
        });

        if (!saveRes.ok) {
          console.error('Failed to save project to Supabase');
        }

        projects[projectType] = {
          gid: projectGid,
          name: template.name,
          sections: sections,
          custom_fields: customFields,
        };
      } catch (e) {
        console.error(`[PROVISION] Error creating ${projectType} project:`, e.message);
        projectErrors.push({
          project: projectType,
          error: e.message,
        });
      }
    }

    // ─── STEP 3: VALIDAR RESULTADO ───────────────────────────────
    const successCount = Object.keys(projects).length;

    if (successCount === 0) {
      return res.status(500).json({
        error: 'Failed to create any projects',
        errors: projectErrors,
      });
    }

    if (successCount < 3) {
      console.warn(`[PROVISION] Warning: Only ${successCount}/3 projects created`);
    }

    // ─── STEP 4: RETORNAR SUCESSO ───────────────────────────────
    console.log(`[PROVISION] Provision complete for client: ${clientId}`);

    return res.status(200).json({
      ok: true,
      client_id: clientId,
      client_name,
      client_email,
      projects,
      timestamp: new Date().toISOString(),
      summary: {
        projects_created: successCount,
        errors: projectErrors.length > 0 ? projectErrors : null,
      },
    });
  } catch (e) {
    console.error('[PROVISION] Fatal error:', e);
    return res.status(500).json({
      error: 'Internal server error',
      message: e.message,
    });
  }
};
