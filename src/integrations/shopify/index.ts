// Shopify integration
// API: Shopify Admin API (GraphQL preferred, REST for legacy)
// Auth: OAuth 2.0 (custom app or public app via Partner program)
// Webhook events: orders/create, orders/updated, orders/fulfilled, inventory_levels/update
//
// Operations:
//   - getOrders(shop, accessToken, params?) → Order[]
//   - fulfillOrder(shop, fulfillmentOrderId, trackingInfo, accessToken) → void
//   - updateInventoryLevel(shop, inventoryItemId, locationId, qty, accessToken) → void
//   - getProducts(shop, accessToken) → Product[]
//
// Revenue share: 80/20 with Shopify Partners for public apps
// Webhook HMAC: Base64(HMAC-SHA256(body, shared_secret))
// Rate limits: 2 req/s (REST) or 1000 cost units/s (GraphQL)
// Error handling: log to integration_logs with provider='shopify'

export {}
