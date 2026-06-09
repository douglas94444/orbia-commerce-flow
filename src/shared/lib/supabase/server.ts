// Canonical server-side Supabase clients live in src/integrations/supabase/client.server.ts
// This re-export keeps @/shared/lib/supabase/server as a valid import path.
//
// getSupabaseServiceClient()  → supabaseAdmin (bypasses RLS)
// getSupabaseServerClient()   → use requireSupabaseAuth middleware instead
export { supabaseAdmin as getSupabaseServiceClient } from '@/integrations/supabase/client.server'
export { supabaseAdmin } from '@/integrations/supabase/client.server'

// For user-scoped server access, use requireSupabaseAuth middleware from:
// @/integrations/supabase/auth-middleware
// It validates the Bearer token and provides context.supabase with RLS enforced.
export type { } from '@/integrations/supabase/auth-middleware'
