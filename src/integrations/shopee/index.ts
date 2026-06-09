// Shopee integration
// API: Shopee Open Platform API v2
// Auth: shop_id + access_token (OAuth 2.0)
// Webhook events: ORDER_STATUS_UPDATE, SHOP_UPDATE, BANNED_ITEM
//
// Operations:
//   - getOrderList(shopId, accessToken, params) → Order[]
//   - getOrderDetail(shopId, orderSn, accessToken) → OrderDetail
//   - setShipOrder(shopId, orderSn, accessToken) → void
//   - createShippingDocument(shopId, orderSn, accessToken) → Document
//   - updateStock(shopId, itemId, qty, accessToken) → void
//
// SLA: Shopee penalizes sellers with late dispatch — alert 4h before deadline
// Signature: HMAC-SHA256 of (partner_id + api_path + timestamp + access_token + shop_id)
// Rate limits: varies per endpoint, respect Retry-After headers
// Error handling: log to integration_logs with provider='shopee'

export {}
