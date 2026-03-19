/**
 * /api/meta/publish — Publicar ou agendar post no IG/FB
 *
 * POST {
 *   destination: "ig" | "fb",
 *   tenant: "starken" | "alpha",   // OU
 *   client: "estilo-tulipa",       // cliente específico
 *   caption: "Texto do post...",
 *   type: "feed" | "stories" | "reels",
 *   container_id: "17889234...",           // IG: do /api/meta/media
 *   photo_ids: ["123", "456"],             // FB: fotos não publicadas
 *   scheduled_publish_time: 1711036800     // Unix timestamp (opcional)
 * }
 *
 * Retorna: post_id, status (PUBLISHED | SCHEDULED)
 */

const { graphPost } = require('./_lib/graph');
const { validateTenant } = require('./_lib/tenants');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: true, code: 'METHOD_NOT_ALLOWED', message: 'Use POST' });
  }

  const tenant = await validateTenant(req, res);
  if (!tenant) return;

  const { destination, caption, type, container_id, photo_ids, scheduled_publish_time } = req.body || {};

  if (!destination || !['ig', 'fb'].includes(destination)) {
    return res.status(400).json({ error: true, code: 'MISSING_PARAM', message: 'destination deve ser "ig" ou "fb"' });
  }

  try {
    // ─── INSTAGRAM ───
    if (destination === 'ig') {
      if (!tenant.igUserId) {
        return res.status(400).json({
          error: true, code: 'MISSING_PARAM',
          message: `IG User ID não configurado para "${tenant.name || tenant.key}". Configure na tela de Configuração Meta.`,
        });
      }

      if (!container_id) {
        return res.status(400).json({
          error: true, code: 'MISSING_PARAM',
          message: 'container_id obrigatório para publicação IG. Use /api/meta/media primeiro para criar o container de mídia.',
        });
      }

      // Publicar container (imediato)
      const pubBody = { creation_id: container_id };
      // Usa page access token do cliente se disponível
      if (tenant.pageAccessToken) {
        pubBody.access_token = tenant.pageAccessToken;
      }

      const pubRes = await graphPost(`/${tenant.igUserId}/media_publish`, pubBody);
      return res.status(201).json({
        post_id: pubRes.id,
        status: 'PUBLISHED',
        client: tenant.name || tenant.key,
      });
    }

    // ─── FACEBOOK ───
    if (destination === 'fb') {
      if (!tenant.pageId) {
        return res.status(400).json({
          error: true, code: 'MISSING_PARAM',
          message: `Page ID não configurado para "${tenant.name || tenant.key}". Configure na tela de Configuração Meta.`,
        });
      }

      if (!tenant.pageAccessToken) {
        return res.status(400).json({
          error: true, code: 'MISSING_PAGE_TOKEN',
          message: `Page Access Token não encontrado para "${tenant.name || tenant.key}". `
            + `Vá em Configuração Meta → clique "Descobrir Ativos" → selecione novamente a página do cliente → Salvar.`,
        });
      }

      const { image_url } = req.body || {};

      // ─── ESTRATÉGIA 1: Post com imagem → publica direto via /{page_id}/photos ───
      if (image_url) {
        const photoBody = {
          url: image_url,
          caption: caption || '',
          access_token: tenant.pageAccessToken,
        };

        // Agendamento com imagem
        if (scheduled_publish_time) {
          photoBody.scheduled_publish_time = scheduled_publish_time;
          photoBody.published = false;
        }

        const photoRes = await graphPost(`/${tenant.pageId}/photos`, photoBody);

        return res.status(201).json({
          post_id: photoRes.id || photoRes.post_id,
          status: scheduled_publish_time ? 'SCHEDULED' : 'PUBLISHED',
          has_image: true,
          client: tenant.name || tenant.key,
          page: tenant.pageName || tenant.pageId,
          scheduled_for: scheduled_publish_time
            ? new Date(scheduled_publish_time * 1000).toISOString()
            : null,
        });
      }

      // ─── ESTRATÉGIA 2: Post só texto → publica via /{page_id}/feed ───
      const postBody = {
        message: caption || '',
        access_token: tenant.pageAccessToken,
      };

      if (scheduled_publish_time) {
        postBody.scheduled_publish_time = scheduled_publish_time;
        postBody.published = false;
      }

      const postRes = await graphPost(`/${tenant.pageId}/feed`, postBody);

      return res.status(201).json({
        post_id: postRes.id,
        status: scheduled_publish_time ? 'SCHEDULED' : 'PUBLISHED',
        has_image: false,
        client: tenant.name || tenant.key,
        page: tenant.pageName || tenant.pageId,
        scheduled_for: scheduled_publish_time
          ? new Date(scheduled_publish_time * 1000).toISOString()
          : null,
      });
    }
  } catch (err) {
    if (err.error) {
      return res.status(err.status || 502).json(err);
    }
    return res.status(500).json({
      error: true,
      code: 'INTERNAL_ERROR',
      message: err.message || 'Erro interno',
    });
  }
};
