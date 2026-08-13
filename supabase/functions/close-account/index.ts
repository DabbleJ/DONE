import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const jsonResponse = (body: Record<string, unknown>, status = 200) => new Response(
  JSON.stringify(body),
  { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
)

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ error: 'Sign in to close your account.' }, 401)

    const token = authHeader.slice('Bearer '.length)
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )
    const { data: { user }, error: authError } = await authClient.auth.getUser(token)
    if (authError || !user) {
      console.warn('[close-account] rejected invalid session')
      return jsonResponse({ error: 'Your session has expired. Please sign in again.' }, 401)
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
    const { error: householdError } = await adminClient.from('households').delete().eq('owner_id', user.id)
    if (householdError) {
      console.error('[close-account] failed to close owned households', { userId: user.id, code: householdError.code })
      return jsonResponse({ error: 'Your account could not be closed. Please try again.' }, 500)
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id)
    if (deleteError) {
      console.error('[close-account] failed to delete user', { userId: user.id, status: deleteError.status })
      return jsonResponse({ error: 'Your account could not be closed. Please try again.' }, 500)
    }

    console.log('[close-account] account closed', { userId: user.id })
    return jsonResponse({ closed: true })
  } catch (error) {
    console.error('[close-account] unexpected error', { message: error instanceof Error ? error.message : 'unknown' })
    return jsonResponse({ error: 'Your account could not be closed. Please try again.' }, 500)
  }
})
