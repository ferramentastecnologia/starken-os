/**
 * /api/meta/organic-insights — Relatório de posts orgânicos (sem anúncios)
 *
 * GET ?client=mortadella-blumenau&period=last_30d
 * GET ?client=mortadella-blumenau&month=2026-03  (specific month: YYYY-MM)
 * GET ?client=mortadella-blumenau&year=2026     (all months in year)
 *
 * Períodos suportados:
 *   last_7d, last_30d, last_90d, last_year
 *   2026-03 (mês específico)
 *   2026 (ano inteiro)
 */

const { graphGet } = require('./_lib/graph');
const { getClient } = require('./_lib/tenants');

function getDateRange(period, month, year) {
  let since, until;

  if (month) {
    // Format: 2026-03
    const [y, m] = month.split('-');
    since = new Date(parseInt(y), parseInt(m) - 1, 1);
    until = new Date(parseInt(y), parseInt(m), 0, 23, 59, 59);
  } else if (year) {
    // Format: 2026
    const y = parseInt(year);
    since = new Date(y, 0, 1);
    until = new Date(y, 11, 31, 23, 59, 59);
  } else {
    // Default periods
    until = new Date();
    switch (period || 'last_30d') {
      case 'last_7d':
        since = new Date(until);
        since.setDate(since.getDate() - 7);
        break;
      case 'last_90d':
        since = new Date(until);
        since.setDate(since.getDate() - 90);
        break;
      case 'last_year':
        since = new Date(until);
        since.setFullYear(since.getFullYear() - 1);
        break;
      default: // last_30d
        since = new Date(until);
        since.setDate(since.getDate() - 30);
    }
  }

  return {
    since: Math.floor(since.getTime() / 1000),
    until: Math.floor(until.getTime() / 1000),
    label: month || year || period || 'last_30d',
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const clientKey = req.query.client;
  const period = req.query.period;
  const month = req.query.month;
  const year = req.query.year;

  if (!clientKey) {
    return res.status(400).json({ error: 'Need ?client=X&period=last_30d (or &month=2026-03 or &year=2026)' });
  }

  try {
    const client = await getClient(clientKey);
    const pageId = client.pageId;
    const igUserId = client.igUserId;

    if (!pageId && !igUserId) {
      return res.status(400).json({ error: 'Client has no Facebook page or Instagram account configured' });
    }

    const dateRange = getDateRange(period, month, year);
    const since = dateRange.since;
    const until = dateRange.until;

    const report = {
      client: clientKey,
      period: dateRange.label,
      date_range: {
        since: new Date(since * 1000).toISOString().split('T')[0],
        until: new Date(until * 1000).toISOString().split('T')[0],
      },
      facebook: { posts: [], total_engagement: 0, total_reach: 0, total_impressions: 0 },
      instagram: { posts: [], total_engagement: 0, total_reach: 0, total_impressions: 0 },
    };

    // ─── Facebook Posts ──────────────────────────────────────────────────
    if (pageId) {
      try {
        // Try with page token first (simpler fields)
        const fbResult = await graphGet(`/${pageId}/posts`, {
          fields: 'id,message,story,type,created_time,permalink_url,shares,likes.summary(true).limit(0),comments.summary(true).limit(0)',
          since: since.toString(),
          until: until.toString(),
          limit: '50',
        });

        const fbPosts = fbResult.data || [];
        for (const post of fbPosts) {
          const likes = post.likes?.summary?.total_count || 0;
          const comments = post.comments?.summary?.total_count || 0;
          const shares = post.shares || 0;
          const engagement = likes + comments + shares;

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
            impressions: 0, // Not available without page insights permission
            clicks: 0,
          });

          report.facebook.total_engagement += engagement;
        }
      } catch (fbErr) {
        report.facebook.error = fbErr.message || String(fbErr).substring(0, 200);
      }
    }

    // ─── Instagram Posts ────────────────────────────────────────────────────
    if (igUserId) {
      try {
        const igResult = await graphGet(`/${igUserId}/media`, {
          fields: 'id,caption,media_type,timestamp,permalink,like_count,comments_count',
          limit: '100',
        });

        const igPosts = igResult.data || [];
        for (const post of igPosts) {
          const postDate = new Date(post.timestamp);
          const postTimestamp = Math.floor(postDate.getTime() / 1000);

          // Filter by date range
          if (postTimestamp < since || postTimestamp > until) continue;

          const likes = post.like_count || 0;
          const comments = post.comments_count || 0;
          const engagement = likes + comments;

          report.instagram.posts.push({
            id: post.id,
            caption: (post.caption || '').substring(0, 200),
            type: post.media_type,
            created_at: post.timestamp,
            url: post.permalink,
            likes,
            comments,
            engagement,
          });

          report.instagram.total_engagement += engagement;
        }

        // Try to get insights if available
        try {
          const insightsResult = await graphGet(`/${igUserId}/insights`, {
            metric: 'impressions,reach,profile_views',
            period: 'day',
            since: since.toString(),
            until: until.toString(),
          });
          if (insightsResult.data) {
            report.instagram.account_insights = insightsResult.data;
          }
        } catch (insightErr) {
          // Silently fail - insights may not be available
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
