/**
 * /api/meta/copy-ads — Copia anúncios entre contas de anúncios
 *
 * POST ?client=super-x-itapoa
 *   body: {
 *     source_client: "super-x-guaratuba",
 *     source_adset_id: "120240421579960714",
 *     target_adset_id: "120249608877520777"
 *   }
 *
 * Fluxo:
 * 1. Busca ads do ad set de origem com criativos completos
 * 2. Para cada ad: busca image URLs pelos hashes na conta origem
 * 3. Re-sobe imagens na conta destino (obtém novos hashes)
 * 4. Cria creative com novos hashes + textos originais
 * 5. Cria ad vinculado ao ad set destino
 */

const { graphGet, graphPost, graphPostForm } = require('./_lib/graph');
const { getClient } = require('./_lib/tenants');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: true, code: 'METHOD_NOT_ALLOWED', message: 'Use POST' });
  }

  const { source_client, source_adset_id, target_adset_id } = req.body || {};
  const targetClientKey = req.query.client || req.body.target_client;

  if (!source_client || !source_adset_id || !target_adset_id || !targetClientKey) {
    return res.status(400).json({
      error: true, code: 'MISSING_PARAMS',
      message: 'Required: client (query), source_client, source_adset_id, target_adset_id',
    });
  }

  try {
    const sourceClientObj = await getClient(source_client);
    const targetClientObj = await getClient(targetClientKey);

    if (!sourceClientObj.adAccountIds.length || !targetClientObj.adAccountIds.length) {
      return res.status(400).json({ error: true, code: 'NO_AD_ACCOUNT', message: 'Both clients need ad accounts configured.' });
    }

    const sourceAdAccount = sourceClientObj.adAccountIds[0];
    const targetAdAccount = targetClientObj.adAccountIds[0];

    // 1. Get ads from source ad set
    const adsResult = await graphGet(`/${source_adset_id}/ads`, {
      fields: 'id,name,status,creative{id,name,object_story_spec,asset_feed_spec,url_tags}',
      limit: '50',
    });
    const sourceAds = adsResult.data || [];

    if (!sourceAds.length) {
      return res.status(404).json({ error: true, code: 'NO_ADS', message: 'No ads found in source ad set.' });
    }

    // 2. Collect all unique image hashes from source ads
    const allHashes = new Set();
    for (const ad of sourceAds) {
      const images = ad.creative?.asset_feed_spec?.images || [];
      images.forEach(img => { if (img.hash) allHashes.add(img.hash); });
    }

    // 3. Get image URLs from source account
    let hashToUrl = {};
    if (allHashes.size > 0) {
      const hashArray = [...allHashes];
      const imgResult = await graphGet(`/${sourceAdAccount}/adimages`, {
        hashes: JSON.stringify(hashArray),
        fields: 'hash,url,url_128,permalink_url',
      });

      const images = imgResult.data || [];
      // Meta returns images as array with hash, url, permalink_url fields
      if (Array.isArray(images)) {
        images.forEach(img => {
          hashToUrl[img.hash] = img.permalink_url || img.url || img.url_128;
        });
      } else if (typeof images === 'object') {
        // Fallback: keyed by hash
        for (const [hash, imgData] of Object.entries(images)) {
          hashToUrl[hash] = (typeof imgData === 'object')
            ? (imgData.permalink_url || imgData.url || imgData.url_128)
            : imgData;
        }
      }
    }

    // 4. Upload images to target account and get new hashes
    const hashMapping = {}; // old hash -> new hash
    const uploadErrors = [];
    for (const [oldHash, url] of Object.entries(hashToUrl)) {
      try {
        // Try copy_from (copies image between ad accounts using source hash)
        const copyResult = await graphPostForm(`/${targetAdAccount}/adimages`, {
          copy_from: `${sourceAdAccount}:${oldHash}`,
        });
        const copied = copyResult.images;
        if (copied) {
          const firstKey = Object.keys(copied)[0];
          if (firstKey && copied[firstKey].hash) {
            hashMapping[oldHash] = copied[firstKey].hash;
            continue;
          }
        }
        // If copy_from didn't return a hash, try URL upload as fallback
        throw new Error('copy_from did not return hash');
      } catch (copyErr) {
        // Fallback: upload via URL
        try {
          const uploadResult = await graphPostForm(`/${targetAdAccount}/adimages`, {
            url: url,
          });
          const uploaded = uploadResult.images;
          if (uploaded) {
            const firstKey = Object.keys(uploaded)[0];
            if (firstKey && uploaded[firstKey].hash) {
              hashMapping[oldHash] = uploaded[firstKey].hash;
              continue;
            }
          }
          hashMapping[oldHash] = null;
          uploadErrors.push({ hash: oldHash, error: 'Upload returned no hash', response: JSON.stringify(uploadResult).substring(0, 200) });
        } catch (uploadErr) {
          hashMapping[oldHash] = null;
          uploadErrors.push({ hash: oldHash, error: uploadErr.message || JSON.stringify(uploadErr).substring(0, 200) });
        }
      }
    }

    // 5. Create ads in target account
    const results = [];
    for (const ad of sourceAds) {
      try {
        const spec = ad.creative?.asset_feed_spec;
        if (!spec) {
          results.push({ source_ad: ad.name, status: 'skipped', reason: 'No asset_feed_spec' });
          continue;
        }

        // Remap image hashes
        const newImages = (spec.images || []).map(img => {
          const newHash = hashMapping[img.hash];
          if (!newHash) return null;
          return { ...img, hash: newHash, adlabels: undefined }; // Remove old adlabels
        }).filter(Boolean);

        if (newImages.length === 0) {
          results.push({ source_ad: ad.name, status: 'skipped', reason: 'No images could be transferred' });
          continue;
        }

        // Build new asset_feed_spec without adlabels (they're account-specific)
        const newSpec = {
          images: newImages,
          bodies: (spec.bodies || []).map(b => ({ text: b.text })),
          call_to_action_types: spec.call_to_action_types,
          titles: (spec.titles || []).map(t => ({ text: t.text })),
          descriptions: (spec.descriptions || []).map(d => ({ text: d.text })),
          link_urls: (spec.link_urls || []).map(l => ({
            website_url: l.website_url,
            display_url: l.display_url,
          })),
          ad_formats: spec.ad_formats,
          optimization_type: spec.optimization_type,
        };

        // Include additional_data (welcome messages, etc.)
        if (spec.additional_data) {
          newSpec.additional_data = spec.additional_data;
        }

        // Build object_story_spec with target page/ig
        const storySpec = {
          page_id: targetClientObj.pageId || ad.creative.object_story_spec?.page_id,
          instagram_user_id: targetClientObj.igUserId || ad.creative.object_story_spec?.instagram_user_id,
        };

        // Create creative (use form-urlencoded — Meta requires it for complex nested objects)
        const newCreative = await graphPostForm(`/${targetAdAccount}/adcreatives`, {
          name: ad.creative.name || ad.name,
          object_story_spec: storySpec,
          asset_feed_spec: newSpec,
        });

        // Create ad
        const newAd = await graphPostForm(`/${targetAdAccount}/ads`, {
          name: ad.name,
          adset_id: target_adset_id,
          creative: { creative_id: newCreative.id },
          status: 'PAUSED',
        });

        results.push({
          source_ad: ad.name,
          source_ad_id: ad.id,
          status: 'created',
          new_ad_id: newAd.id,
          new_creative_id: newCreative.id,
          images_copied: newImages.length,
        });
      } catch (adErr) {
        results.push({
          source_ad: ad.name,
          source_ad_id: ad.id,
          status: 'error',
          error: adErr.message || JSON.stringify(adErr),
        });
      }
    }

    return res.status(200).json({
      success: true,
      source_adset: source_adset_id,
      target_adset: target_adset_id,
      target_account: targetAdAccount,
      image_hashes_mapped: Object.keys(hashMapping).length,
      image_hashes_failed: Object.values(hashMapping).filter(v => !v).length,
      upload_errors: uploadErrors,
      hash_mapping: hashMapping,
      ads: results,
    });

  } catch (err) {
    if (err.error) return res.status(err.status || 502).json(err);
    return res.status(500).json({ error: true, code: 'INTERNAL_ERROR', message: err.message });
  }
};
