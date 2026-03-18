/**
 * _lib/tenants.js — Configuração multi-tenant dinâmica
 *
 * O mapeamento tenant → recursos Meta é salvo no Supabase (tabela meta_config)
 * ou passado diretamente via query params.
 *
 * Não depende mais de env vars por tenant — o token do app/portfólio
 * já tem acesso a todas as páginas, contas IG e ad accounts.
 *
 * Env vars necessárias: apenas META_ACCESS_TOKEN
 */

const SUPABASE_URL = () => process.env.SUPABASE_URL || '';
const SUPABASE_KEY = () => process.env.SUPABASE_SERVICE_KEY || '';

// Cache em memória (reusado entre invocações warm do Vercel)
let _configCache = null;
let _configCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Carrega config de mapeamento do Supabase
 * Tabela: meta_config (id='default', config=JSON com mapeamento)
 */
async function loadConfig() {
  const now = Date.now();
  if (_configCache && (now - _configCacheTime) < CACHE_TTL) {
    return _configCache;
  }

  const url = SUPABASE_URL();
  const key = SUPABASE_KEY();

  if (url && key) {
    try {
      const res = await fetch(
        `${url}/rest/v1/meta_config?id=eq.default&select=config`,
        { headers: { 'apikey': key, 'Authorization': `Bearer ${key}` } }
      );
      if (res.ok) {
        const rows = await res.json();
        if (rows.length > 0 && rows[0].config) {
          _configCache = rows[0].config;
          _configCacheTime = now;
          return _configCache;
        }
      }
    } catch (e) {
      // Supabase indisponível — usa cache se existir
    }
  }

  return _configCache || null;
}

/**
 * Salva config de mapeamento no Supabase
 */
async function saveConfig(config) {
  const url = SUPABASE_URL();
  const key = SUPABASE_KEY();

  if (!url || !key) {
    throw { error: true, code: 'NO_SUPABASE', message: 'Supabase não configurado para salvar config' };
  }

  const res = await fetch(`${url}/rest/v1/meta_config`, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      id: 'default',
      config: config,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw { error: true, code: 'SAVE_FAILED', message: 'Falha ao salvar config: ' + err };
  }

  // Atualiza cache
  _configCache = config;
  _configCacheTime = Date.now();
  return config;
}

/**
 * Retorna config de um tenant específico
 * @param {string} tenantKey - 'starken' ou 'alpha'
 * @returns {{ key, name, adAccountId, pageId, igUserId, pageAccessToken }}
 */
async function getTenant(tenantKey) {
  const config = await loadConfig();

  if (!config || !config.tenants || !config.tenants[tenantKey]) {
    throw {
      error: true,
      code: 'TENANT_NOT_CONFIGURED',
      message: `Tenant "${tenantKey}" ainda não foi configurado. Use a tela de Configuração Meta para mapear as contas.`,
    };
  }

  const t = config.tenants[tenantKey];
  return {
    key: tenantKey,
    name: t.name || tenantKey,
    adAccountIds: t.adAccountIds || [],
    pageId: t.pageId || null,
    pageAccessToken: t.pageAccessToken || null,
    igUserId: t.igUserId || null,
  };
}

/**
 * Lista todos os tenants configurados
 */
async function listTenants() {
  const config = await loadConfig();
  if (!config || !config.tenants) return [];

  return Object.entries(config.tenants).map(([key, t]) => ({
    key,
    name: t.name || key,
    adAccountIds: t.adAccountIds || [],
    pageId: t.pageId || null,
    igUserId: t.igUserId || null,
  }));
}

/**
 * Valida que o parâmetro tenant foi fornecido e é válido
 */
async function validateTenant(req, res) {
  const tenantKey = req.query?.tenant || req.body?.tenant;
  if (!tenantKey) {
    res.status(400).json({ error: true, code: 'MISSING_PARAM', message: 'Parâmetro "tenant" é obrigatório' });
    return null;
  }
  try {
    return await getTenant(tenantKey);
  } catch (err) {
    res.status(400).json(err);
    return null;
  }
}

module.exports = { getTenant, listTenants, validateTenant, loadConfig, saveConfig };
