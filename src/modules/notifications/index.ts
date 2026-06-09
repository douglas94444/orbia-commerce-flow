// Notifications module
// Responsibilities:
//   - Operational alerts (ROAS drop, SLA risk, NF rejection, zero stock)
//   - Alert routing: WhatsApp (Orbia team) + email (lojista)
//   - Notification queue with deduplication (same alert once per 30min per client)
//   - Critical alerts (<1 min delivery SLA)
//
// Severity thresholds (sync with alert_engine in Traffic/Logistics):
//   - ROAS: critical < 4.0 | warning < 5.0
//   - SLA: Shopee < 4h | ML < 6h | Amazon < 8h before deadline
//   - Stock: critical <= 5 units | warning <= 20 units
//   - Health: critical <= 50 | warning <= 70
//
// Tables (future migration):
//   - notification_queue (client_id, kind, severity, message, scheduled_at, status)
//   - notification_log (queue_id, channel, sent_at, delivered_at, error)

export {}
