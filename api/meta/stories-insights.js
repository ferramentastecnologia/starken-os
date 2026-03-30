/**
 * /api/meta/stories-insights — Relatório de stories postados
 *
 * GET ?client=mortadella-blumenau&month=2026-03
 *   → Stories do Instagram (até 30 dias no histórico)
 *   → Facebook stories (se houver acesso)
 */

const { graphGet } = require('./_lib/graph');
const { getClient } = require('./_lib/tenants');

function getDateRange(period, month, year) {
  let since, until;

  if (month) {
    const [y, m] = month.split('-');
    since = new Date(parseInt(y), parseInt(m) - 1, 1);
    until = new Date(parseInt(y), parseInt(m), 0, 23, 59, 59);
  } else if (year) {
    const y = parseInt(year);
    since = new Date(y, 0, 1);
    until = new Date(y, 11, 31, 23, 59, 59);
  } else {
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
      default:
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
    return res.status(400).json({ error: 'Need ?client=X&month=2026-03 (or &period=last_30d or &year=2026)' });
  }

  try {
    const client = await getClient(clientKey);
    const igUserId = client.igUserId;
    const pageId = client.pageId;

    if (!igUserId && !pageId) {
      return res.status(400).json({ error: 'Client has no Instagram or Facebook configured' });
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
      instagram_stories: { stories: [], total_impressions: 0, total_exits: 0, total_replies: 0 },
      facebook_stories: { stories: [], total_engagement: 0 },
    };

    // ─── Instagram Stories ──────────────────────────────────────────────────
    if (igUserId) {
      try {
        // Get story media (IG Stories API)
        const storiesResult = await graphGet(`/${igUserId}/stories`, {
          fields: 'id,media_type,timestamp,caption,insights.metric(impressions,exits,replies,reach,taps_forward,taps_back)',
          limit: '100',
        });

        const stories = storiesResult.data || [];
        for (const story of stories) {
          const storyDate = new Date(story.timestamp);
          const storyTimestamp = Math.floor(storyDate.getTime() / 1000);

          // Filter by date range
          if (storyTimestamp < since || storyTimestamp > until) continue;

          let impressions = 0;
          let exits = 0;
          let replies = 0;
          let tapsForward = 0;
          let tapsBack = 0;

          if (story.insights?.data) {
            const impData = story.insights.data.find(i => i.name === 'impressions');
            const exitsData = story.insights.data.find(i => i.name === 'exits');
            const repliesData = story.insights.data.find(i => i.name === 'replies');
            const tapsForwardData = story.insights.data.find(i => i.name === 'taps_forward');
            const tapsBackData = story.insights.data.find(i => i.name === 'taps_back');

            impressions = impData?.values?.[0]?.value || 0;
            exits = exitsData?.values?.[0]?.value || 0;
            replies = repliesData?.values?.[0]?.value || 0;
            tapsForward = tapsForwardData?.values?.[0]?.value || 0;
            tapsBack = tapsBackData?.values?.[0]?.value || 0;
          }

          report.instagram_stories.stories.push({
            id: story.id,
            type: story.media_type,
            caption: (story.caption || '').substring(0, 200),
            created_at: story.timestamp,
            impressions,
            exits,
            replies,
            taps_forward: tapsForward,
            taps_back: tapsBack,
            engagement_rate: impressions > 0 ? ((exits + replies) / impressions * 100).toFixed(2) + '%' : '0%',
          });

          report.instagram_stories.total_impressions += impressions;
          report.instagram_stories.total_exits += exits;
          report.instagram_stories.total_replies += replies;
        }
      } catch (igErr) {
        report.instagram_stories.error = igErr.message || String(igErr).substring(0, 200);
      }
    }

    // ─── Facebook Stories ──────────────────────────────────────────────────
    if (pageId) {
      try {
        // Get page stories (if available)
        const fbStoriesResult = await graphGet(`/${pageId}/stories`, {
          fields: 'id,message,story,type,created_time,permalink_url,shares,likes.summary(true).limit(0),comments.summary(true).limit(0)',
          since: since.toString(),
          until: until.toString(),
          limit: '50',
        });

        const fbStories = fbStoriesResult.data || [];
        for (const story of fbStories) {
          const likes = story.likes?.summary?.total_count || 0;
          const comments = story.comments?.summary?.total_count || 0;
          const shares = story.shares || 0;
          const engagement = likes + comments + shares;

          report.facebook_stories.stories.push({
            id: story.id,
            message: (story.message || story.story || '').substring(0, 200),
            type: story.type,
            created_at: story.created_time,
            url: story.permalink_url,
            likes,
            comments,
            shares,
            engagement,
          });

          report.facebook_stories.total_engagement += engagement;
        }
      } catch (fbErr) {
        report.facebook_stories.error = fbErr.message || String(fbErr).substring(0, 200);
      }
    }

    // Summary
    report.summary = {
      total_ig_stories: report.instagram_stories.stories.length,
      total_fb_stories: report.facebook_stories.stories.length,
      ig_total_impressions: report.instagram_stories.total_impressions,
      ig_total_replies: report.instagram_stories.total_replies,
      fb_total_engagement: report.facebook_stories.total_engagement,
    };

    return res.status(200).json(report);
  } catch (err) {
    return res.status(500).json({ error: err.message || String(err).substring(0, 300) });
  }
};
