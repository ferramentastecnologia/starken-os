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

    // 3. Get image URLs from source account (used directly in creatives — no re-upload needed)
    let hashToUrl = {};
    if (allHashes.size > 0) {
      const hashArray = [...allHashes];
      const imgResult = await graphGet(`/${sourceAdAccount}/adimages`, {
        hashes: JSON.stringify(hashArray),
        fields: 'hash,url,url_128,permalink_url',
      });

      const images = imgResult.data || [];
      if (Array.isArray(images)) {
        images.forEach(img => {
          hashToUrl[img.hash] = img.url || img.permalink_url || img.url_128;
        });
      } else if (typeof images === 'object') {
        for (const [hash, imgData] of Object.entries(images)) {
          hashToUrl[hash] = (typeof imgData === 'object')
            ? (imgData.url || imgData.permalink_url || imgData.url_128)
            : imgData;
        }
      }
    }

    // 4. Try to upload images to target account; fallback to URL-based creatives
    const hashMapping = {}; // old hash -> new hash (null = use URL instead)
    const uploadErrors = [];
    let useUrlFallback = false;

    for (const [oldHash, url] of Object.entries(hashToUrl)) {
      try {
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
        throw new Error('copy_from did not return hash');
      } catch (copyErr) {
        try {
          const uploadResult = await graphPostForm(`/${targetAdAccount}/adimages`, { url });
          const uploaded = uploadResult.images;
          if (uploaded) {
            const firstKey = Object.keys(uploaded)[0];
            if (firstKey && uploaded[firstKey].hash) {
              hashMapping[oldHash] = uploaded[firstKey].hash;
              continue;
            }
          }
          throw new Error('URL upload returned no hash');
        } catch (uploadErr) {
          hashMapping[oldHash] = null;
          useUrlFallback = true;
          uploadErrors.push({ hash: oldHash, error: uploadErr.message || String(uploadErr).substring(0, 200) });
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

        // Remap image hashes to new hashes in target account
        const newImages = (spec.images || []).map(img => {
          const newHash = hashMapping[img.hash];
          if (!newHash) return null; // Only include successfully mapped images
          return { hash: newHash }; // Clean: only hash, no adlabels
        }).filter(Boolean);

        // Determine creative type
        let newCreative;
        const firstImageUrl = hashToUrl[Object.keys(hashToUrl)[0]];

        // If image upload succeeded: use asset_feed_spec (carousel format)
        if (newImages.length > 0) {
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

          if (spec.additional_data) {
            newSpec.additional_data = spec.additional_data;
          }

          const storySpec = {
            page_id: targetClientObj.pageId || ad.creative.object_story_spec?.page_id,
            instagram_user_id: targetClientObj.igUserId || ad.creative.object_story_spec?.instagram_user_id,
          };

          try {
            newCreative = await graphPostForm(`/${targetAdAccount}/adcreatives`, {
              name: ad.creative.name || ad.name,
              object_story_spec: storySpec,
              asset_feed_spec: newSpec,
            });
          } catch (creativeErr) {
            throw new Error(`Asset feed creative failed: ${creativeErr.message}`);
          }
        }
        // Fallback: use simple object_story_spec with image_url
        else if (useUrlFallback && firstImageUrl) {
          const storySpec = {
            page_id: targetClientObj.pageId || ad.creative.object_story_spec?.page_id,
            link_data: {
              message: ad.creative.object_story_spec?.link_data?.message || ad.name,
              link: ad.creative.object_story_spec?.link_data?.link || 'https://example.com',
              image_hash: firstImageUrl, // Can use URL here
              name: spec.bodies?.[0]?.text || ad.creative.name || ad.name,
              description: spec.descriptions?.[0]?.text || '',
              caption: spec.titles?.[0]?.text || '',
            },
            instagram_user_id: targetClientObj.igUserId || ad.creative.object_story_spec?.instagram_user_id,
          };

          try {
            newCreative = await graphPostForm(`/${targetAdAccount}/adcreatives`, {
              name: ad.creative.name || ad.name,
              object_story_spec: storySpec,
            });
          } catch (creativeErr) {
            throw new Error(`URL fallback creative failed: ${creativeErr.message}`);
          }
        } else {
          throw new Error('No images available for creative');
        }

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
          error_code: adErr.code,
          error_status: adErr.status,
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
      used_url_fallback: useUrlFallback,
      upload_errors: uploadErrors,
      hash_mapping: hashMapping,
      ads: results,
    });

  } catch (err) {
    if (err.error) return res.status(err.status || 502).json(err);
    return res.status(500).json({ error: true, code: 'INTERNAL_ERROR', message: err.message });
  }
};
