import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { phone, password, fullName } = await req.json()

    if (!phone || !password || !fullName) {
      return new Response(JSON.stringify({ error: 'phone, password, fullName required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const cleanPhone = phone.replace(/[\s-]/g, '').replace(/^\+?88/, '')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ── Verify OTP was completed for this phone before allowing signup ──
    const { data: otpRecord } = await supabaseAdmin
      .from('otp_codes')
      .select('id, verified, created_at')
      .eq('phone', cleanPhone)
      .eq('verified', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!otpRecord) {
      return new Response(JSON.stringify({ error: 'Phone not verified. Complete OTP first.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check OTP was verified within the last 10 minutes
    const otpAge = Date.now() - new Date(otpRecord.created_at).getTime()
    if (otpAge > 10 * 60 * 1000) {
      return new Response(JSON.stringify({ error: 'OTP expired. Please request a new code.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const email = `${cleanPhone}@phone.shorno-suta.app`

    let userId: string | undefined

    // Try to create user with auto-confirm
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, phone: cleanPhone },
    })

    if (error) {
      if (error.message?.includes('already been registered') || error.message?.includes('already exists')) {
        // Find and auto-confirm existing user
        const { data: users } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1, page: 1 })
        const existing = users?.users?.find(u => u.email === email)
        if (existing) {
          await supabaseAdmin.auth.admin.updateUserById(existing.id, { email_confirm: true })
          userId = existing.id
        }
      } else {
        throw error
      }
    } else {
      userId = data.user?.id
    }

    // Auto-link past orders by phone number (OTP already verified above)
    if (userId && cleanPhone) {
      try {
        const phoneVariants = [cleanPhone, `+88${cleanPhone}`, `88${cleanPhone}`]
        
        for (const phoneVar of phoneVariants) {
          await supabaseAdmin
            .from('orders')
            .update({ customer_user_id: userId })
            .eq('customer_phone', phoneVar)
            .is('customer_user_id', null)
        }
      } catch (linkErr) {
        console.error('Order linking error (non-fatal):', linkErr)
      }
    }

    // Clean up used OTP record
    try {
      await supabaseAdmin
        .from('otp_codes')
        .delete()
        .eq('id', otpRecord.id)
    } catch (_) { /* non-fatal */ }

    return new Response(JSON.stringify({ success: true, userId, existing: !!error }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('customer-signup error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Signup failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
