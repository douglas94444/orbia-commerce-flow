// Meta Ads integration
// API: Meta Marketing API v21+
// OAuth scopes: ads_read, ads_management, business_management
//
// Operations:
//   - getAdAccounts(accessToken) → AdAccount[]
//   - getCampaigns(adAccountId, accessToken) → Campaign[]
//   - getAdSetInsights(adSetId, dateRange, accessToken) → Insights
//   - getCampaignInsights(campaignId, dateRange, accessToken) → Insights
//
// Webhook events consumed (via /api/webhooks/meta):
//   - ad_account.update
//   - campaign.update
//
// Rate limits: 200 calls / hour per ad account (respect X-Business-Use-Case-Usage header)
// Error handling: log all failures to integration_logs with provider='meta'

export {};
