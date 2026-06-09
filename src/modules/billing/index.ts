// Billing module
// Responsibilities:
//   - Subscription management (launch/growth/scale plan lifecycle)
//   - Payment processing (Stripe or Pagar.me)
//   - Immutable transaction ledger (no balance mutation — only ledger entries)
//   - Revenue recognition and MRR calculation
//   - Idempotent charge operations (provider_tx_id as idempotency key)
//
// RULES:
//   - Amount always stored in CENTS (integer), never float
//   - Transactions are NEVER updated or deleted — only status transitions
//   - Every financial operation must have a corresponding ledger entry
//   - Refunds are new transactions (type: 'refund'), not mutations of the original
//
// Tables (future migration):
//   - subscriptions (client_id, plan, status, current_period_end, provider_sub_id)
//   - transactions (client_id, type, status, amount_cents, provider_tx_id, idempotency_key)
//   - ledger_entries (transaction_id, account, direction, amount_cents)

export {}
