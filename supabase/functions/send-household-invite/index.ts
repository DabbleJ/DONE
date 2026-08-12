import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const doneAppUrl = 'https://done-family.vercel.app'

const jsonResponse = (body: Record<string, unknown>, status = 200) => new Response(
  JSON.stringify(body),
  { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
)

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Sign in to send an invitation.' }, 401)
    }

    const token = authHeader.replace('Bearer ', '')
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )
    const { data: { user }, error: authError } = await authClient.auth.getUser(token)
    if (authError || !user) {
      console.warn('[send-household-invite] rejected invalid session')
      return jsonResponse({ error: 'Your session has expired. Please sign in again.' }, 401)
    }

    const body = await req.json()
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailPattern.test(email) || email.length > 254) {
      return jsonResponse({ error: 'Enter a valid email address.' }, 400)
    }
    if (email === user.email?.toLowerCase()) {
      return jsonResponse({ error: 'Invite someone other than yourself.' }, 400)
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
    const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${doneAppUrl}/auth/callback`,
      data: { invited_by: user.id },
    })

    if (inviteError) {
      console.error('[send-household-invite] invite failed', { userId: user.id, status: inviteError.status })
      const alreadyRegistered = /already|registered|exists/i.test(inviteError.message)
      return jsonResponse({
        error: alreadyRegistered
          ? 'That person already has a DONE. account. Share the invite link with them instead.'
          : 'The email invitation could not be sent. Please try again.',
      }, alreadyRegistered ? 409 : 500)
    }

    console.log('[send-household-invite] invitation sent', { userId: user.id })
    return jsonResponse({ sent: true })
  } catch (error) {
    console.error('[send-household-invite] unexpected error', { message: error instanceof Error ? error.message : 'unknown' })
    return jsonResponse({ error: 'The email invitation could not be sent. Please try again.' }, 500)
  }
})
