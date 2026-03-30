/**
 * /api/meta/organic-insights — Relatório de posts orgânicos (sem anúncios)
 *
 * GET ?client=mortadella-blumenau&days=30
 *   → Posts do Facebook + Stories + Métricas
 *   → Posts do Instagram + Stories + Métricas
 */

const { graphGet } = require('./_lib/graph');
const { getClient } = require('./_lib/tenants');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const clientKey = req.query.client;
  const days = parseInt(req.query.days) || 30;

  if (!clientKey) {
    return res.status(400).json({ error: 'Need ?client=X' });
  }

  try {
    const client = await getClient(clientKey);
    const pageId = client.pageId;
    const igUserId = client.igUserId;

    if (!pageId && !igUserId) {
      return res.status(400).json({ error: 'Client has no Facebook page or Instagram account configured' });
    }

    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);
    const since = Math.floor(sinceDate.getTime() / 1000);

    const report = {
      client: clientKey,
      period: `Last ${days} days`,
      facebook: { posts: [], total_engagement: 0, total_reach: 0 },
      instagram: { posts: [], total_engagement: 0, total_reach: 0 },
    };

    // ─── Facebook Posts ──────────────────────────────────────────────────
    if (pageId) {
      try {
        const fbResult = await graphGet(`/${pageId}/feed`, {
          fields: 'id,message,story,type,created_time,permalink_url,shares,likes.summary(true).limit(0),comments.summary(true).limit(0),insights.metric(post_impressions,post_engaged_users,post_clicks)',
          since: since.toString(),
          limit: '50',
        });

        const fbPosts = fbResult.data || [];
        for (const post of fbPosts) {
          const likes = post.likes?.summary?.total_count || 0;
          const comments = post.comments?.summary?.total_count || 0;
          const shares = post.shares || 0;
          const engagement = likes + comments + shares;

          let impressions = 0;
          let clicks = 0;
          if (post.insights?.data) {
            const impData = post.insights.data.find(i => i.name === 'post_impressions');
            const clickData = post.insights.data.find(i => i.name === 'post_clicks');
            impressions = impData?.values?.[0]?.value || 0;
            clicks = clickData?.values?.[0]?.value || 0;
          }

          report.facebook.posts.push({
            id: post.id,
            message: (post.message || post.story || '').substring(0, 200),
            type: post.type,
            created_at: post.created_time,
            url: post.permalink_url,
            likes,
            comments,
            shares,
            engagement,
            impressions,
            clicks,
          });

          report.facebook.total_engagement += engagement;
          report.facebook.total_reach += impressions;
        }
      } catch (fbErr) {
        report.facebook.error = fbErr.message || String(fbErr).substring(0, 200);
      }
    }

    // ─── Instagram Posts ────────────────────────────────────────────────────
    if (igUserId) {
      try {
        const igResult = await graphGet(`/${igUserId}/media`, {
          fields: 'id,caption,media_type,timestamp,permalink,like_count,comments_count,insights.metric(engagement,impressions,reach)',
          limit: '50',
        });

        const igPosts = igResult.data || [];
        for (const post of igPosts) {
          const postDate = new Date(post.timestamp);
          if (postDate.getTime() / 1000 < since) continue; // Skip if before since date

          const likes = post.like_count || 0;
          const comments = post.comments_count || 0;
          const engagement = likes + comments;

          let impressions = 0;
          let reach = 0;
          if (post.insights?.data) {
            const impData = post.insights.data.find(i => i.name === 'impressions');
            const reachData = post.insights.data.find(i => i.name === 'reach');
            impressions = impData?.values?.[0]?.value || 0;
            reach = reachData?.values?.[0]?.value || 0;
          }

          report.instagram.posts.push({
            id: post.id,
            caption: (post.caption || '').substring(0, 200),
            type: post.media_type,
            created_at: post.timestamp,
            url: post.permalink,
            likes,
            comments,
            engagement,
            impressions,
            reach,
          });

          report.instagram.total_engagement += engagement;
          report.instagram.total_reach += reach;
        }
      } catch (igErr) {
        report.instagram.error = igErr.message || String(igErr).substring(0, 200);
      }
    }

    return res.status(200).json(report);
  } catch (err) {
    return res.status(500).json({ error: err.message || String(err).substring(0, 300) });
  }
};
