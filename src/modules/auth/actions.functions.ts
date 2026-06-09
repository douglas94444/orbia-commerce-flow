import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { logAudit } from '@/shared/lib/logger'
import type { Tables } from '@/integrations/supabase/types'

export type Profile = Pick<Tables<'profiles'>, 'id' | 'full_name' | 'avatar_url' | 'role'>

// ─── getProfile ───────────────────────────────────────────────

export const getProfile = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Profile> => {
    const { data, error } = await context.supabase
      .from('profiles')
      .select('id, full_name, avatar_url, role')
      .eq('id', context.userId)
      .single()

    if (error) throw new Error(error.message)
    return data
  })

// ─── updateProfile ────────────────────────────────────────────

const updateProfileSchema = z.object({
  full_name:  z.string().min(2).max(100),
  avatar_url: z.string().url().optional().nullable(),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

export const updateProfile = createServerFn({ method: 'POST' })
  .inputValidator(updateProfileSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name:  data.full_name,
        avatar_url: data.avatar_url ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', context.userId)

    if (error) throw new Error(error.message)

    await logAudit({
      user_id:     context.userId,
      action:      'update',
      resource:    'profile',
      resource_id: context.userId,
      new_data:    { full_name: data.full_name },
    })

    return { success: true }
  })
