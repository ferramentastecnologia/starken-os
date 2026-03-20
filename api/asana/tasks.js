// =============================================================================
// Client Hub API — Multiplexed Vercel Serverless Function
// POST endpoint with action-based routing (6 MVP actions)
//
// Actions:
//   hub_get        — Full client hub record with counts
//   hub_list       — List all hubs with completeness score
//   hub_upsert     — Create or update a hub + log activity
//   hub_delete     — Soft delete (status → encerrado)
//   hub_activity   — Activity log for a hub
//   hub_bulk_init  — Bootstrap hubs from existing meta_config
// =============================================================================

const { createClient } = require('@supabase/supabase-js');

// Lazy-initialized Supabase client (reused across warm invocations)
let _supabase;
function supabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
  }
  return _supabase;
}

// =============================================================================
// Important fields used to compute hub completeness percentage
// =============================================================================

const COMPLETENESS_FIELDS = [
  'brand_name',
  'segment',
  'tone_of_voice',
  'target_audience',
  'brand_colors',
  'logo_url',
  'social_links',
  'onboarding_date',
  'contract_type',
];

function computeCompleteness(row) {
  if (!row) return 0;
  let filled = 0;
  for (const field of COMPLETENESS_FIELDS) {
    const val = row[field];
    if (val === null || val === undefined || val === '') continue;
    // For JSONB columns, treat empty objects/arrays as incomplete
    if (typeof val === 'object' && Object.keys(val).length === 0) continue;
    filled++;
  }
  return Math.round((filled / COMPLETENESS_FIELDS.length) * 100);
}

// =============================================================================
// 1. hub_get — Full client hub record with material and post counts
// =============================================================================

async function hubGet({ client_slug }) {
  if (!client_slug) return { error: true, message: 'client_slug is required' };

  const sb = supabase();

  // Fetch the hub record
  const { data: hub, error: hubErr } = await sb
    .from('client_hub')
    .select('*')
    .eq('client_slug', client_slug)
    .single();

  if (hubErr) {
    if (hubErr.code === 'PGRST116') {
      return { error: true, message: `Hub not found for slug: ${client_slug}` };
    }
    throw hubErr;
  }

  // Fetch related counts in parallel
  const [materialsRes, postsRes] = await Promise.all([
    sb
      .from('client_hub_materials')
      .select('id', { count: 'exact', head: true })
      .eq('client_slug', client_slug),
    sb
      .from('publish_history')
      .select('id', { count: 'exact', head: true })
      .eq('client_slug', client_slug),
  ]);

  return {
    ...hub,
    materials_count: materialsRes.count ?? 0,
    recent_posts_count: postsRes.count ?? 0,
    completeness: computeCompleteness(hub),
  };
}

// =============================================================================
// 2. hub_list — List all hubs with optional tenant filter and completeness
// =============================================================================

async function hubList({ tenant }) {
  const sb = supabase();

  let query = sb.from('client_hub').select('*');

  if (tenant) {
    query = query.eq('tenant', tenant);
  }

  const { data, error } = await query.order('brand_name', { ascending: true });

  if (error) throw error;

  // Return summary fields with computed completeness
  const result = (data || []).map((row) => ({
    client_slug: row.client_slug,
    brand_name: row.brand_name,
    tenant: row.tenant,
    segment: row.segment,
    status: row.status,
    onboarding_date: row.onboarding_date,
    contract_type: row.contract_type,
    completeness: computeCompleteness(row),
  }));

  return result;
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

  const sb = supabase();
  const now = new Date().toISOString();

  // Check if hub already exists (for accurate activity logging)
  const { data: existing } = await sb
    .from('client_hub')
    .select('client_slug')
    .eq('client_slug', client_slug)
    .maybeSingle();

  const isNew = !existing;

  const record = {
    ...data,
    client_slug,
    updated_at: now,
  };

  // Set created_at only for new records
  if (isNew) {
    record.created_at = now;
  }

  // Upsert on client_slug (must be unique / primary key)
  const { data: upserted, error: upsertErr } = await sb
    .from('client_hub')
    .upsert(record, { onConflict: 'client_slug' })
    .select('*')
    .single();

  if (upsertErr) throw upsertErr;

  // Log activity
  await sb.from('client_hub_activity').insert({
    client_slug,
    actor: user,
    action: isNew ? 'hub_created' : 'hub_updated',
    details: JSON.stringify({ fields: Object.keys(data) }),
    created_at: now,
  });

  return upserted;
}

// =============================================================================
// 4. hub_delete — Soft delete by setting status to 'encerrado'
// =============================================================================

async function hubDelete({ client_slug }) {
  if (!client_slug) return { error: true, message: 'client_slug is required' };

  const sb = supabase();

  const { data, error } = await sb
    .from('client_hub')
    .update({ status: 'encerrado', updated_at: new Date().toISOString() })
    .eq('client_slug', client_slug)
    .select('client_slug, status')
    .single();

  if (error) throw error;

  return { success: true, client_slug: data.client_slug, status: data.status };
}

// =============================================================================
// 5. hub_activity — Activity log for a specific hub
// =============================================================================

async function hubActivity({ client_slug, limit }) {
  if (!client_slug) return { error: true, message: 'client_slug is required' };

  const cap = Math.min(Number(limit) || 20, 200);
  const sb = supabase();

  const { data, error } = await sb
    .from('client_hub_activity')
    .select('*')
    .eq('client_slug', client_slug)
    .order('created_at', { ascending: false })
    .limit(cap);

  if (error) throw error;

  // Parse stringified details for convenience
  return (data || []).map((row) => ({
    ...row,
    details: typeof row.details === 'string'
      ? JSON.parse(row.details)
      : row.details,
  }));
}

// =============================================================================
// 6. hub_bulk_init — Create hubs for all clients in meta_config that lack one
// =============================================================================

async function hubBulkInit({ user }) {
  if (!user) return { error: true, message: 'user is required' };

  const sb = supabase();
  const now = new Date().toISOString();

  // Fetch all clients from meta_config
  const { data: clients, error: metaErr } = await sb
    .from('meta_config')
    .select('*');

  if (metaErr) throw metaErr;
  if (!clients || clients.length === 0) {
    return { created: 0, message: 'No clients found in meta_config' };
  }

  // Fetch existing hub slugs so we skip them
  const { data: existingHubs, error: hubErr } = await sb
    .from('client_hub')
    .select('client_slug');

  if (hubErr) throw hubErr;

  const existingSlugs = new Set((existingHubs || []).map((h) => h.client_slug));

  // Build records for clients without a hub
  const newHubs = [];
  for (const client of clients) {
    const slug = client.client_slug || client.clientSlug || client.slug;
    if (!slug || existingSlugs.has(slug)) continue;

    // Build social links from meta_config fields
    const socialLinks = {};
    if (client.igUsername) {
      socialLinks.instagram = `https://instagram.com/${client.igUsername}`;
    }
    if (client.pageId) {
      socialLinks.facebook = `https://facebook.com/${client.pageId}`;
    }

    newHubs.push({
      client_slug: slug,
      brand_name: client.name || client.clientName || slug,
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

  const { error: insertErr } = await sb
    .from('client_hub')
    .insert(newHubs);

  if (insertErr) throw insertErr;

  // Log bulk activity
  await sb.from('client_hub_activity').insert(
    newHubs.map((h) => ({
      client_slug: h.client_slug,
      actor: user,
      action: 'hub_bulk_created',
      details: JSON.stringify({ source: 'meta_config' }),
      created_at: now,
    }))
  );

  return {
    created: newHubs.length,
    slugs: newHubs.map((h) => h.client_slug),
  };
}

// =============================================================================
// 7. hub_materials_list — List materials for a client hub
// =============================================================================

async function hubMaterialsList({ client_slug, category }) {
  if (!client_slug) return { error: true, message: 'client_slug is required' };

  const sb = supabase();
  let query = sb
    .from('client_hub_materials')
    .select('*')
    .eq('client_slug', client_slug)
    .order('created_at', { ascending: false });

  if (category && category !== 'all') {
    query = query.eq('category', category);
  }

  const { data, error } = await query;
  if (error) throw error;

  return data || [];
}

// =============================================================================
// 8. hub_materials_delete — Delete a material record (file cleanup optional)
// =============================================================================

async function hubMaterialsDelete({ client_slug, material_id }) {
  if (!client_slug) return { error: true, message: 'client_slug is required' };
  if (!material_id) return { error: true, message: 'material_id is required' };

  const sb = supabase();

  // Fetch the record first so we can get the storage path
  const { data: mat, error: fetchErr } = await sb
    .from('client_hub_materials')
    .select('*')
    .eq('id', material_id)
    .eq('client_slug', client_slug)
    .single();

  if (fetchErr || !mat) {
    return { error: true, message: 'Material not found' };
  }

  // Attempt to delete from storage if storage_path is set
  if (mat.storage_path) {
    await sb.storage.from('client-hub-materials').remove([mat.storage_path]);
  }

  // Delete the DB record
  const { error: delErr } = await sb
    .from('client_hub_materials')
    .delete()
    .eq('id', material_id)
    .eq('client_slug', client_slug);

  if (delErr) throw delErr;

  return { success: true, deleted_id: material_id };
}

// =============================================================================
// 9. hub_materials_insert — Insert a material record (upload done client-side)
// =============================================================================

async function hubMaterialsInsert({ client_slug, user, material }) {
  if (!client_slug) return { error: true, message: 'client_slug is required' };
  if (!material || !material.file_name) return { error: true, message: 'material.file_name is required' };

  const sb = supabase();
  const now = new Date().toISOString();

  const record = {
    client_slug,
    file_name:    material.file_name,
    file_url:     material.file_url     || null,
    storage_path: material.storage_path || null,
    category:     material.category     || 'other',
    mime_type:    material.mime_type    || null,
    file_size:    material.file_size    || null,
    uploaded_by:  user || 'Sistema',
    created_at:   now,
  };

  const { data, error } = await sb
    .from('client_hub_materials')
    .insert(record)
    .select('*')
    .single();

  if (error) throw error;

  return data;
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

    // If the handler returned an error object, send 400
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
