import type {
  AutomationFlow,
  Campaign,
  Client,
  InventoryItem,
  NfEmission,
  OperationAlert,
  Order,
} from "@/types/orbia";

export function healthStatus(score: number): "saudavel" | "atencao" | "risco" {
  if (score >= 80) return "saudavel";
  if (score >= 50) return "atencao";
  return "risco";
}

export const clients: Client[] = [
  { id: "c1", name: "Livraria Aurora", initials: "LA", plan: "scale",  status: "active",     healthScore: 92, gmv30d: 842000, roas: 7.2, lastContactDays: 2,  onboardingStage: 4, segment: "Editorial"   },
  { id: "c2", name: "Lumina Fashion",  initials: "LF", plan: "scale",  status: "active",     healthScore: 88, gmv30d: 691000, roas: 6.4, lastContactDays: 1,  onboardingStage: 4, segment: "Moda"        },
  { id: "c3", name: "TechStore BR",    initials: "TS", plan: "growth", status: "active",     healthScore: 64, gmv30d: 312000, roas: 4.1, lastContactDays: 9,  onboardingStage: 4, segment: "Eletrônicos" },
  { id: "c4", name: "Gourmet Express", initials: "GE", plan: "launch", status: "active",     healthScore: 42, gmv30d: 58000,  roas: 2.8, lastContactDays: 14, onboardingStage: 3, segment: "Alimentos"   },
  { id: "c5", name: "Naturae Life",    initials: "NL", plan: "growth", status: "active",     healthScore: 76, gmv30d: 224000, roas: 5.6, lastContactDays: 4,  onboardingStage: 4, segment: "Cosméticos"  },
  { id: "c6", name: "Casa & Perfil",   initials: "CP", plan: "growth", status: "active",     healthScore: 81, gmv30d: 188000, roas: 6.1, lastContactDays: 3,  onboardingStage: 4, segment: "Decoração"   },
  { id: "c7", name: "PetClub",         initials: "PC", plan: "launch", status: "onboarding", healthScore: 58, gmv30d: 74000,  roas: 3.9, lastContactDays: 11, onboardingStage: 2, segment: "Pet"         },
  { id: "c8", name: "VeloBike",        initials: "VB", plan: "scale",  status: "active",     healthScore: 90, gmv30d: 503000, roas: 6.9, lastContactDays: 1,  onboardingStage: 4, segment: "Esporte"     },
];

export const alerts: OperationAlert[] = [
  { id: "a1", kind: "stock", severity: "critical", title: "Estoque zerado", message: "SKU-992 (Vinho Tinto) indisponível em todos os hubs.", client: "Gourmet Express", time: "14:22" },
  { id: "a2", kind: "roas", severity: "critical", title: "ROAS crítico", message: "Caiu para 1,2x nas últimas 2h. Campanha Meta desajustada.", client: "Livraria Aurora", time: "14:18" },
  { id: "a3", kind: "fiscal", severity: "warning", title: "NF rejeitada", message: "Instabilidade SEFAZ-SP. Lote #8829 em reprocessamento (2/3).", client: "Gourmet Express", time: "14:05" },
  { id: "a4", kind: "sla", severity: "warning", title: "SLA em risco", message: "42 pedidos Shopee a 4h do prazo de despacho.", client: "TechStore BR", time: "13:58" },
  { id: "a5", kind: "health", severity: "warning", title: "Health em queda", message: "Score caiu para 42. Sem contato há 14 dias.", client: "Gourmet Express", time: "13:30" },
  { id: "a6", kind: "system", severity: "info", title: "Sistema OK", message: "Sync de estoque concluído. Integridade 100%.", client: "Plataforma", time: "13:02" },
];

export const orders: Order[] = [
  { id: "ORD-9021", client: "Lumina Fashion", channel: "Shopify", carrier: "Jadlog", status: "separacao", nf: "autorizada", value: 450, city: "São Paulo/SP" },
  { id: "ORD-9020", client: "TechStore BR", channel: "Mercado Livre", carrier: "Correios", status: "aguardando_nf", nf: "pendente", value: 1289, city: "Curitiba/PR" },
  { id: "ORD-9019", client: "Livraria Aurora", channel: "Nuvemshop", carrier: "Total Express", status: "em_transito", nf: "autorizada", value: 219, city: "Belo Horizonte/MG" },
  { id: "ORD-9018", client: "Gourmet Express", channel: "Shopee", carrier: "J&T Express", status: "aguardando_nf", nf: "rejeitada", value: 98, city: "Recife/PE" },
  { id: "ORD-9017", client: "VeloBike", channel: "Amazon BR", carrier: "Melhor Envio", status: "entregue", nf: "autorizada", value: 2100, city: "Porto Alegre/RS" },
  { id: "ORD-9016", client: "Naturae Life", channel: "TikTok Shop", carrier: "Correios", status: "despachado", nf: "autorizada", value: 167, city: "Salvador/BA" },
  { id: "ORD-9015", client: "Casa & Perfil", channel: "Instagram", carrier: "Jadlog", status: "separacao", nf: "autorizada", value: 540, city: "Campinas/SP" },
];

export const campaigns: Campaign[] = [
  { id: "cp1", name: "Black Aurora — Conversão", client: "Livraria Aurora", platform: "Meta Ads", spend: 18400, revenue: 132000, roas: 7.2, status: "ativa" },
  { id: "cp2", name: "Lumina — Remarketing", client: "Lumina Fashion", platform: "Google Ads", spend: 12200, revenue: 78000, roas: 6.4, status: "ativa" },
  { id: "cp3", name: "TechStore — Search", client: "TechStore BR", platform: "Google Ads", spend: 9800, revenue: 40200, roas: 4.1, status: "atencao" },
  { id: "cp4", name: "Gourmet — Prospecção", client: "Gourmet Express", platform: "Meta Ads", spend: 4100, revenue: 11500, roas: 2.8, status: "atencao" },
  { id: "cp5", name: "Naturae — Lookalike", client: "Naturae Life", platform: "Meta Ads", spend: 7600, revenue: 42500, roas: 5.6, status: "ativa" },
  { id: "cp6", name: "VeloBike — PMax", client: "VeloBike", platform: "Google Ads", spend: 11000, revenue: 75900, roas: 6.9, status: "ativa" },
];

export const nfEmissions: NfEmission[] = [
  { id: "NFe-48211", client: "Lumina Fashion", type: "NF-e", status: "autorizada", value: 450, retries: 0, time: "14:21" },
  { id: "NFe-48210", client: "TechStore BR", type: "NF-e", status: "pendente", value: 1289, retries: 1, time: "14:19" },
  { id: "NFe-48209", client: "Gourmet Express", type: "NF-e", status: "rejeitada", value: 98, retries: 2, time: "14:05" },
  { id: "NFe-48208", client: "Livraria Aurora", type: "NF-e", status: "autorizada", value: 219, retries: 0, time: "13:58" },
  { id: "NFC-12044", client: "VeloBike", type: "NFC-e", status: "autorizada", value: 2100, retries: 0, time: "13:40" },
  { id: "NFS-00321", client: "Orbia Agência", type: "NFS-e", status: "autorizada", value: 9000, retries: 0, time: "12:10" },
];

export const automations: AutomationFlow[] = [
  { id: "au1", name: "Carrinho abandonado", trigger: "Carrinho > 1h", channel: "WhatsApp", active: true, sent30d: 3420, recovered: 412 },
  { id: "au2", name: "Pós-compra (boas-vindas)", trigger: "Pedido entregue", channel: "Email", active: true, sent30d: 2890, recovered: 0 },
  { id: "au3", name: "Reativação 45d", trigger: "Sem compra 45d", channel: "Email", active: true, sent30d: 1240, recovered: 188 },
  { id: "au4", name: "Aniversário", trigger: "Data aniversário", channel: "SMS", active: false, sent30d: 320, recovered: 41 },
  { id: "au5", name: "Cross-sell pós-entrega", trigger: "Pedido entregue +7d", channel: "WhatsApp", active: true, sent30d: 980, recovered: 156 },
];

export const inventory: InventoryItem[] = [
  { sku: "SKU-992", product: "Vinho Tinto Reserva", client: "Gourmet Express", units: 0, level: "critico" },
  { sku: "SKU-901", product: "Nike Air Max", client: "TechStore BR", units: 3, level: "critico" },
  { sku: "SKU-455", product: "Kit Skincare Noturno", client: "Naturae Life", units: 12, level: "atencao" },
  { sku: "SKU-302", product: "Livro Box Sci-fi", client: "Livraria Aurora", units: 184, level: "ok" },
  { sku: "SKU-118", product: "Capacete Aero", client: "VeloBike", units: 47, level: "ok" },
  { sku: "SKU-770", product: "Vestido Midi Linho", client: "Lumina Fashion", units: 18, level: "atencao" },
];

// Série temporal GMV x ROAS (30 dias) — determinística
export const gmvRoasSeries = Array.from({ length: 30 }, (_, i) => {
  const day = i + 1;
  const base = 90000 + Math.sin(i / 3) * 22000 + i * 1800;
  const gmv = Math.round(base + (i % 7 === 6 ? 28000 : 0));
  const roas = Number((5.2 + Math.sin(i / 4) * 0.9 + (i % 9 === 0 ? -0.6 : 0)).toFixed(1));
  return { day: `${day}`, gmv, roas };
});

export const channelRoas = [
  { channel: "Meta Ads", roas: 5.8, spend: 142000 },
  { channel: "Google Ads", roas: 6.3, spend: 98000 },
  { channel: "TikTok", roas: 4.2, spend: 31000 },
  { channel: "Orgânico", roas: 11.4, spend: 0 },
];

export const cohortRetention = [
  { month: "Jan", m0: 100, m1: 62, m2: 48, m3: 41 },
  { month: "Fev", m0: 100, m1: 65, m2: 51, m3: 44 },
  { month: "Mar", m0: 100, m1: 68, m2: 55, m3: 47 },
  { month: "Abr", m0: 100, m1: 71, m2: 58, m3: 0 },
];
