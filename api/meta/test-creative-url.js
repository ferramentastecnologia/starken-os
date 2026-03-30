/**
 * Test creative creation with URL-based images (no hashes)
 * GET ?client=super-x-itapoa
 */

const { graphPostForm } = require('./_lib/graph');
const { getClient } = require('./_lib/tenants');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const clientKey = req.query.client;
  if (!clientKey) return res.status(400).json({ error: 'Need ?client=X' });

  try {
    const client = await getClient(clientKey);
    const targetAdAccount = client.adAccountIds[0];

    // Test URL from Guaratuba
    const testUrl = 'https://scontent-iad3-1.xx.fbcdn.net/v/t45.1600-4/645715677_10232869352581565_7110039229230739635_n.png?stp=dst-jpg_tt6';

    // Try creating creative with URL-based image
    const creative = await graphPostForm(`/${targetAdAccount}/adcreatives`, {
      name: 'TEST CREATIVE URL',
      object_story_spec: {
        page_id: client.pageId,
        link_data: {
          message: 'Test',
          link: 'https://example.com',
          image_hash: null, // explicitly no hash
        },
      },
      asset_feed_spec: {
        images: [
          {
            url: testUrl,
          },
        ],
        bodies: [{ text: 'Test body' }],
        call_to_action_types: ['LEARN_MORE'],
        titles: [{ text: 'Test title' }],
        descriptions: [{ text: 'Test desc' }],
        link_urls: [{ website_url: 'https://example.com', display_url: 'example.com' }],
        ad_formats: ['DESKTOP_FEED_STANDARD'],
      },
    });

    return res.json({
      success: true,
      creative_id: creative.id,
      creative,
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message || err,
      code: err.code,
      status: err.status,
      full: JSON.stringify(err).substring(0, 500),
    });
  }
};
