/**
 * /api/meta/config — Salvar/carregar mapeamento de tenants
 *
 * GET  — Retorna config atual (mapeamento tenant → recursos Meta)
 * POST — Salva nova config
 *
 * Body POST:
 * {
 *   tenants: {
 *     starken: {
 *       name: "Starken Performance",
 *       pageId: "123",
 *       pageAccessToken: "EAA...",
 *       igUserId: "456",
 *       adAccountIds: ["act_789", "act_012"]
 *     },
 *     alpha: { ... }
 *   }
 * }
 */

const { loadConfig, saveConfig } = require('./_lib/tenants');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ─── GET: Retorna config atual ───
  if (req.method === 'GET') {
    try {
      const config = await loadConfig();
      return res.status(200).json({
        configured: !!config,
        config: config || { tenants: {} },
      });
    } catch (err) {
      return res.status(500).json({
        error: true,
        code: 'INTERNAL_ERROR',
        message: err.message || 'Erro ao carregar config',
      });
    }
  }

  // ─── POST: Salva config ───
  if (req.method === 'POST') {
    const { tenants } = req.body || {};

    if (!tenants || typeof tenants !== 'object') {
      return res.status(400).json({
        error: true,
        code: 'MISSING_PARAM',
        message: 'Body deve conter { tenants: { starken: {...}, alpha: {...} } }',
      });
    }

    try {
      const config = {
        tenants,
        updated_at: new Date().toISOString(),
      };

      await saveConfig(config);

      return res.status(200).json({ ok: true, config });
    } catch (err) {
      if (err.error) return res.status(500).json(err);
      return res.status(500).json({
        error: true,
        code: 'INTERNAL_ERROR',
        message: err.message || 'Erro ao salvar config',
      });
    }
  }

  return res.status(405).json({ error: true, code: 'METHOD_NOT_ALLOWED', message: 'Use GET ou POST' });
};
