# Plano — Dashboard Interno do Orbia

Sistema operacional da equipe Orbia, com visual futurista autoral: tema escuro profundo, acento orbital (ciano elétrico + violeta), tipografia distintiva e telemetria viva. Tudo em **português (BR)** e com **dados mockados** (Lovable Cloud desativado — sem backend nesta fase; quando ativarmos o Cloud, pluga-se Supabase + RLS por trás).

> Observação técnica: o projeto roda em **TanStack Start** (não Next.js). A estrutura `/app` do briefing vira rotas em `src/routes/`. Toda a lógica de negócio do briefing (filas, Redis, NF-e, webhooks) fica para a fase com backend; aqui construímos a **camada visual e de navegação**.

## Direção visual

- **Fundo**: preto-azulado profundo (quase obsidiana), com gradientes sutis e textura de grid/pontos.
- **Acentos**: ciano elétrico (primário) + violeta (secundário). Verde/âmbar/vermelho só para status (saudável/atenção/risco).
- **Tipografia**: display geométrica futurista para títulos + fonte mono para números/métricas (sensação de telemetria), corpo em sans limpa.
- **Profundidade**: cards com glass sutil, bordas finas luminosas, glows discretos em estados críticos.
- **Movimento (Framer Motion, contido)**: KPIs contam ao montar, alertas críticos pulsam, gráficos desenham-se, leve acento orbital no logo. Nada de animação em todo elemento.

## Estrutura de rotas (TanStack)

```text
src/routes/
  __root.tsx                 -> shell (providers, fontes)
  index.tsx                  -> redireciona p/ /overview
  _dashboard.tsx             -> layout: sidebar + topbar + painel de alertas (Outlet)
  _dashboard.overview.tsx    -> Visão Geral (tela principal, completa)
  _dashboard.clients.tsx     -> Clientes (CRM + health score)
  _dashboard.traffic.tsx     -> Tráfego (ROAS por canal)
  _dashboard.logistics.tsx   -> Logística (pedidos omnichannel + estoque)
  _dashboard.retention.tsx   -> Retenção (automações + RFM)
  _dashboard.fiscal.tsx      -> Fiscal (emissão NF-e)
  _dashboard.analytics.tsx   -> Analytics (dashboard 360)
  _dashboard.success.tsx     -> Customer Success (pipeline/onboarding)
```

## Componentes (em `src/components/dashboard/`)

- `app-sidebar.tsx` — navegação dos 8 itens, item ativo destacado, colapsável (mini-ícones), logo orbital.
- `top-bar.tsx` — título da seção, busca, status do sistema (online), perfil do operador.
- `alerts-panel.tsx` — feed de alertas em tempo real (mock) com timestamps e severidade (ROAS crítico, SLA em risco, NF rejeitada, estoque zerado).
- `kpi-card.tsx` — instrumento de KPI com número mono e delta.
- `health-badge.tsx` / `health-ring.tsx` — score 0–100 colorido (verde 80–100, âmbar 50–79, vermelho 0–49).
- `plan-badge.tsx` — Launch / Growth / Scale.
- `telemetry-chart.tsx` — gráficos com **Recharts** (já compatível), estilizados ao tema.
- `clients-table.tsx`, `orders-table.tsx` — tabelas densas reutilizáveis.

## Conteúdo por tela (mockado, realista, PT-BR)

- **Visão Geral**: faixa de KPIs (MRR, ROAS médio, SLA %, Health Score médio, NF emitidas %), gráfico principal GMV × ROAS (30 dias), painel de alertas críticos, tabela da carteira de clientes com health ring e plano.
- **Clientes**: lista/CRM com health score, plano, último contato, estágio de onboarding; filtros e busca.
- **Tráfego**: cards de ROAS por canal (Meta/Google), tabela de campanhas com alertas de threshold, gráfico de evolução.
- **Logística**: pedidos omnichannel (canal, status, NF, transportadora), painel de estoque por SKU com níveis crítico/atenção, badge de "trava fiscal".
- **Retenção**: fluxos de automação (carrinho abandonado, pós-compra, reativação), matriz/segmentos RFM, métricas de LTV.
- **Fiscal**: fila de emissão de NF-e (autorizada/pendente/rejeitada com retry), config fiscal por lojista, status SEFAZ.
- **Analytics**: dashboard 360 com GMV, ROAS, LTV, SLA, margem, cohorts.
- **Customer Success**: pipeline, onboarding tracker (30 dias), NPS, QBRs agendadas.

## Design system (`src/styles.css`)

- Definir tokens em `oklch`: `--background`, `--foreground`, `--primary` (ciano), `--secondary`/`--accent` (violeta), `--card` (glass), `--border`, status (success/warning/destructive) e gradientes/sombras orbitais.
- Mapear em `@theme inline` para uso via classes Tailwind (sem cores hardcoded nos componentes).
- Carregar fontes via `<link>` no `__root.tsx` (não `@import` de URL).

## Dados mockados

- `src/lib/mock/` com geradores tipados (TypeScript estrito): clientes, pedidos, campanhas, alertas, NF-e, métricas. Tipos de domínio explícitos em `src/types/`.
- Pequena simulação de "tempo real" (números/alertas atualizando em intervalo) só na camada de UI, para dar vida à telemetria.

## Entrega faseada

1. Tokens de tema escuro orbital + fontes + utilitários de movimento.
2. Shell: layout `_dashboard`, sidebar, top bar, painel de alertas.
3. Tela **Visão Geral** completa (KPIs, gráfico, alertas, tabela).
4. Demais 6 módulos com telas mockadas representativas.
5. Polimento: animações contidas, responsividade, varredura anti-"slop".

## Fora de escopo (fase com backend)

Autenticação/roles, RLS multi-tenant, webhooks, filas (Inngest/BullMQ), Redis (estoque), emissão real de NF-e, integrações (Meta/Google/marketplaces/transportadoras), persistência. Requer ativar o Lovable Cloud — proponho fazer isso quando partirmos para dados reais.
