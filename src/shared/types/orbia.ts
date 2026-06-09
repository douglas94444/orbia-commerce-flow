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
  | 'despachado'
  | 'em_transito'
  | 'entregue'

export type NfStatus = 'autorizada' | 'pendente' | 'rejeitada'

export interface Order {
  id: string
  client: string
  channel: SalesChannel
  carrier: string
  status: OrderStatus
  nf: NfStatus
  value: number
  city: string
}

export interface Campaign {
  id: string
  name: string
  client: string
  platform: 'Meta Ads' | 'Google Ads'
  spend: number
  revenue: number
  roas: number
  status: 'ativa' | 'atencao' | 'pausada'
}

export interface NfEmission {
  id: string
  client: string
  type: 'NF-e' | 'NFC-e' | 'NFS-e'
  status: NfStatus
  value: number
  retries: number
  time: string
}

export interface AutomationFlow {
  id: string
  name: string
  trigger: string
  channel: 'Email' | 'SMS' | 'WhatsApp'
  active: boolean
  sent30d: number
  recovered: number
}

export interface InventoryItem {
  sku: string
  product: string
  client: string
  units: number
  level: 'ok' | 'atencao' | 'critico'
}
