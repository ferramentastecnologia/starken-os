/**
 * /api/meta/pages — Lista páginas e contas IG acessíveis
 *
 * GET — Retorna todas as páginas do Facebook e contas Instagram Business
 *       vinculadas ao token. Não requer config prévia.
 *
 * Endpoint leve para validar conexão.
 */

const { graphGet } = require('./_lib/graph');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: true, code: 'METHOD_NOT_ALLOWED', message: 'Use GET' });
  }

  try {
    const pagesData = await graphGet('/me/accounts', {
      fields: 'name,id,instagram_business_account{id,username,profile_picture_url}',
    });

    const pages = (pagesData.data || []).map(page => ({
      id: page.id,
      name: page.name,
      ig_account: page.instagram_business_account || null,
    }));

    return res.status(200).json({
      connected: true,
      pages,
    });
  } catch (err) {
    if (err.error) {
      return res.status(err.status || 500).json(err);
    }
    return res.status(500).json({
      error: true,
      code: 'INTERNAL_ERROR',
      message: err.message || 'Erro interno',
    });
  }
};
