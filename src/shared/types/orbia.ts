export type PlanTier = 'launch' | 'growth' | 'scale'

export type HealthStatus = 'saudavel' | 'atencao' | 'risco'

export type AlertSeverity = 'critical' | 'warning' | 'info'

export type AlertKind = 'roas' | 'sla' | 'fiscal' | 'stock' | 'health' | 'system'

export interface Client {
  id: string
  name: string
  initials: string
  plan: PlanTier
  status: 'onboarding' | 'active' | 'suspended' | 'cancelled'
  healthScore: number
  gmv30d: number       // in BRL (not cents)
  roas: number
  lastContactDays: number
  onboardingStage: number // 1..4 (semana)
  segment: string
}

export interface OperationAlert {
  id: string
  kind: AlertKind
  severity: AlertSeverity
  title: string
  message: string
  client: string
  time: string
}

export type SalesChannel =
  | 'Mercado Livre'
  | 'Shopee'
  | 'Amazon BR'
  | 'TikTok Shop'
  | 'Instagram'
  | 'Nuvemshop'
  | 'Shopify'

export type OrderStatus =
  | 'aguardando_nf'
  | 'separacao'
  | 'em_picking'
  | 'em_packing'
  | 'despachado'
  | 'em_transito'
  | 'entregue'
  | 'cancelado'
  | 'devolvido'

export type NfStatus = 'autorizada' | 'pendente' | 'rejeitada' | 'cancelada'

export interface Order {
  id: string
  internalId: string
  client: string
  channel: SalesChannel
  carrier: string
  status: OrderStatus
  nf: NfStatus
  value: number
  city: string
  trackingCode?: string | null
}

export interface Campaign {
  id: string
  name: string
  client: string
  platform: 'Meta Ads' | 'Google Ads'
  spend: number
  revenue: number
  attributedRevenue: number
  roas: number
  attributedRoas: number
  revenueDivergencePct: number
  status: 'ativa' | 'atencao' | 'pausada'
}

export type ProspectTemperature = 'cold' | 'warm' | 'hot'

export type ProspectSource =
  | 'inbound'
  | 'partner'
  | 'paid_ads'
  | 'app_store'
  | 'content'
  | 'referral'
  | 'chatbot'

export interface SalesProspect {
  id: string
  companyName: string
  contactName: string
  email: string
  qualificationScore: number
  temperature: ProspectTemperature
  stageLabel: string
  source: ProspectSource
  monthlyRevenueCents: number
}

export interface NfEmission {
  id: string
  emissionId: string
  client: string
  type: 'NF-e' | 'NFC-e' | 'NFS-e'
  status: NfStatus
  value: number
  retries: number
  time: string
  date: string
  accessKey: string | null
  lastError: string | null
  danfeUrl: string | null
  xmlUrl: string | null
  orderId: string | null
  externalRef: string | null
  authorizedAt: string | null
  canCancel: boolean
}

export type SacChannel =
  | 'whatsapp'
  | 'email'
  | 'chat'
  | 'instagram'
  | 'mercado_livre'
  | 'shopee'
  | 'amazon'
  | 'site_form'

export type SacPriority = 'low' | 'normal' | 'high' | 'urgent' | 'critical'

export type SacStatus =
  | 'open'
  | 'in_progress'
  | 'waiting_customer'
  | 'resolved'
  | 'closed'
  | 'merged'

export type SacCategory =
  | 'rastreio'
  | 'atraso'
  | 'produto_errado'
  | 'produto_danificado'
  | 'devolucao'
  | 'troca'
  | 'cancelamento'
  | 'duvida'
  | 'elogio'
  | 'fraude'
  | 'chargeback'

export interface SacTicket {
  id: string
  protocol: string
  channel: SacChannel
  category: SacCategory
  priority: SacPriority
  status: SacStatus
  customerId: string | null
  orderId: string | null
  assignedTo: string | null
  createdAt: string
}

export interface SacMessage {
  id: string
  ticketId: string
  direction: 'inbound' | 'outbound' | 'system' | 'bot'
  body: string
  senderType: 'customer' | 'agent' | 'bot' | 'system'
  createdAt: string
}

export interface AutomationFlow {
  id: string
  name: string
  trigger: string
  channel: 'Email' | 'SMS' | 'WhatsApp' | 'Push'
  active: boolean
  sent30d: number
  recovered: number
  recoveredCents?: number
}

export interface InventoryItem {
  sku: string
  product: string
  client: string
  units: number
  reserved: number
  available: number
  level: 'ok' | 'atencao' | 'critico'
}
