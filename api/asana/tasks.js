// =============================================================================
// Client Hub API — Multiplexed Vercel Serverless Function
// POST endpoint with action-based routing
//
// Actions:
//   hub_get        — Full client hub record with counts
//   hub_list       — List all hubs with completeness score
//   hub_upsert     — Create or update a hub + log activity
//   hub_delete     — Soft delete (status → encerrado)
//   hub_activity   — Activity log for a hub
//   hub_bulk_init  — Bootstrap hubs from existing meta_config
//   hub_materials_list   — List materials
//   hub_materials_delete — Delete material
//   hub_materials_insert — Insert material record
//   hub_materials_upload — Upload file to Storage + insert record
// =============================================================================

// ─── Supabase REST helpers (same pattern as publish.js / content.js) ───
const SUPABASE_URL = () => process.env.SUPABASE_URL || '';
const SUPABASE_KEY = () => process.env.SUPABASE_SERVICE_KEY || '';

function sbHeaders(prefer) {
  const key = SUPABASE_KEY();
  const h = {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
  if (prefer) h['Prefer'] = prefer;
  return h;
}

async function sbFetch(path, opts = {}) {
  const url = SUPABASE_URL();
  if (!url) throw new Error('SUPABASE_URL not configured');
  const res = await fetch(`${url}${path}`, opts);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Supabase ${res.status}: ${text.substring(0, 300)}`);
  }
  if (!text || text.length === 0) return null;
  try { return JSON.parse(text); } catch { return text; }
}

// =============================================================================
// Completeness fields
// =============================================================================

const COMPLETENESS_FIELDS = [
  'client_name', 'segment', 'responsible', 'tone_of_voice',
  'brand_colors', 'logo_url', 'social_links', 'contract_start',
  'contract_package', 'drive_folder_url',
];

function computeCompleteness(row) {
  if (!row) return 0;
  let filled = 0;
  for (const field of COMPLETENESS_FIELDS) {
    const val = row[field];
    if (val === null || val === undefined || val === '') continue;
    if (typeof val === 'object' && Object.keys(val).length === 0) continue;
    filled++;
  }
  return Math.round((filled / COMPLETENESS_FIELDS.length) * 100);
}

// =============================================================================
// 1. hub_get — Full client hub record
// =============================================================================

async function hubGet({ client_slug }) {
  if (!client_slug) return { error: true, message: 'client_slug is required' };

  const data = await sbFetch(
    `/rest/v1/client_hub?client_slug=eq.${encodeURIComponent(client_slug)}&limit=1`,
    { headers: sbHeaders() }
  );

  const hub = Array.isArray(data) ? data[0] : data;
  if (!hub) return { error: true, message: `Hub not found for slug: ${client_slug}` };

  // Counts
  const [matsRes, postsRes] = await Promise.all([
    sbFetch(`/rest/v1/client_hub_materials?client_slug=eq.${encodeURIComponent(client_slug)}&select=id`, {
      method: 'HEAD', headers: { ...sbHeaders(), 'Prefer': 'count=exact' }
    }).catch(() => null),
    sbFetch(`/rest/v1/publish_history?client_slug=eq.${encodeURIComponent(client_slug)}&select=id`, {
      method: 'HEAD', headers: { ...sbHeaders(), 'Prefer': 'count=exact' }
    }).catch(() => null),
  ]);

  return {
    ...hub,
    materials_count: 0,
    recent_posts_count: 0,
    completeness: computeCompleteness(hub),
  };
}

// =============================================================================
// 2. hub_list — List all hubs
// =============================================================================

async function hubList({ tenant }) {
  let path = '/rest/v1/client_hub?select=*&order=client_name.asc';
  if (tenant) path += `&tenant=eq.${encodeURIComponent(tenant)}`;

  const data = await sbFetch(path, { headers: sbHeaders() });

  return (data || []).map((row) => ({
    client_slug: row.client_slug,
    client_name: row.client_name,
    tenant: row.tenant,
    segment: row.segment,
    status: row.status,
    responsible: row.responsible,
    contract_start: row.contract_start,
    contract_package: row.contract_package,
    completeness: computeCompleteness(row),
  }));
}

// =============================================================================
// 3. hub_upsert — Create or update hub + log activity
// =============================================================================

async function hubUpsert({ client_slug, user, data }) {
  if (!client_slug) return { error: true, message: 'client_slug is required' };
  if (!user) return { error: true, message: 'user is required' };
  if (!data || typeof data !== 'object') {
    return { error: true, message: 'data object is required' };
  }

  const now = new Date().toISOString();

  // Check if exists
  const existing = await sbFetch(
    `/rest/v1/client_hub?client_slug=eq.${encodeURIComponent(client_slug)}&select=client_slug&limit=1`,
    { headers: sbHeaders() }
  );
  const isNew = !existing || (Array.isArray(existing) && existing.length === 0);

  const record = { ...data, client_slug, updated_at: now };
  if (isNew) record.created_at = now;

  // Upsert
  const upserted = await sbFetch('/rest/v1/client_hub?on_conflict=client_slug', {
    method: 'POST',
    headers: sbHeaders('resolution=merge-duplicates,return=representation'),
    body: JSON.stringify(record),
  });

  // Log activity
  await sbFetch('/rest/v1/client_hub_activity', {
    method: 'POST',
    headers: sbHeaders('return=minimal'),
    body: JSON.stringify({
      client_slug,
      actor: user,
      action: isNew ? 'hub_created' : 'hub_updated',
      details: JSON.stringify({ fields: Object.keys(data) }),
      created_at: now,
    }),
  });

  return Array.isArray(upserted) ? upserted[0] : upserted;
}

// =============================================================================
// 4. hub_delete — Soft delete
// =============================================================================

async function hubDelete({ client_slug }) {
  if (!client_slug) return { error: true, message: 'client_slug is required' };

  const data = await sbFetch(
    `/rest/v1/client_hub?client_slug=eq.${encodeURIComponent(client_slug)}`,
    {
      method: 'PATCH',
      headers: sbHeaders('return=representation'),
      body: JSON.stringify({ status: 'encerrado', updated_at: new Date().toISOString() }),
    }
  );

  const row = Array.isArray(data) ? data[0] : data;
  return { success: true, client_slug: row?.client_slug, status: row?.status };
}

// =============================================================================
// 5. hub_activity — Activity log
// =============================================================================

async function hubActivity({ client_slug, limit }) {
  if (!client_slug) return { error: true, message: 'client_slug is required' };

  const cap = Math.min(Number(limit) || 20, 200);

  const data = await sbFetch(
    `/rest/v1/client_hub_activity?client_slug=eq.${encodeURIComponent(client_slug)}&order=created_at.desc&limit=${cap}`,
    { headers: sbHeaders() }
  );

  return (data || []).map((row) => ({
    ...row,
    details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
  }));
}

// =============================================================================
// 6. hub_bulk_init — Bootstrap from meta_config
// =============================================================================

async function hubBulkInit({ user }) {
  if (!user) return { error: true, message: 'user is required' };

  const now = new Date().toISOString();

  // Fetch all meta_config clients
  const clients = await sbFetch('/rest/v1/meta_config?select=*', { headers: sbHeaders() });
  if (!clients || clients.length === 0) {
    return { created: 0, message: 'No clients found in meta_config' };
  }

  // Fetch existing hub slugs
  const existingHubs = await sbFetch('/rest/v1/client_hub?select=client_slug', { headers: sbHeaders() });
  const existingSlugs = new Set((existingHubs || []).map((h) => h.client_slug));

  const newHubs = [];
  for (const client of clients) {
    const slug = client.client_slug || client.clientSlug || client.slug;
    if (!slug || existingSlugs.has(slug)) continue;

    const socialLinks = {};
    if (client.igUsername) socialLinks.instagram = `https://instagram.com/${client.igUsername}`;
    if (client.pageId) socialLinks.facebook = `https://facebook.com/${client.pageId}`;

    newHubs.push({
      client_slug: slug,
      client_name: client.name || client.clientName || slug,
      tenant: client.tenant || null,
      status: 'ativo',
      social_links: Object.keys(socialLinks).length > 0 ? socialLinks : null,
      created_at: now,
      updated_at: now,
    });
  }

  if (newHubs.length === 0) {
    return { created: 0, message: 'All clients already have hubs' };
  }

  await sbFetch('/rest/v1/client_hub', {
    method: 'POST',
    headers: sbHeaders('return=minimal'),
    body: JSON.stringify(newHubs),
  });

  // Log activity
  await sbFetch('/rest/v1/client_hub_activity', {
    method: 'POST',
    headers: sbHeaders('return=minimal'),
    body: JSON.stringify(
      newHubs.map((h) => ({
        client_slug: h.client_slug,
        actor: user,
        action: 'hub_bulk_created',
        details: JSON.stringify({ source: 'meta_config' }),
        created_at: now,
      }))
    ),
  });

  return { created: newHubs.length, slugs: newHubs.map((h) => h.client_slug) };
}

// =============================================================================
// 7. hub_materials_list
// =============================================================================

async function hubMaterialsList({ client_slug, category }) {
  if (!client_slug) return { error: true, message: 'client_slug is required' };

  let path = `/rest/v1/client_hub_materials?client_slug=eq.${encodeURIComponent(client_slug)}&order=created_at.desc`;
  if (category && category !== 'all') path += `&category=eq.${encodeURIComponent(category)}`;

  const data = await sbFetch(path, { headers: sbHeaders() });
  return data || [];
}

// =============================================================================
// 8. hub_materials_delete
// =============================================================================

async function hubMaterialsDelete({ client_slug, material_id }) {
  if (!client_slug) return { error: true, message: 'client_slug is required' };
  if (!material_id) return { error: true, message: 'material_id is required' };

  // Fetch first
  const mats = await sbFetch(
    `/rest/v1/client_hub_materials?id=eq.${encodeURIComponent(material_id)}&client_slug=eq.${encodeURIComponent(client_slug)}&limit=1`,
    { headers: sbHeaders() }
  );
  const mat = Array.isArray(mats) ? mats[0] : null;
  if (!mat) return { error: true, message: 'Material not found' };

  // Delete storage file if path exists
  if (mat.storage_path) {
    try {
      await sbFetch(`/storage/v1/object/client-hub-materials/${mat.storage_path}`, {
        method: 'DELETE',
        headers: sbHeaders(),
      });
    } catch (e) { /* ignore storage errors */ }
  }

  // Delete DB record
  await sbFetch(
    `/rest/v1/client_hub_materials?id=eq.${encodeURIComponent(material_id)}&client_slug=eq.${encodeURIComponent(client_slug)}`,
    { method: 'DELETE', headers: sbHeaders() }
  );

  return { success: true, deleted_id: material_id };
}

// =============================================================================
// 9. hub_materials_insert
// =============================================================================

async function hubMaterialsInsert({ client_slug, user, material }) {
  if (!client_slug) return { error: true, message: 'client_slug is required' };
  if (!material || !material.file_name) return { error: true, message: 'material.file_name is required' };

  const now = new Date().toISOString();

  const record = {
    client_slug,
    file_name:    material.file_name,
    file_url:     material.file_url     || null,
    storage_path: material.storage_path || null,
    category:     material.category     || 'other',
    mime_type:    material.mime_type     || null,
    file_size:    material.file_size    || null,
    uploaded_by:  user || 'Sistema',
    created_at:   now,
  };

  const data = await sbFetch('/rest/v1/client_hub_materials', {
    method: 'POST',
    headers: sbHeaders('return=representation'),
    body: JSON.stringify(record),
  });

  return Array.isArray(data) ? data[0] : data;
}

// 10. hub_materials_upload — Upload file to Supabase Storage + insert record
// =============================================================================

async function hubMaterialsUpload({ client_slug, user, file_name, file_base64, mime_type, category, file_size }) {
  if (!client_slug) return { error: true, message: 'client_slug is required' };
  if (!file_base64) return { error: true, message: 'file_base64 is required' };
  if (!file_name) return { error: true, message: 'file_name is required' };

  const url = SUPABASE_URL();
  const key = SUPABASE_KEY();
  if (!url) throw new Error('SUPABASE_URL not configured');

  // Generate unique storage path
  const ext = file_name.split('.').pop() || 'bin';
  const safeName = file_name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${client_slug}/${Date.now()}_${safeName}`;

  // Decode base64 to binary
  const binaryStr = atob(file_base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  // Upload to Supabase Storage
  const uploadRes = await fetch(
    `${url}/storage/v1/object/client-hub-materials/${storagePath}`,
    {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': mime_type || 'application/octet-stream',
        'x-upsert': 'true',
      },
      body: bytes,
    }
  );

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    return { error: true, message: `Storage upload failed: ${errText.substring(0, 200)}` };
  }

  // Build public URL
  const fileUrl = `${url}/storage/v1/object/public/client-hub-materials/${storagePath}`;

  // Insert material record
  const record = {
    client_slug,
    file_name,
    file_url: fileUrl,
    storage_path: storagePath,
    category: category || 'other',
    mime_type: mime_type || null,
    file_size: file_size || bytes.length,
    uploaded_by: user || 'Sistema',
    created_at: new Date().toISOString(),
  };

  const data = await sbFetch('/rest/v1/client_hub_materials', {
    method: 'POST',
    headers: sbHeaders('return=representation'),
    body: JSON.stringify(record),
  });

  const inserted = Array.isArray(data) ? data[0] : data;
  return { ...inserted, file_url: fileUrl };
}

// =============================================================================
// Action router
// =============================================================================

const ACTIONS = {
  hub_get: hubGet,
  hub_list: hubList,
  hub_upsert: hubUpsert,
  hub_delete: hubDelete,
  hub_activity: hubActivity,
  hub_bulk_init: hubBulkInit,
  hub_materials_list:   hubMaterialsList,
  hub_materials_delete: hubMaterialsDelete,
  hub_materials_insert: hubMaterialsInsert,
  hub_materials_upload: hubMaterialsUpload,
};

// =============================================================================
// Main handler
// =============================================================================

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: true, message: 'Use POST' });
  }

  const body = req.body || {};
  const { action, ...params } = body;

  if (!action) {
    return res.status(400).json({ error: true, message: 'action field is required' });
  }

  const fn = ACTIONS[action];
  if (!fn) {
    return res.status(400).json({
      error: true,
      message: `Unknown action: ${action}. Valid: ${Object.keys(ACTIONS).join(', ')}`,
    });
  }

  try {
    const result = await fn(params);

    if (result && result.error === true) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error(`[client-hub] action=${action} error:`, err);
    return res.status(500).json({
      error: true,
      message: err.message || 'Internal server error',
    });
  }
};
