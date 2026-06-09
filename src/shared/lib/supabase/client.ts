// Canonical Supabase browser client lives in src/integrations/supabase/client.ts
// This re-export keeps @/shared/lib/supabase/client as a valid import path.
export { supabase as getSupabaseBrowserClient } from '@/integrations/supabase/client'
export { supabase } from '@/integrations/supabase/client'
