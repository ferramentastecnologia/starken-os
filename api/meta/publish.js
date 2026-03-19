/**
 * /api/meta/publish — Publicar/agendar post + Histórico centralizado
 *
 * GET  — Retorna histórico de publicações (Supabase: publish_history)
 *   ?limit=50  — número de registros (default 50)
 *   ?client=   — filtrar por client_key
 *   ?status=   — filtrar por PUBLISHED | SCHEDULED
 *
 * POST — Publica ou agenda post no IG/FB e salva no histórico
 *   { destination, client, caption, type, image_url, scheduled_publish_time, user }
 */

const { graphPost, graphPostForm, graphDelete } = require('./_lib/graph');
const { validateTenant } = require('./_lib/tenants');

// ─── Supabase helpers ───
const SUPABASE_URL = () => process.env.SUPABASE_URL || '';
const SUPABASE_KEY = () => process.env.SUPABASE_SERVICE_KEY || '';

function supabaseHeaders() {
  const key = SUPABASE_KEY();
  return { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' };
}

async function saveToHistory(record) {
  const url = SUPABASE_URL();
  if (!url) return; // Silently skip if no Supabase
  try {
    await fetch(`${url}/rest/v1/publish_history`, {
      method: 'POST',
      headers: supabaseHeaders(),
      body: JSON.stringify(record),
    });
  } catch (e) {
    console.warn('History save failed:', e.message);
  }
}

async function loadHistory(query) {
  const url = SUPABASE_URL();
  if (!url) return [];
  try {
    const limit = query.limit || 50;
    let endpoint = `${url}/rest/v1/publish_history?select=*&order=created_at.desc&limit=${limit}`;
    if (query.client) endpoint += `&client_key=eq.${query.client}`;
    if (query.status) endpoint += `&status=eq.${query.status}`;

    const res = await fetch(endpoint, {
      headers: { 'apikey': SUPABASE_KEY(), 'Authorization': `Bearer ${SUPABASE_KEY()}` },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    return [];
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ─── GET: Histórico de publicações ───
  if (req.method === 'GET') {
    const history = await loadHistory(req.query || {});
    return res.status(200).json({ history, count: history.length });
  }

  // ─── DELETE: Cancelar/excluir post do Meta ───
  if (req.method === 'DELETE') {
    const { post_id, history_id, client, user } = req.body || {};

    if (!post_id) {
      return res.status(400).json({ error: true, code: 'MISSING_PARAM', message: 'post_id é obrigatório' });
    }

    try {
      // Tenta pegar page access token do cliente (se informado)
      let pageToken = null;
      if (client) {
        try {
          const { getClient } = require('./_lib/tenants');
          const clientData = await getClient(client);
          if (clientData) pageToken = clientData.pageAccessToken;
        } catch (e) { /* usa token global */ }
      }

      // Deleta do Meta Graph API (funciona para publicados e agendados)
      const deleteParams = {};
      if (pageToken) deleteParams.access_token = pageToken;
      await graphDelete(`/${post_id}`, deleteParams);

      // Atualiza status no histórico (Supabase)
      if (history_id) {
        const url = SUPABASE_URL();
        if (url) {
          await fetch(`${url}/rest/v1/publish_history?id=eq.${history_id}`, {
            method: 'PATCH',
            headers: { ...supabaseHeaders(), 'Prefer': 'return=minimal' },
            body: JSON.stringify({ status: 'DELETED' }),
          });
        }
      }

      return res.status(200).json({
        ok: true,
        deleted: post_id,
        message: 'Post excluído/cancelado com sucesso no Meta',
      });
    } catch (err) {
      if (err.error) return res.status(err.status || 502).json(err);
      return res.status(500).json({ error: true, code: 'DELETE_ERROR', message: err.message });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: true, code: 'METHOD_NOT_ALLOWED', message: 'Use GET, POST ou DELETE' });
  }

  const tenant = await validateTenant(req, res);
  if (!tenant) return;

  const { destination, caption, type, container_id, photo_ids, scheduled_publish_time, image_url, user } = req.body || {};

  if (!destination || !['ig', 'fb'].includes(destination)) {
    return res.status(400).json({ error: true, code: 'MISSING_PARAM', message: 'destination deve ser "ig" ou "fb"' });
  }

  try {
    // ─── INSTAGRAM ───
    if (destination === 'ig') {
      if (!tenant.igUserId) {
        return res.status(400).json({
          error: true, code: 'MISSING_PARAM',
          message: `IG User ID não configurado para "${tenant.name || tenant.key}".`,
        });
      }

      const igToken = tenant.pageAccessToken || undefined;
      const image_urls = req.body.image_urls || [];
      let publishedId;

      // ─── IG CARROSSEL (múltiplas imagens) ───
      if (image_urls.length > 1) {
        // Step 1: Create individual media containers (is_carousel_item)
        const childIds = [];
        for (const url of image_urls) {
          const itemRes = await graphPost(`/${tenant.igUserId}/media`, {
            image_url: url,
            is_carousel_item: true,
            ...(igToken && { access_token: igToken }),
          });
          childIds.push(itemRes.id);
        }

        // Step 2: Create carousel container
        const carouselRes = await graphPost(`/${tenant.igUserId}/media`, {
          media_type: 'CAROUSEL',
          children: childIds.join(','),
          caption: caption || '',
          ...(igToken && { access_token: igToken }),
        });

        // Step 3: Publish carousel
        const pubRes = await graphPost(`/${tenant.igUserId}/media_publish`, {
          creation_id: carouselRes.id,
          ...(igToken && { access_token: igToken }),
        });
        publishedId = pubRes.id;
      }
      // ─── IG IMAGEM ÚNICA (via container_id ou image_url) ───
      else if (container_id) {
        const pubBody = { creation_id: container_id };
        if (igToken) pubBody.access_token = igToken;
        const pubRes = await graphPost(`/${tenant.igUserId}/media_publish`, pubBody);
        publishedId = pubRes.id;
      }
      // ─── IG IMAGEM ÚNICA via URL direta ───
      else if (image_url) {
        const mediaRes = await graphPost(`/${tenant.igUserId}/media`, {
          image_url: image_url,
          caption: caption || '',
          ...(igToken && { access_token: igToken }),
        });
        const pubRes = await graphPost(`/${tenant.igUserId}/media_publish`, {
          creation_id: mediaRes.id,
          ...(igToken && { access_token: igToken }),
        });
        publishedId = pubRes.id;
      }
      else {
        return res.status(400).json({
          error: true, code: 'MISSING_PARAM',
          message: 'Instagram requer imagem. Envie image_url, image_urls[] ou container_id.',
        });
      }

      const result = {
        post_id: publishedId,
        status: 'PUBLISHED',
        client: tenant.name || tenant.key,
        photo_count: image_urls.length > 1 ? image_urls.length : 1,
      };

      // Salva no histórico
      await saveToHistory({
        user_name: user || 'Sistema',
        client_key: req.body.client || tenant.key,
        client_name: tenant.name || tenant.key,
        platform: 'ig',
        status: 'PUBLISHED',
        post_id: publishedId,
        caption: caption || '',
        has_image: true,
        image_url: image_url || (image_urls[0] || null),
      });

      return res.status(201).json(result);
    }

    // ─── FACEBOOK ───
    if (destination === 'fb') {
      if (!tenant.pageId) {
        return res.status(400).json({
          error: true, code: 'MISSING_PARAM',
          message: `Page ID não configurado para "${tenant.name || tenant.key}".`,
        });
      }

      if (!tenant.pageAccessToken) {
        return res.status(400).json({
          error: true, code: 'MISSING_PAGE_TOKEN',
          message: `Page Access Token não encontrado para "${tenant.name || tenant.key}". Re-descubra ativos na Configuração Meta.`,
        });
      }

      let result;
      const image_urls = req.body.image_urls || [];

      // ─── CARROSSEL (múltiplas imagens) ───
      if (image_urls.length > 1) {
        // Upload all as unpublished photos
        const photoIds = [];
        for (const url of image_urls) {
          const photoRes = await graphPost(`/${tenant.pageId}/photos`, {
            url: url,
            published: false,
            access_token: tenant.pageAccessToken,
          });
          photoIds.push(photoRes.id);
        }

        // Create post with attached_media
        const postBody = {
          message: caption || '',
          access_token: tenant.pageAccessToken,
        };
        photoIds.forEach((pid, i) => {
          postBody[`attached_media[${i}]`] = JSON.stringify({ media_fbid: pid });
        });

        if (scheduled_publish_time) {
          postBody.scheduled_publish_time = scheduled_publish_time;
          postBody.published = false;
        }

        const postRes = await graphPostForm(`/${tenant.pageId}/feed`, postBody);

        result = {
          post_id: postRes.id,
          status: scheduled_publish_time ? 'SCHEDULED' : 'PUBLISHED',
          has_image: true,
          photo_count: photoIds.length,
          client: tenant.name || tenant.key,
          page: tenant.pageName || tenant.pageId,
          ...(scheduled_publish_time && { scheduled_for: new Date(scheduled_publish_time * 1000).toISOString() }),
        };
      }
      // ─── COM IMAGEM ÚNICA ───
      else if (image_url) {

        // PUBLICAR AGORA com imagem
        if (!scheduled_publish_time) {
          const photoRes = await graphPost(`/${tenant.pageId}/photos`, {
            url: image_url,
            caption: caption || '',
            access_token: tenant.pageAccessToken,
          });

          result = {
            post_id: photoRes.id || photoRes.post_id,
            status: 'PUBLISHED',
            has_image: true,
            client: tenant.name || tenant.key,
            page: tenant.pageName || tenant.pageId,
          };
        } else {
          // AGENDAR com imagem: upload não-publicado + feed com attached_media
          const uploadRes = await graphPost(`/${tenant.pageId}/photos`, {
            url: image_url,
            published: false,
            access_token: tenant.pageAccessToken,
          });

          const schedRes = await graphPostForm(`/${tenant.pageId}/feed`, {
            message: caption || '',
            'attached_media[0]': JSON.stringify({ media_fbid: uploadRes.id }),
            scheduled_publish_time: scheduled_publish_time,
            published: 'false',
            access_token: tenant.pageAccessToken,
          });

          result = {
            post_id: schedRes.id,
            status: 'SCHEDULED',
            has_image: true,
            photo_id: uploadRes.id,
            client: tenant.name || tenant.key,
            page: tenant.pageName || tenant.pageId,
            scheduled_for: new Date(scheduled_publish_time * 1000).toISOString(),
          };
        }
      }
      // ─── SEM IMAGEM ───
      else {
        const postBody = {
          message: caption || '',
          access_token: tenant.pageAccessToken,
        };

        if (scheduled_publish_time) {
          postBody.scheduled_publish_time = scheduled_publish_time;
          postBody.published = false;
        }

        const postRes = await graphPost(`/${tenant.pageId}/feed`, postBody);

        result = {
          post_id: postRes.id,
          status: scheduled_publish_time ? 'SCHEDULED' : 'PUBLISHED',
          has_image: false,
          client: tenant.name || tenant.key,
          page: tenant.pageName || tenant.pageId,
          scheduled_for: scheduled_publish_time
            ? new Date(scheduled_publish_time * 1000).toISOString()
            : null,
        };
      }

      // Salva no histórico (Supabase)
      await saveToHistory({
        user_name: user || 'Sistema',
        client_key: req.body.client || tenant.key,
        client_name: tenant.name || tenant.key,
        platform: 'fb',
        status: result.status,
        post_id: result.post_id,
        caption: caption || '',
        has_image: result.has_image || false,
        image_url: image_url || null,
        scheduled_for: result.scheduled_for || null,
      });

      return res.status(201).json(result);
    }
  } catch (err) {
    // Salva erro no histórico
    await saveToHistory({
      user_name: (req.body || {}).user || 'Sistema',
      client_key: (req.body || {}).client || tenant.key,
      client_name: tenant.name || tenant.key,
      platform: destination,
      status: 'FAILED',
      caption: caption || '',
      has_image: !!image_url,
    });

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
