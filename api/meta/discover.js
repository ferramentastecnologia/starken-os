/**
 * /api/meta/discover — Descobre todos os ativos acessíveis pelo token
 *
 * GET — Retorna:
 *   - Páginas do Facebook (com IG vinculado)
 *   - Contas de anúncios (ad accounts do portfólio)
 *   - Status do token (validade, permissões)
 *
 * Não precisa de config prévia — usa apenas META_ACCESS_TOKEN
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
    // 1. Páginas do Facebook + IG vinculado
    const pagesData = await graphGet('/me/accounts', {
      fields: 'name,id,category,access_token,instagram_business_account{id,username,name,profile_picture_url,followers_count}',
      limit: '100',
    });

    const pages = (pagesData.data || []).map(page => ({
      id: page.id,
      name: page.name,
      category: page.category,
      access_token: page.access_token,
      ig_account: page.instagram_business_account || null,
    }));

    // 2. Contas de anúncios
    const adAccountsData = await graphGet('/me/adaccounts', {
      fields: 'name,account_id,id,account_status,currency,balance,amount_spent,business{id,name}',
      limit: '100',
    });

    const adAccounts = (adAccountsData.data || []).map(acc => ({
      id: acc.id,
      account_id: acc.account_id,
      name: acc.name,
      account_status: acc.account_status,
      currency: acc.currency,
      balance: acc.balance,
      amount_spent: acc.amount_spent,
      business: acc.business || null,
    }));

    // 3. Status do token
    let tokenStatus = null;
    try {
      const tokenInfo = await graphGet('/debug_token', {
        input_token: process.env.META_ACCESS_TOKEN,
      });
      if (tokenInfo.data) {
        tokenStatus = {
          valid: tokenInfo.data.is_valid,
          app_id: tokenInfo.data.app_id,
          expires_at: tokenInfo.data.expires_at,
          expires_at_date: tokenInfo.data.expires_at
            ? new Date(tokenInfo.data.expires_at * 1000).toISOString()
            : null,
          scopes: tokenInfo.data.scopes,
        };
      }
    } catch (e) {
      tokenStatus = { valid: true, note: 'debug_token não acessível (normal para user tokens)' };
    }

    // 4. Info do usuário
    let user = null;
    try {
      const userData = await graphGet('/me', { fields: 'name,id' });
      user = { id: userData.id, name: userData.name };
    } catch (e) {
      // Ignora
    }

    return res.status(200).json({
      connected: true,
      user,
      pages,
      ad_accounts: adAccounts,
      token_status: tokenStatus,
      summary: {
        total_pages: pages.length,
        total_ig_accounts: pages.filter(p => p.ig_account).length,
        total_ad_accounts: adAccounts.length,
      },
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
