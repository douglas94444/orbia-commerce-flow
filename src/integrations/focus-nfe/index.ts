// Focus NFe integration
// API: Focus NFe REST API (focusnfe.com.br)
// Auth: Bearer token (API key per environment)
// Environments: homologacao (sandbox) | producao
//
// Operations:
//   - emitNFe(data: NFeData, token) → { ref: string, status: 'autorizado' | 'processando' | 'erro' }
//   - checkNFeStatus(ref, token) → NFeStatus
//   - cancelNFe(ref, justification, token) → void
//   - emitNFCe(data: NFCeData, token) → NFCeResult
//   - emitNFSe(data: NFSeData, token) → NFSeResult
//   - downloadXML(ref, token) → XMLString
//   - downloadDANFE(ref, token) → PDFBuffer
//
// Error handling: retry up to 3x with 5-min backoff for SEFAZ instability
// Legal: XML must be stored for 5 years (store in Supabase Storage)
// Cancellation window: 24 hours from emission (cancel before dispatch if needed)
// Error handling: log to integration_logs with provider='focus_nfe'

export {}
