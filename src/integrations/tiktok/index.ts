// TikTok Shop integration
// API: TikTok Shop Open Platform API
// Auth: OAuth 2.0 (Authorization Code flow)
// Webhook events: ORDER_STATUS_CHANGE, PRODUCT_STATUS_CHANGE
//
// Operations:
//   - getOrders(shopId, accessToken, params) → Order[]
//   - getOrderDetail(shopId, orderId, accessToken) → OrderDetail
//   - shipOrder(shopId, orderId, trackingInfo, accessToken) → void
//   - updateProductStock(shopId, productId, qty, accessToken) → void
//
// Note: TikTok Shop is growing fastest in BR — prioritize reliability
// Signature: HMAC-SHA256 webhook validation
// Error handling: log to integration_logs with provider='tiktok'

export {};
