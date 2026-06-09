// Retention module (formerly LTV Boost)
// Responsibilities:
//   - Automation engine: abandoned cart, post-purchase, win-back, birthday
//   - Trigger on 'order delivered' event from Logistics module (same DB — no API needed)
//   - RFM segmentation (Recência, Frequência, Valor)
//   - Loyalty points program
//   - LTV cohort analysis
//
// Tables (future migration):
//   - automation_flows (client_id, trigger, channel, is_active)
//   - automation_executions (flow_id, customer_id, sent_at, status)
//   - customers (client_id, email, phone, rfm_score, ltv)
//   - loyalty_points (customer_id, points, expires_at)

export {}
