// Google Ads integration
// API: Google Ads API v18+
// OAuth scopes: https://www.googleapis.com/auth/adwords
//
// Operations:
//   - listAccessibleCustomers(accessToken) → CustomerId[]
//   - getCampaigns(customerId, accessToken) → Campaign[]
//   - getCampaignPerformance(customerId, dateRange, accessToken) → PerformanceReport
//
// Rate limits: 15,000 operations / day (standard tier)
// Error handling: log to integration_logs with provider='google'

export {}
