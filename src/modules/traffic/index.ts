// Traffic module (formerly Rentio)
// Responsibilities:
//   - Meta Ads campaign sync and ROAS calculation
//   - Google Ads campaign sync
//   - Multi-channel attribution (not last-click)
//   - ROAS alert engine (threshold: critical < 4.0, warning < 5.0)
//   - AI-powered campaign diagnostics via Claude API
//
// Integrations consumed:
//   - @/integrations/meta
//   - @/integrations/google
//
// Server functions:
//   - syncCampaigns(clientId) → Campaign[]
//   - getCampaignDiagnostics(campaignId) → Diagnostic (Claude API)
//
// Tables (to be created in future migration):
//   - campaigns (client_id, platform, spend, revenue, roas, status)
//   - campaign_metrics (campaign_id, date, spend, revenue, impressions, clicks)
//   - ad_accounts (client_id, provider, external_id, name)

export {};
