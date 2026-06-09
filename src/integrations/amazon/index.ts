// Amazon integration
// API: Amazon Selling Partner API (SP-API)
// Auth: Login with Amazon (LWA) — OAuth 2.0 with refresh token
// Marketplace: Brazil (A2Q3Y263D00KWC)
//
// Operations:
//   - getOrders(marketplaceId, accessToken, createdAfter?) → Order[]
//   - getOrderItems(orderId, accessToken) → OrderItem[]
//   - confirmShipment(orderId, shippingInfo, accessToken) → void
//   - updateInventory(sku, quantity, accessToken) → void
//
// SLA: Amazon suspends seller accounts for SLA violations — alert 8h before deadline
// Rate limits: dynamic throttling via x-amzn-RateLimit-Limit header
// Error handling: log to integration_logs with provider='amazon'

export {};
