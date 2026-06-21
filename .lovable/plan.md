# Análise Ponta a Ponta — Orbia Commerce Orchestrator

Plataforma multi-tenant de e-commerce as a service (tráfego, logística/WMS, fiscal, retenção, SAC, CRM de vendas) em **TanStack Start (SSR) + Supabase**, com 3 públicos: **equipe Orbia (admin/staff)**, **lojista (portal)** e **operação de armazém (ops/PWA)**.

---

## 1. Visão geral da arquitetura

- **Stack**: TanStack Start v1 (Vite 7, React 19), Tailwind v4 OKLCH, TanStack Query, Supabase. Build alvo Cloudflare Workers.
- **Organização**: `src/modules/*` (domínio) · `src/integrations/*` (20 provedores externos) · `src/shared/*` (design system, libs) · `src/routes/*` (rotas finas).
- **Backend**: `createServerFn` (27 arquivos de server functions) + server routes em `src/routes/api/*` (14 webhooks, 11 callbacks OAuth, 1 cron). **Sem mock data** — dados reais via server functions e RLS. 
- **Migrações**: 67 migrações SQL ordenadas, ~120 tabelas.

Veredito: arquitetura sólida e bem modularizada. Os problemas estão em **segurança (RLS/roles)** e em **qualidade de tipos**, não na estrutura.

---

## 2. Separação admin / lojista / operação (já existe)

| Área | Rotas | Layout | Guarda |
|------|-------|--------|--------|
| Equipe Orbia | `_dashboard.*` (~50 rotas) | `AppSidebar` | `useSession` + redirect se `!isStaffRole` → `/portal/overview` |
| Lojista | `portal.*` (9 rotas) | `PortalSidebar` | `useSession` + redirect se `isStaffRole` → `/overview` |
| Operação WMS | `ops.*` (PWA) | header próprio | `useSession` + `useOpsAccess` |
| Público (sem login) | `index`, `login`, `diagnostico.*`, `proposta.$token`, `contrato.$token`, `minha-conta.$token`, `help.$slug`, `parceiros.cadastro` | — | nenhum (correto) |

**Fragilidade**: a separação é feita por `useEffect` + `navigate` no client (`_dashboard.tsx`, `portal.tsx`, `ops.tsx`). Isso "pisca" e **não é barreira real** — a proteção verdadeira depende 100% do RLS no banco (ver seção 3). Funciona, mas o ideal seria `beforeLoad`/route guards. Não é o problema mais grave.

---

## 3. Segurança — CRÍTICO (50 achados no scan)

### 3.1 Privilege escalation (ERROR) — o mais grave
- **Papéis armazenados em `profiles.role`** (não há tabela `user_roles` nem `has_role`). A função `is_orbia_staff()` lê `profiles.role`.
- A policy **`profiles: insert own`** usa `WITH CHECK (id = auth.uid())` **sem restringir `role`**. Logo, **qualquer novo usuário pode se auto-inserir como `orbia_admin`/`orbia_staff`** e ganhar acesso a todos os dados internos: `sales_prospects`, `sales_contracts`, `sales_diagnoses`, `audit_logs`, carteira de clientes, etc.
- Correção: `WITH CHECK (id = auth.uid() AND role = 'member')` e elevação de papel só via service_role/admin. Idealmente migrar papéis para tabela `user_roles` + `has_role()` (padrão recomendado).

### 3.2 PII e segredos legíveis por qualquer membro do tenant (ERROR)
- `fiscal_configs`: `cert_password`, `cert_path`, `cnpj`, `nfce_csc_token` legíveis por qualquer membro.
- `oauth_connections`: `access_token`/`refresh_token` em texto puro legíveis por qualquer membro.
- `sac_conversations`: telefone/email do cliente, ALL para qualquer membro.
- `abandoned_carts`, `customer_contact_prefs`: email/telefone/aniversário em texto puro.
- Correção: remover colunas sensíveis das policies de SELECT de membro, restringir a admin/role específico ou a `service_role`.

### 3.3 RLS permissiva / writes abertos (ERROR/WARN)
- `nfe_fiscal_events: system write` usa `USING(true)` para `public` → qualquer autenticado escreve eventos fiscais. Deve ser `service_role`.
- `sac_bot_sessions`, `channel_sla`, `template_library` com `USING(true)`/`WITH CHECK(true)`.
- Várias tabelas só com policy `service_role` e sem SELECT de membro (`loyalty_*`, `pick_tasks`, `volume_forecast_alerts`) — leituras retornam vazio silenciosamente.

### 3.4 Outros
- Várias views `SECURITY DEFINER` (5×) e funções `SECURITY DEFINER` executáveis por anon/authenticated (~25×) — revisar `EXECUTE`/`search_path`.
- Proteção contra senha vazada desabilitada no Auth.

---

## 4. Qualidade de código

- **111 ocorrências de `as any`** em server functions (tabelas das migrações 007+ não estão em `types.ts`). Mascaram erros de tipo. CLAUDE.md já prevê regenerar `types.ts` e remover os casts.
- **`src/modules/pricing/actions.functions.ts` importa `supabaseAdmin` no escopo do módulo** (linha 4). Como `.functions.ts` faz parte do grafo client (só o corpo do handler é removido), isso pode vazar o módulo server-only para o bundle. Deve usar `await import('@/integrations/supabase/client.server')` dentro do handler.
- **`client_id` vindo do frontend**: `pricing` recebe `clientId` por input (`clientIdSchema`), contrariando a regra do CLAUDE.md ("`client_id` nunca vem do frontend; resolver via `current_client_id()`"). O RLS ainda protege, mas convém alinhar.
- `useSession` mantém um `onAuthStateChange` próprio por hook (vários montados) em vez de um único listener no root — risco de thrash menor, mas fora do padrão recomendado.

---

## 5. Plano de correção priorizado

**P0 — Segurança crítica (migração SQL)**
1. Corrigir `profiles: insert own` para travar `role = 'member'` no `WITH CHECK`; bloquear UPDATE de `role` por não-admin.
2. (Recomendado) Migrar papéis para `user_roles` + `has_role()` e reescrever `is_orbia_staff()`.
3. Restringir SELECT de `fiscal_configs`, `oauth_connections`, `sac_conversations`, `abandoned_carts`, `customer_contact_prefs` para remover PII/segredos do acesso de membro comum.
4. Trocar `nfe_fiscal_events` e demais `USING(true)` de write para `service_role`.

**P1 — Robustez de acesso**
5. Substituir os redirects via `useEffect` por route guards reais (`beforeLoad`) nos layouts `_dashboard`, `portal`, `ops`.
6. Revisar funções/views `SECURITY DEFINER` e habilitar proteção de senha vazada.

**P2 — Qualidade**
7. Regenerar `src/integrations/supabase/types.ts` e remover os ~111 `as any`.
8. Mover `supabaseAdmin` para `await import` dentro do handler em `pricing/actions.functions.ts` (e auditar webhooks/rotas com import em escopo de módulo).
9. Padronizar resolução de `client_id` via `current_client_id()` no servidor.
10. Centralizar `onAuthStateChange` em `__root.tsx`.

---

## Como prosseguir

Esta é uma análise — posso detalhar qualquer eixo. Se aprovar, sugiro **começar pelo P0 (uma migração SQL única corrigindo privilege escalation + PII)**, que é o risco real de vazamento e elevação de privilégio. Me diga se quer que eu execute o P0 já, ou todo o plano em sequência.