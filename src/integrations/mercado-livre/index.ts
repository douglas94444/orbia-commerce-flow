// Mercado Livre integration
// API: MeLi API v2 (api.mercadolibre.com)
// OAuth 2.0 — Authorization Code flow
// Webhook events: orders_v2, items, payments, questions
//
// Operations:
//   - getOrders(sellerId, accessToken, dateFrom?) → Order[]
//   - getOrderItems(orderId, accessToken) → OrderItem[]
//   - updateOrderStatus(orderId, status, accessToken) → void
//   - updateStock(itemId, quantity, accessToken) → void
//   - getShipment(shipmentId, accessToken) → Shipment
//   - printShippingLabel(shipmentId, accessToken) → LabelUrl
//
// SLA: orders must be dispatched within 24h of payment (or ML reduces reputation)
// Signature validation: use x-signature header + app secret
// Rate limits: 1000 req/min per user
// Error handling: log to integration_logs with provider='mercado_livre'

export {};
