// Logistics module (formerly Fulfillly)
// Responsibilities:
//   - Omnichannel order ingestion (all marketplaces → unified order model)
//   - Atomic stock reservation via Redis (prevents overselling)
//   - Carrier routing engine (best carrier by CEP + weight + SLA)
//   - Label generation per marketplace format
//   - Real-time tracking updates back to each channel
//   - Reverse logistics (returns and exchanges)
//   - FISCAL GATE: order NEVER dispatched without authorized NF-e
//
// Integrations consumed:
//   - @/integrations/mercado-livre
//   - @/integrations/shopee
//   - @/integrations/amazon
//   - @/integrations/tiktok
//   - @/integrations/instagram (Meta Commerce)
//   - @/integrations/nuvemshop
//   - @/integrations/shopify
//
// Tables (future migration):
//   - orders (client_id, channel, carrier, status, nf_status, value)
//   - order_events (order_id, status, occurred_at, metadata)
//   - order_items (order_id, sku, qty, unit_price)
//   - inventory (client_id, sku, units, reserved_units, level)

export {}
