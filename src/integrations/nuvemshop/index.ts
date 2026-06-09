// Nuvemshop integration
// API: Nuvemshop API v1 (api.nuvemshop.com.br)
// Auth: OAuth 2.0 (per-store access tokens)
// Webhook events: app/installed, app/uninstalled, orders/created, orders/updated, products/updated
//
// Operations:
//   - getStore(storeId, accessToken) → Store
//   - getOrders(storeId, accessToken, params?) → Order[]
//   - updateOrderFulfillment(storeId, orderId, fulfillment, accessToken) → void
//   - getProducts(storeId, accessToken) → Product[]
//   - updateProductStock(storeId, productId, variantId, qty, accessToken) → void
//
// Partner program: register at partners.nuvemshop.com.br — provides leads + App Store listing
// Webhook validation: x-linkedstore-webhook-id header
// Error handling: log to integration_logs with provider='nuvemshop'

export {}
