// Fiscal module
// Responsibilities:
//   - NF-e emission per approved order (via Focus NFe or Nuvem Fiscal API)
//   - NFC-e for direct consumer sales
//   - NFS-e for Orbia agency invoices
//   - SEFAZ retry (max 3 attempts, 5-min interval)
//   - XML + DANFE storage for 5 years (legal requirement)
//   - NF cancellation within 24h (legal window)
//   - Return NF linked to reverse logistics
//   - Per-client fiscal config: CNPJ, tax regime, CFOP, NCM, A1 certificate
//
// Integrations consumed:
//   - @/integrations/focus-nfe  (primary)
//   -- OR --
//   - @/integrations/nuvem-fiscal  (alternative)
//
// CRITICAL RULE: No order leaves the warehouse without an authorized NF-e.
//                The Logistics module checks this before dispatching.
//
// Tables (future migration):
//   - nfe_emissions (client_id, order_id, type, status, access_key, retries)
//   - fiscal_configs (client_id, cnpj, tax_regime, cfop, cst, ncm, cert_expires_at)
//   - fiscal_certificates (client_id, cert_data_encrypted, expires_at)

export {};
