/**
 * Supabase Edge Function: google-ads
 * Proxies Google Ads REST API calls, handles OAuth2 token exchange server-side.
 *
 * GET /google-ads?customerId=8779278717&resource=campaigns&range=LAST_7_DAYS
 * GET /google-ads?customerId=8779278717&resource=audit&range=LAST_30_DAYS
 * GET /google-ads?customerId=8779278717&resource=keywords&range=LAST_7_DAYS
 * GET /google-ads?customerId=8779278717&resource=summary&range=TODAY
 */

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_ADS_BASE = 'https://googleads.googleapis.com/v21';

// Cache access token in memory (valid ~1h, edge function may restart)
let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry - 60000) return cachedToken;

  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      refresh_token: Deno.env.get('GOOGLE_REFRESH_TOKEN')!,
      grant_type: 'refresh_token',
    }),
  });

  const data = await resp.json();
  if (!data.access_token) throw new Error('Token exchange failed: ' + JSON.stringify(data));

  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
  return cachedToken!;
}

async function gadsQuery(customerId: string, query: string, accessToken: string): Promise<any[]> {
  const url = `${GOOGLE_ADS_BASE}/customers/${customerId}/googleAds:search`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'developer-token': Deno.env.get('GOOGLE_DEVELOPER_TOKEN')!,
      'login-customer-id': Deno.env.get('GOOGLE_LOGIN_CUSTOMER_ID')!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  const data = await resp.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data.results || [];
}

function dateRange(range: string): string {
  const rangeMap: Record<string, string> = {
    'TODAY': "segments.date DURING TODAY",
    'YESTERDAY': "segments.date DURING YESTERDAY",
    'LAST_7_DAYS': "segments.date DURING LAST_7_DAYS",
    'LAST_30_DAYS': "segments.date DURING LAST_30_DAYS",
    'THIS_MONTH': "segments.date DURING THIS_MONTH",
    'LAST_MONTH': "segments.date DURING LAST_MONTH",
  };
  return rangeMap[range] || "segments.date DURING LAST_7_DAYS";
}

// Campaigns: status, budget, spend, impressions, clicks, conversions, CPA
async function getCampaigns(customerId: string, range: string, token: string) {
  const query = `
    SELECT
      campaign.id, campaign.name, campaign.status,
      campaign.advertising_channel_type,
      campaign_budget.amount_micros,
      metrics.cost_micros, metrics.impressions, metrics.clicks,
      metrics.conversions, metrics.cost_per_conversion
    FROM campaign
    WHERE campaign.status IN ('ENABLED', 'PAUSED')
    AND ${dateRange(range)}
    ORDER BY metrics.cost_micros DESC
  `;
  const results = await gadsQuery(customerId, query, token);
  return results.map((r: any) => ({
    id: r.campaign?.id,
    name: r.campaign?.name,
    status: r.campaign?.status,
    type: r.campaign?.advertisingChannelType,
    budget_brl: (r.campaignBudget?.amountMicros || 0) / 1e6,
    spend_brl: (r.metrics?.costMicros || 0) / 1e6,
    impressions: r.metrics?.impressions || 0,
    clicks: r.metrics?.clicks || 0,
    conversions: parseFloat(r.metrics?.conversions || '0'),
    cpa_brl: (r.metrics?.costPerConversion || 0) / 1e6,
  }));
}

// Audit summary: total spend, conversions, CPA, waste
async function getAudit(customerId: string, range: string, token: string) {
  const campaigns = await getCampaigns(customerId, range, token);
  const totalSpend = campaigns.reduce((s, c) => s + c.spend_brl, 0);
  const totalBudget = campaigns.reduce((s, c) => s + c.budget_brl, 0);
  const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0);
  const totalImpressions = campaigns.reduce((s, c) => s + Number(c.impressions), 0);
  const totalClicks = campaigns.reduce((s, c) => s + Number(c.clicks), 0);
  const avgCpa = totalConversions > 0 ? totalSpend / totalConversions : 0;
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const budgetUtilization = totalBudget > 0 ? (totalSpend / totalBudget) * 100 : 0;

  return {
    total_spend_brl: totalSpend,
    total_budget_brl: totalBudget,
    budget_utilization_pct: budgetUtilization,
    total_conversions: totalConversions,
    total_impressions: totalImpressions,
    total_clicks: totalClicks,
    avg_cpa_brl: avgCpa,
    ctr_pct: ctr,
    campaign_count: campaigns.length,
    enabled_count: campaigns.filter(c => c.status === 'ENABLED').length,
  };
}

// Keywords: top keywords with status (waste/good) and performance
async function getKeywords(customerId: string, range: string, token: string) {
  const query = `
    SELECT
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      campaign.name,
      metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions,
      metrics.search_impression_share,
      ad_group_criterion.quality_info.quality_score
    FROM keyword_view
    WHERE campaign.status = 'ENABLED'
    AND ad_group_criterion.status = 'ENABLED'
    AND ${dateRange(range)}
    ORDER BY metrics.cost_micros DESC
    LIMIT 50
  `;
  const results = await gadsQuery(customerId, query, token);
  return results.map((r: any) => {
    const spend = (r.metrics?.costMicros || 0) / 1e6;
    const conversions = parseFloat(r.metrics?.conversions || '0');
    const clicks = parseInt(r.metrics?.clicks || '0');
    const cpa = conversions > 0 ? spend / conversions : null;
    const ctr = parseInt(r.metrics?.impressions || '0') > 0
      ? (clicks / parseInt(r.metrics.impressions)) * 100 : 0;
    // Classify: WASTE if spend > 0 and 0 conversions and > 5 clicks
    const status = spend > 2 && conversions === 0 && clicks > 5 ? 'WASTE'
      : conversions > 0 ? 'GOOD' : 'NEUTRAL';
    return {
      text: r.adGroupCriterion?.keyword?.text,
      match_type: r.adGroupCriterion?.keyword?.matchType,
      campaign: r.campaign?.name,
      spend_brl: spend,
      impressions: parseInt(r.metrics?.impressions || '0'),
      clicks,
      conversions,
      cpa_brl: cpa,
      ctr_pct: ctr,
      quality_score: r.adGroupCriterion?.qualityInfo?.qualityScore,
      status,
    };
  });
}

Deno.serve(async (req: Request) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  try {
    const url = new URL(req.url);
    const customerId = url.searchParams.get('customerId') || '8779278717';
    const resource = url.searchParams.get('resource') || 'audit';
    const range = (url.searchParams.get('range') || 'LAST_7_DAYS').toUpperCase();

    const token = await getAccessToken();
    let data: any;

    switch (resource) {
      case 'campaigns': data = await getCampaigns(customerId, range, token); break;
      case 'audit':     data = await getAudit(customerId, range, token); break;
      case 'keywords':  data = await getKeywords(customerId, range, token); break;
      default: return new Response(JSON.stringify({ error: 'Unknown resource' }), { status: 400, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ ok: true, resource, range, data }), { headers: corsHeaders });
  } catch (err: any) {
    console.error('google-ads edge error:', err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: corsHeaders });
  }
});
