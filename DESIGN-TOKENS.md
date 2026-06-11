# Orbia Design Tokens

Referência de tokens semânticos do design system Orbia (Tailwind v4 + OKLCH). Camada inspirada no **LTV Boost Design System Pack**, adaptada para TanStack Start — sem `tailwind.config.ts` nem HSL.

## Onde vivem os tokens

| Camada | Arquivo |
|--------|---------|
| CSS variables + `@theme` | `src/styles.css` |
| Mapas TypeScript (labels, classes) | `src/shared/lib/design-tokens.ts` |
| Componentes de domínio | `src/shared/components/` |

## Paleta base

| Token | Uso |
|-------|-----|
| `--background` | Fundo navy profundo |
| `--foreground` | Texto principal |
| `--primary` | Mint — CTAs, destaques, métricas positivas |
| `--card` / `--muted` | Superfícies e fundos secundários |
| `--success` / `--warning` / `--destructive` | Estados operacionais |
| `--border` / `--border-strong` | Bordas sutis e elevadas |

## Tokens semânticos (LTV Boost)

### Info & severidade

| CSS var | Tailwind | Uso |
|---------|----------|-----|
| `--info` | `text-info`, `bg-info/10` | Segmentos leais, dados informativos |
| `--severity-critical` | `text-severity-critical` | Gargalos, churn crítico |
| `--severity-high` | `text-severity-high` | Alertas altos |
| `--severity-medium` | `text-severity-medium` | Atenção moderada |

### Canais de mensagem

| CSS var | Canal |
|---------|-------|
| `--channel-whatsapp` | WhatsApp |
| `--channel-email` | E-mail |
| `--channel-sms` | SMS |
| `--channel-push` | Push |

Use `ChannelIcon` — cores via `var(--channel-*)`, nunca hex inline nos componentes React.

### RFM

| CSS var | Segmento |
|---------|----------|
| `--primary` | Campeões |
| `--info` / `--rfm-loyal` | Leais |
| `--rfm-potential` | Potencial |
| `--success` | Novos |
| `--warning` | Em risco |
| `--muted-foreground` | Hibernando |
| `--destructive` | Perdidos |

Use `RFMBadge` com `segment` (`campeoes`, `leais`, …).

## Utilitários premium

| Classe | Uso |
|--------|-----|
| `surface-card` | Card padrão |
| `surface-elevated` | Painéis com sombra |
| `surface-chrome` | Top bar / sidebars |
| `bg-primary-gradient` | Barras de funil, botão primary |
| `text-label` | Eyebrows, labels de KPI |
| `text-metric` | Valores numéricos (JetBrains Mono) |
| `text-gradient` | Títulos de destaque |
| `icon-well` | Container de ícone em listas |
| `animate-fade-up` | Entrada suave |
| `animate-pulse-dot` | Severidade crítica / gargalo |

## Componentes de domínio

```tsx
import {
  RFMBadge,
  SeverityBadge,
  ChannelIcon,
  FunnelBar,
  OpportunityCard,
  QuickWinBanner,
} from '@/shared/components'
```

| Componente | Quando usar |
|------------|-------------|
| `RFMBadge` | Segmentação RFM em retenção, clientes |
| `SeverityBadge` | Alertas operacionais (`critico` \| `alto` \| `medio`) |
| `ChannelIcon` | Fluxos, disparos, taxas por canal |
| `FunnelBar` | Funil de ciclo de vida, conversão |
| `OpportunityCard` | Quick wins de receita recuperável |
| `QuickWinBanner` | Banner dismissible no topo de retenção |

## Equivalência LTV Boost → Orbia

| LTV Boost | Orbia |
|-----------|-------|
| `hsl(var(--primary))` | `oklch` em `:root` + `@theme --color-primary` |
| `tailwind.config.ts` colors | `@theme inline` em `styles.css` |
| `RFMBadge` HSL maps | `RFM_SEGMENT_STYLES` em `design-tokens.ts` |
| `components/ui/*` shadcn | `src/components/ui/*` (inalterado) |
| Domain components | `src/shared/components/*` |

## Regras

1. **Métricas** → sempre `text-metric` ou `font-mono`.
2. **Cores de domínio** → tokens semânticos, não hex em TSX.
3. **Dark only** — sem variante light por enquanto.
4. **Não reintroduzir** utilitários orbitais (`glass-panel`, `animate-orbit`, etc.).
