# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # start dev server (Vite + TanStack Start)
npm run build      # production build (Nitro, Cloudflare Workers target)
npm run lint       # ESLint
npm run format     # Prettier
```

No test framework is configured. There is no `npm test`.

To apply database migrations:
```bash
supabase db push   # push local migrations to the remote project
```

## Architecture

### Framework: TanStack Start (not Next.js)
This is a **TanStack Start** SSR app. Do not apply Next.js, Remix, or React Router patterns.
- No `app/`, no `pages/`, no `app/layout.tsx`
- Root layout lives only in `src/routes/__root.tsx`
- `routeTree.gen.ts` is auto-generated — never edit it manually

### File-based Routing
Routes live in `src/routes/`. Conventions:
- `_dashboard.tsx` — layout route; renders children via `<Outlet />`
- `_dashboard.overview.tsx` — nested route rendered inside the dashboard layout
- `$id.tsx` — dynamic segment (bare `$`, no curly braces)

### Server Functions
Use `createServerFn` from `@tanstack/react-start` for all server-side logic — not Supabase Edge Functions, not API routes. See `src/lib/api/example.functions.ts`. Module-level code ships to the client; server-only helpers must live in `*.server.ts` files.

### Vite Config
`vite.config.ts` uses `@lovable.dev/vite-tanstack-config`. It already bundles: TanStack Start, React, Tailwind, tsconfig paths, Nitro, `@` alias, env injection. **Do not add these plugins manually.**

---

## Folder Structure

```
src/
├── modules/           ← business domain — all new features go here
│   ├── auth/          ← sign in, sign up, session
│   ├── clients/       ← multi-tenant root, team management
│   ├── traffic/       ← Meta + Google Ads, ROAS, diagnostics
│   ├── logistics/     ← omnichannel orders, stock, carriers
│   ├── retention/     ← automations, RFM, LTV, loyalty
│   ├── fiscal/        ← NF-e, SEFAZ, certificates
│   ├── billing/       ← subscriptions, transaction ledger
│   ├── notifications/ ← alerts, WhatsApp, email
│   ├── analytics/     ← 360 dashboard, health score, reports
│   └── admin/         ← internal CS, onboarding, QBR
├── integrations/      ← one folder per external provider, never mixed
│   ├── meta/          ← Meta Marketing API
│   ├── google/        ← Google Ads API
│   ├── mercado-livre/ ← MeLi API
│   ├── shopee/        ← Shopee Open Platform
│   ├── amazon/        ← Amazon SP-API
│   ├── tiktok/        ← TikTok Shop API
│   ├── nuvemshop/     ← Nuvemshop API
│   ├── shopify/       ← Shopify Admin API
│   └── focus-nfe/     ← Focus NFe API (NF-e/NFC-e/NFS-e)
├── shared/            ← reusable code with no domain knowledge
│   ├── components/    ← design system (shadcn + dashboard UI)
│   ├── hooks/         ← useRipple, useCountUp, etc.
│   ├── lib/
│   │   ├── supabase/  ← client.ts, server.ts, database.types.ts
│   │   ├── logger.ts  ← logIntegration, logAudit, logJob, startTimer
│   │   ├── format.ts  ← formatBRL, formatNumber
│   │   ├── utils.ts   ← cn()
│   │   └── mock/      ← mock data (replace with real server functions)
│   └── types/         ← shared domain types (orbia.ts)
└── routes/            ← thin route files: route definition + data loading only
```

`src/lib/`, `src/hooks/`, `src/types/` are backward-compat re-exports pointing to `src/shared/`. New code imports from `@/shared/` or `@/modules/`.

---

## Database

### Migrations
All migrations live in `supabase/migrations/` and must be run in order:

| File | Contents |
|------|----------|
| `001_core_tables.sql` | `profiles`, `clients`, `client_members`, `set_updated_at()` trigger, `handle_new_user()` trigger |
| `002_rls_policies.sql` | `auth.current_client_id()`, `auth.is_orbia_staff()`, all RLS policies for core tables |
| `003_observability.sql` | `audit_logs`, `integration_logs`, `job_logs` |
| `004_webhooks.sql` | `webhook_events` (idempotency via `UNIQUE(provider, event_id)`) |
| `005_oauth.sql` | `oauth_connections`, `oauth_states`, `cleanup_expired_oauth_states()` |

### Required columns on every table
```
id          uuid DEFAULT gen_random_uuid() PRIMARY KEY
created_at  timestamptz NOT NULL DEFAULT now()
updated_at  timestamptz NOT NULL DEFAULT now()
```
Exception: immutable tables (`audit_logs`, `integration_logs`, `oauth_states`) have no `updated_at`.

### Multi-tenancy rule
`client_id` is **NEVER** passed from the frontend. Always resolved server-side via:
```sql
auth.current_client_id()  -- resolves JWT → client_members → client_id
```
Every table with client data must have RLS enabled and a policy using this function.

---

## Supabase Clients

Two separate clients — never mix them:

**Browser** (`@/shared/lib/supabase/client.ts`):
```typescript
import { getSupabaseBrowserClient } from '@/shared/lib/supabase/client'
// Uses VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY (anon key)
// Respects RLS via user session JWT
// Use in React components and client-side hooks
```

**Server** (`@/shared/lib/supabase/server.ts` — import only in `createServerFn` or `*.server.ts`):
```typescript
import { getSupabaseServiceClient }   from '@/shared/lib/supabase/server' // bypasses RLS
import { getSupabaseServerClient }    from '@/shared/lib/supabase/server' // enforces RLS
// getSupabaseServiceClient()  → use for webhooks, crons, system ops
// getSupabaseServerClient(accessToken) → use for user-initiated server functions
```

Preferred data flow:
```
Frontend → createServerFn → getSupabaseServerClient(token) → DB (RLS enforced)
Webhooks → server handler → getSupabaseServiceClient()     → DB (service role)
```

---

## Observability

Every critical operation must call the logger before returning. Logger is server-only.

```typescript
import { logIntegration, logAudit, logJob, startTimer } from '@/shared/lib/logger'

// Wrap external API calls
const end = startTimer()
const result = await callExternalApi(...)
await logIntegration({
  client_id,
  provider: 'meta',
  operation: 'sync_campaigns',
  status: 'success',
  duration_ms: end(),
})

// Audit user-driven mutations
await logAudit({ user_id, client_id, action: 'create', resource: 'client', resource_id: id })

// Track async jobs
await logJob({ job_type: 'webhook', job_id, client_id, status: 'completed', duration_ms: end() })
```

---

## Webhook Pattern

Every webhook handler must follow this flow, no exceptions:
1. Validate HMAC signature (provider-specific header)
2. Check `webhook_events` for duplicate `(provider, event_id)` — return 200 if found
3. Insert event with `status = 'queued'`
4. Return 200 immediately (< 5s)
5. Process asynchronously
6. Update status to `'processed'` or `'failed'`
7. Call `logJob()`

---

## Payment Rules
- Amounts stored as **integer cents** (never float)
- Transactions are **immutable** — never UPDATE or DELETE
- Refunds are new rows (`type: 'refund'`), not mutations of the original
- Always use `idempotency_key` to prevent double-charges

---

## Design System

### Tailwind v4 + OKLCH
- Primary (cyan): `oklch(0.82 0.14 195)`
- Accent (violet): `oklch(0.66 0.2 292)`
- Background: `oklch(0.16 0.022 264)`

Custom `@utility` classes: `glass-panel`, `grid-texture`, `text-glow`, `ripple-glow-element`, `animate-pulse-ring`, `animate-orbit`

### Fonts
- `font-sans` → Sora (body)
- `font-display` → Space Grotesk (headings)
- `font-mono` → JetBrains Mono — use for **all** numeric/metric values

### Component Patterns
- `cn()` from `@/shared/lib/utils` for conditional class merging
- `formatBRL(value, compact?)` from `@/shared/lib/format` for currency
- `healthStatus(score)` → `'saudavel' | 'atencao' | 'risco'` (80+/50+/0+)
- `useRipple<T>()` from `@/shared/hooks/use-ripple` — needs `relative overflow-hidden` on container
- `Panel` — card wrapper for all content sections
- `KpiCard` — metric card with delta, glass panel, and ripple built in

### Health Score Thresholds
80–100 = saudável (green) · 50–79 = atenção (yellow) · 0–49 = risco (red)

---

## Server Function Pattern

Every data operation follows this pattern (never direct frontend → DB):

```typescript
// src/modules/<domain>/server/actions.ts
import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { logAudit } from '@/shared/lib/logger'

export const myAction = createServerFn({ method: 'POST' })
  .inputValidator(mySchema)           // zod validation
  .middleware([requireSupabaseAuth])  // provides context.supabase (RLS) + context.userId
  .handler(async ({ data, context }) => {
    // context.supabase  → user-scoped (respects RLS) — use for reads
    // supabaseAdmin     → service role (bypasses RLS) — use for writes after explicit auth check
    // context.userId    → authenticated user UUID
    await logAudit({ ... })           // always audit mutations
  })
```

TanStack Query hook pattern:
```typescript
// src/modules/<domain>/hooks/use-<domain>.ts
export function useMyData() {
  return useQuery({ queryKey: ['my-data'], queryFn: () => myAction() })
}
export function useMyMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input) => myAction({ data: input }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['my-data'] }); toast.success(...) },
    onError:    (e: Error) => toast.error(e.message),
  })
}
```

## Auth Architecture

The project uses a Lovable-generated Supabase auth scaffold (`src/integrations/supabase/`):

| File | Purpose |
|------|---------|
| `client.ts` | Browser client (proxy singleton, localStorage session) |
| `client.server.ts` | Service role client (bypasses RLS) |
| `auth-attacher.ts` | Global `functionMiddleware` — attaches `Authorization: Bearer <token>` to all `createServerFn` RPCs |
| `auth-middleware.ts` | `requireSupabaseAuth` — validates token in server functions, provides `context.supabase` with RLS |

**Flow:**
```
Browser → supabase.auth.signInWithPassword()
       → session stored in localStorage
       → attachSupabaseAuth adds Bearer token to all createServerFn calls
       → requireSupabaseAuth validates token on server, provides RLS-scoped client
```

**Session hook:** `useSession()` from `@/modules/auth/hooks/use-session`
**Auth guard:** `_dashboard.tsx` uses `useSession()` + `useEffect` redirect to `/login`
**Sign out:** `supabase.auth.signOut()` in `AppSidebar`, redirects to `/login`
**Login page:** `/login` — combined sign-in / sign-up, design-system consistent

**Note on `as any` in server functions:** Tables from migrations 007–010 (`orders`, `campaigns`, `nfe_emissions`, `automation_flows`, etc.) use `(context.supabase as any)` because they're not yet in `src/integrations/supabase/types.ts`. After running all migrations, regenerate types and remove the casts:

After running migrations, regenerate types:
```bash
supabase gen types typescript --project-id ztaozvgmzycetiwwkhjc > src/integrations/supabase/types.ts
```

## Key Constraints
- **TypeScript strict** — no `any`, explicit types for all domain entities
- **`framer-motion`** is used in several components but not in `package.json` — install if errors arise: `npm install framer-motion`
- `@` alias resolves to `src/` (via `vite-tsconfig-paths`)
- **Service role key** (`SUPABASE_SERVICE_ROLE_KEY`) must never be committed or sent to the browser
