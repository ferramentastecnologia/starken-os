const { graphGet, graphPost } = require('./_lib/graph');
const { getClient } = require('./_lib/tenants');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const clientKey = req.query.client;
  const hashes = req.query.hashes; // comma-separated

  if (!clientKey || !hashes) {
    return res.status(400).json({ error: 'Need ?client=X&hashes=h1,h2' });
  }

  try {
    const client = await getClient(clientKey);
    const adAccount = client.adAccountIds[0];
    const hashArray = hashes.split(',');

    // Method 1: Get images by hash
    const result = await graphGet(`/${adAccount}/adimages`, {
      hashes: JSON.stringify(hashArray),
      fields: 'hash,url,url_128,permalink_url,name,width,height',
    });

    return res.json({
      ad_account: adAccount,
      raw_response_keys: Object.keys(result),
      data_type: typeof result.data,
      data_is_array: Array.isArray(result.data),
      data: result.data,
      images: result.images,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || err, raw: err });
  }
};
