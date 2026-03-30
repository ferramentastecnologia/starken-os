/**
 * /api/meta/organic-report — Relatório consolidado de posts + stories (última análise)
 *
 * GET ?client=mortadella-blumenau&format=json (default)
 * GET ?client=mortadella-blumenau&format=html
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
  const format = req.query.format || 'json';

  if (!clientKey) {
    return res.status(400).json({ error: 'Need ?client=X' });
  }

  try {
    const client = await getClient(clientKey);
    const igUserId = client.igUserId;
    const pageId = client.pageId;

    if (!igUserId && !pageId) {
      return res.status(400).json({ error: 'Client has no Instagram or Facebook configured' });
    }

    const report = {
      client: clientKey,
      client_name: client.name,
      generated_at: new Date().toISOString(),
      period: 'Last 90 days',
      posts: {
        instagram: { count: 0, total_engagement: 0, total_likes: 0, total_comments: 0, total_shares: 0, avg_engagement: 0, items: [] },
        facebook: { count: 0, total_engagement: 0, total_likes: 0, total_comments: 0, total_shares: 0, avg_engagement: 0, items: [] },
      },
      stories: {
        instagram: { count: 0, total_replies: 0, items: [] },
        facebook: { count: 0, total_engagement: 0, items: [] },
      },
    };

    // ─── Instagram Posts ──────────────────────────────────────────────────
    if (igUserId) {
      try {
        const igResult = await graphGet(`/${igUserId}/media`, {
          fields: 'id,caption,media_type,timestamp,permalink,like_count,comments_count',
          limit: '100',
        });

        const now = Date.now();
        const since90days = now - (90 * 24 * 60 * 60 * 1000);

        const igPosts = (igResult.data || []).filter(p => new Date(p.timestamp).getTime() >= since90days);

        for (const post of igPosts) {
          const likes = post.like_count || 0;
          const comments = post.comments_count || 0;
          const engagement = likes + comments;

          report.posts.instagram.items.push({
            id: post.id,
            caption: (post.caption || '').substring(0, 100),
            type: post.media_type,
            date: post.timestamp.split('T')[0],
            likes,
            comments,
            engagement,
            url: post.permalink,
          });

          report.posts.instagram.count += 1;
          report.posts.instagram.total_engagement += engagement;
          report.posts.instagram.total_likes += likes;
          report.posts.instagram.total_comments += comments;
        }

        if (report.posts.instagram.count > 0) {
          report.posts.instagram.avg_engagement = (report.posts.instagram.total_engagement / report.posts.instagram.count).toFixed(2);
        }
      } catch (igErr) {
        report.posts.instagram.error = igErr.message;
      }
    }

    // ─── Instagram Stories ──────────────────────────────────────────────────
    if (igUserId) {
      try {
        const storiesResult = await graphGet(`/${igUserId}/stories`, {
          fields: 'id,media_type,timestamp,caption,insights.metric(impressions,replies)',
          limit: '100',
        });

        const stories = storiesResult.data || [];
        for (const story of stories) {
          let replies = 0;
          if (story.insights?.data) {
            const repliesData = story.insights.data.find(i => i.name === 'replies');
            replies = repliesData?.values?.[0]?.value || 0;
          }

          report.stories.instagram.items.push({
            id: story.id,
            type: story.media_type,
            date: story.timestamp.split('T')[0],
            replies,
          });

          report.stories.instagram.count += 1;
          report.stories.instagram.total_replies += replies;
        }
      } catch (storiesErr) {
        report.stories.instagram.error = storiesErr.message;
      }
    }

    // ─── Facebook Posts ──────────────────────────────────────────────────
    if (pageId) {
      try {
        const fbResult = await graphGet(`/${pageId}/posts`, {
          fields: 'id,message,story,type,created_time,permalink_url,shares,likes.summary(true).limit(0),comments.summary(true).limit(0)',
          limit: '100',
        });

        const fbPosts = fbResult.data || [];
        for (const post of fbPosts) {
          const likes = post.likes?.summary?.total_count || 0;
          const comments = post.comments?.summary?.total_count || 0;
          const shares = post.shares || 0;
          const engagement = likes + comments + shares;

          report.posts.facebook.items.push({
            id: post.id,
            message: (post.message || post.story || '').substring(0, 100),
            type: post.type,
            date: post.created_time.split('T')[0],
            likes,
            comments,
            shares,
            engagement,
            url: post.permalink_url,
          });

          report.posts.facebook.count += 1;
          report.posts.facebook.total_engagement += engagement;
          report.posts.facebook.total_likes += likes;
          report.posts.facebook.total_comments += comments;
          report.posts.facebook.total_shares += shares;
        }

        if (report.posts.facebook.count > 0) {
          report.posts.facebook.avg_engagement = (report.posts.facebook.total_engagement / report.posts.facebook.count).toFixed(2);
        }
      } catch (fbErr) {
        report.posts.facebook.error = fbErr.message;
      }
    }

    if (format === 'html') {
      // Generate HTML report
      const html = generateHtmlReport(report);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(html);
    }

    return res.status(200).json(report);
  } catch (err) {
    return res.status(500).json({ error: err.message || String(err).substring(0, 300) });
  }
};

function generateHtmlReport(report) {
  const igPosts = report.posts.instagram;
  const fbPosts = report.posts.facebook;
  const igStories = report.stories.instagram;

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório Orgânico - ${report.client_name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', -apple-system, sans-serif; background: #f5f5f5; color: #333; line-height: 1.6; }
    .container { max-width: 1200px; margin: 0 auto; padding: 40px 20px; }
    header { background: #2c3e50; color: white; padding: 40px 0; margin-bottom: 40px; text-align: center; }
    h1 { font-size: 2.5rem; margin-bottom: 10px; }
    .subtitle { font-size: 0.9rem; opacity: 0.9; }
    .section { background: white; padding: 30px; margin-bottom: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h2 { color: #2c3e50; font-size: 1.8rem; margin-bottom: 20px; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .metric { background: #ecf0f1; padding: 20px; border-radius: 8px; text-align: center; }
    .metric-value { font-size: 2rem; font-weight: bold; color: #3498db; }
    .metric-label { font-size: 0.9rem; color: #7f8c8d; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background: #34495e; color: white; padding: 12px; text-align: left; }
    td { padding: 12px; border-bottom: 1px solid #ecf0f1; }
    tr:hover { background: #f9f9f9; }
    .empty { color: #95a5a6; font-style: italic; }
    footer { text-align: center; margin-top: 60px; padding-top: 20px; border-top: 1px solid #ecf0f1; color: #7f8c8d; font-size: 0.9rem; }
  </style>
</head>
<body>
  <header>
    <h1>${report.client_name}</h1>
    <p class="subtitle">Relatório de Engajamento Orgânico - Últimos 90 Dias</p>
    <p class="subtitle">Gerado em ${new Date(report.generated_at).toLocaleDateString('pt-BR')} às ${new Date(report.generated_at).toLocaleTimeString('pt-BR')}</p>
  </header>

  <div class="container">
    ${igPosts.count > 0 ? `
      <div class="section">
        <h2>📱 Posts Instagram</h2>
        <div class="metrics">
          <div class="metric">
            <div class="metric-value">${igPosts.count}</div>
            <div class="metric-label">Posts Publicados</div>
          </div>
          <div class="metric">
            <div class="metric-value">${igPosts.total_engagement}</div>
            <div class="metric-label">Engajamentos Totais</div>
          </div>
          <div class="metric">
            <div class="metric-value">${igPosts.total_likes}</div>
            <div class="metric-label">Likes</div>
          </div>
          <div class="metric">
            <div class="metric-value">${igPosts.total_comments}</div>
            <div class="metric-label">Comentários</div>
          </div>
          <div class="metric">
            <div class="metric-value">${igPosts.avg_engagement}</div>
            <div class="metric-label">Eng. Médio por Post</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Tipo</th>
              <th>Caption (primeiras 100 chars)</th>
              <th>Likes</th>
              <th>Comments</th>
              <th>Engajamento</th>
            </tr>
          </thead>
          <tbody>
            ${igPosts.items.sort((a, b) => new Date(b.date) - new Date(a.date)).map(p => `
              <tr>
                <td>${p.date}</td>
                <td>${p.type}</td>
                <td>${p.caption || '(sem texto)'}</td>
                <td>${p.likes}</td>
                <td>${p.comments}</td>
                <td><strong>${p.engagement}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : '<div class="section"><p class="empty">Nenhum post encontrado no Instagram</p></div>'}

    ${fbPosts.count > 0 ? `
      <div class="section">
        <h2>📘 Posts Facebook</h2>
        <div class="metrics">
          <div class="metric">
            <div class="metric-value">${fbPosts.count}</div>
            <div class="metric-label">Posts Publicados</div>
          </div>
          <div class="metric">
            <div class="metric-value">${fbPosts.total_engagement}</div>
            <div class="metric-label">Engajamentos Totais</div>
          </div>
          <div class="metric">
            <div class="metric-value">${fbPosts.total_likes}</div>
            <div class="metric-label">Likes</div>
          </div>
          <div class="metric">
            <div class="metric-value">${fbPosts.total_comments}</div>
            <div class="metric-label">Comentários</div>
          </div>
          <div class="metric">
            <div class="metric-value">${fbPosts.total_shares}</div>
            <div class="metric-label">Compartilhamentos</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Tipo</th>
              <th>Mensagem</th>
              <th>Likes</th>
              <th>Comments</th>
              <th>Shares</th>
              <th>Engajamento</th>
            </tr>
          </thead>
          <tbody>
            ${fbPosts.items.sort((a, b) => new Date(b.date) - new Date(a.date)).map(p => `
              <tr>
                <td>${p.date}</td>
                <td>${p.type}</td>
                <td>${p.message || '(sem texto)'}</td>
                <td>${p.likes}</td>
                <td>${p.comments}</td>
                <td>${p.shares}</td>
                <td><strong>${p.engagement}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : '<div class="section"><p class="empty">Nenhum post encontrado no Facebook</p></div>'}

    ${igStories.count > 0 ? `
      <div class="section">
        <h2>📸 Stories Instagram</h2>
        <div class="metrics">
          <div class="metric">
            <div class="metric-value">${igStories.count}</div>
            <div class="metric-label">Stories Publicados</div>
          </div>
          <div class="metric">
            <div class="metric-value">${igStories.total_replies}</div>
            <div class="metric-label">Respostas Diretas</div>
          </div>
        </div>
        <p class="empty">Stories mais antigos foram removidos automaticamente (últimos 30 dias apenas)</p>
      </div>
    ` : '<div class="section"><p class="empty">Nenhuma story encontrada</p></div>'}
  </div>

  <footer>
    <p>Relatório gerado automaticamente pelo Starken OS</p>
  </footer>
</body>
</html>
  `;
}
