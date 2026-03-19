/**
 * /api/meta/media — Upload/criação de container de mídia
 *
 * POST {
 *   destination: "ig" | "fb",
 *   tenant: "starken" | "alpha",
 *   image_url: "https://...",         // URL pública da imagem
 *   media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM",
 *   caption: "...",                   // Opcional no container
 *   children: [{ image_url }]        // Apenas para CAROUSEL_ALBUM
 * }
 *
 * Retorna: container_id (IG) ou photo_id (FB)
 */

const { graphPost, graphGet } = require('./_lib/graph');
const { validateTenant } = require('./_lib/tenants');

const POLL_INTERVAL = 5000;
const POLL_MAX_ATTEMPTS = 12;

async function pollContainerStatus(containerId) {
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    const status = await graphGet(`/${containerId}`, { fields: 'status_code' });
    if (status.status_code === 'FINISHED') return true;
    if (status.status_code === 'ERROR') {
      throw { error: true, code: 'MEDIA_ERROR', message: 'Container de mídia falhou no processamento' };
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL));
  }
  throw { error: true, code: 'MEDIA_TIMEOUT', message: 'Timeout aguardando processamento da mídia (60s)' };
}

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

  const { destination, image_url, media_type, caption, children } = req.body || {};

  if (!destination || !['ig', 'fb'].includes(destination)) {
    return res.status(400).json({ error: true, code: 'MISSING_PARAM', message: 'destination deve ser "ig" ou "fb"' });
  }
  if (!image_url && media_type !== 'CAROUSEL_ALBUM') {
    return res.status(400).json({ error: true, code: 'MISSING_PARAM', message: 'image_url é obrigatório' });
  }

  try {
    // ─── INSTAGRAM ───
    if (destination === 'ig') {
      if (!tenant.igUserId) {
        return res.status(400).json({ error: true, code: 'MISSING_PARAM', message: `IG User ID não configurado para "${tenant.key}"` });
      }

      if (media_type === 'CAROUSEL_ALBUM') {
        // Criar containers filhos
        if (!children || !children.length) {
          return res.status(400).json({ error: true, code: 'MISSING_PARAM', message: 'children[] obrigatório para carrossel' });
        }

        const childIds = [];
        for (const child of children) {
          const childBody = {
            image_url: child.image_url,
            is_carousel_item: true,
          };
          if (tenant.pageAccessToken) childBody.access_token = tenant.pageAccessToken;
          const childRes = await graphPost(`/${tenant.igUserId}/media`, childBody);
          await pollContainerStatus(childRes.id);
          childIds.push(childRes.id);
        }

        // Criar container pai
        const carouselBody = {
          media_type: 'CAROUSEL',
          caption: caption || '',
          children: childIds.join(','),
        };
        if (tenant.pageAccessToken) carouselBody.access_token = tenant.pageAccessToken;
        const carouselRes = await graphPost(`/${tenant.igUserId}/media`, carouselBody);
        await pollContainerStatus(carouselRes.id);

        return res.status(201).json({
          container_id: carouselRes.id,
          type: 'CAROUSEL_ALBUM',
          children_count: childIds.length,
          status: 'FINISHED',
        });
      }

      // Single image/video/reel
      const body = { image_url };
      if (media_type === 'VIDEO' || media_type === 'REELS') {
        body.video_url = image_url;
        delete body.image_url;
        body.media_type = media_type === 'REELS' ? 'REELS' : 'VIDEO';
      }
      if (caption) body.caption = caption;
      if (tenant.pageAccessToken) body.access_token = tenant.pageAccessToken;

      const containerRes = await graphPost(`/${tenant.igUserId}/media`, body);
      await pollContainerStatus(containerRes.id);

      return res.status(201).json({
        container_id: containerRes.id,
        type: media_type || 'IMAGE',
        status: 'FINISHED',
      });
    }

    // ─── FACEBOOK ───
    if (destination === 'fb') {
      if (!tenant.pageId) {
        return res.status(400).json({ error: true, code: 'MISSING_PARAM', message: `Page ID não configurado para "${tenant.key}"` });
      }
      if (!tenant.pageAccessToken) {
        return res.status(400).json({ error: true, code: 'MISSING_PAGE_TOKEN', message: `Page Access Token não encontrado para "${tenant.name || tenant.key}". Re-descubra ativos na Configuração Meta.` });
      }

      // Upload foto como não publicada (para depois anexar ao post)
      const photoRes = await graphPost(`/${tenant.pageId}/photos`, {
        url: image_url,
        published: false,
        caption: caption || '',
        access_token: tenant.pageAccessToken,
      });

      return res.status(201).json({
        photo_id: photoRes.id,
        type: 'PHOTO',
        status: 'UPLOADED',
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
