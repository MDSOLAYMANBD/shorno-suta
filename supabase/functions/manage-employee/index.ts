import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Authenticate using getClaims (works with signing-key JWTs)
    const token = authHeader.replace('Bearer ', '')
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    let caller: { id: string; email?: string }

    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token)
    if (!claimsError && claimsData?.claims?.sub) {
      caller = { id: claimsData.claims.sub as string, email: (claimsData.claims.email as string) || '' }
    } else {
      // Fallback: try getUser
      const { data: { user }, error: userError } = await userClient.auth.getUser()
      if (userError || !user) {
        console.error('Auth failed - getClaims:', claimsError?.message, 'getUser:', userError?.message)
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      caller = user
    }

    const { data: isAdmin } = await supabaseAdmin.rpc('has_role', { _user_id: caller.id, _role: 'admin' })

    const method = req.method
    const OWNER_EMAIL = 'amisrsolayman@gmail.com'

    // Helper: check if target user is the owner
    const isOwnerAccount = async (userId: string) => {
      const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId)
      return user?.email === OWNER_EMAIL
    }

    // POST - Create employee via invitation
    if (method === 'POST') {
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const { email, password, full_name, phone, role } = await req.json()

      if (!email || !role) {
        return new Response(JSON.stringify({ error: 'Email and role are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      let newUserId: string

      if (password) {
        // Legacy: create with password directly
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        })
        if (createError) {
          return new Response(JSON.stringify({ error: createError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        newUserId = newUser.user.id
      } else {
        // Invitation flow: send invite email
        const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email)
        if (inviteError) {
          return new Response(JSON.stringify({ error: inviteError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        newUserId = inviteData.user.id
      }

      await supabaseAdmin.from('user_roles').insert({ user_id: newUserId, role })
      await supabaseAdmin.from('employee_profiles').insert({
        user_id: newUserId,
        full_name: full_name || 'স্বর্ণ সুতা',
        phone: phone || null,
      })

      return new Response(JSON.stringify({ success: true, user_id: newUserId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // PATCH - Update employee
    if (method === 'PATCH') {
      const body = await req.json()
      const { user_id, role, is_active, full_name, phone, avatar_url, new_password, reset_password } = body

      if (!user_id) {
        return new Response(JSON.stringify({ error: 'user_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Owner protection: block role/status/password changes on owner account
      if (await isOwnerAccount(user_id)) {
        const restrictedFields = ['role', 'is_active', 'new_password', 'reset_password']
        const hasRestricted = restrictedFields.some(f => body[f] !== undefined)
        if (hasRestricted && caller.id !== user_id) {
          return new Response(JSON.stringify({ error: 'মালিক অ্যাকাউন্ট পরিবর্তন করা যাবে না' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
      }

      const isSelf = caller.id === user_id
      const selfOnlyFields = ['full_name', 'phone', 'avatar_url']

      // If not admin and not editing self, deny
      if (!isAdmin && !isSelf) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // If self but not admin, only allow profile fields
      if (isSelf && !isAdmin) {
        const allowedKeys = Object.keys(body).filter(k => k !== 'user_id')
        const hasRestrictedKeys = allowedKeys.some(k => !selfOnlyFields.includes(k))
        if (hasRestrictedKeys) {
          return new Response(JSON.stringify({ error: 'You can only update your own profile info' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
      }

      // Send password reset email (admin only)
      if (reset_password) {
        if (!isAdmin) {
          return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(user_id)
        if (user?.email) {
          const { error: resetError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'recovery',
            email: user.email,
          })
          if (resetError) {
            return new Response(JSON.stringify({ error: resetError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
          }
        }
        return new Response(JSON.stringify({ success: true, message: 'Reset link generated' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Admin sets new password directly
      if (new_password) {
        if (!isAdmin) {
          return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password: new_password })
        if (pwError) {
          return new Response(JSON.stringify({ error: pwError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
      }

      // Update role (admin only)
      if (role) {
        if (!isAdmin) {
          return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        await supabaseAdmin.from('user_roles').update({ role }).eq('user_id', user_id)
      }

      // Update profile fields
      const profileUpdate: any = {}
      if (full_name !== undefined) profileUpdate.full_name = full_name
      if (phone !== undefined) profileUpdate.phone = phone
      if (is_active !== undefined) {
        if (!isAdmin) {
          return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        profileUpdate.is_active = is_active
      }
      if (avatar_url !== undefined) profileUpdate.avatar_url = avatar_url

      if (Object.keys(profileUpdate).length > 0) {
        const { error: profileError } = await supabaseAdmin.from('employee_profiles').upsert(
          { user_id, ...profileUpdate },
          { onConflict: 'user_id' }
        )
        if (profileError) {
          return new Response(JSON.stringify({ error: profileError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // DELETE
    if (method === 'DELETE') {
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const { user_id } = await req.json()
      if (!user_id) {
        return new Response(JSON.stringify({ error: 'user_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (await isOwnerAccount(user_id)) {
        return new Response(JSON.stringify({ error: 'মালিক অ্যাকাউন্ট ডিলিট করা যাবে না' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      await supabaseAdmin.auth.admin.deleteUser(user_id)
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // GET - list employees
    if (method === 'GET') {
      if (!isAdmin) {
        // Non-admin can only get their own data
        const { data: profile } = await supabaseAdmin.from('employee_profiles').select('*').eq('user_id', caller.id).single()
        const { data: roleEntry } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', caller.id).single()
        return new Response(JSON.stringify([{
          user_id: caller.id,
          email: caller.email || '',
          role: roleEntry?.role || '',
          full_name: profile?.full_name || 'স্বর্ণ সুতা',
          avatar_url: profile?.avatar_url || null,
          phone: profile?.phone || null,
          is_active: profile?.is_active ?? true,
          created_at: profile?.created_at || '',
        }]), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const { data: roles } = await supabaseAdmin.from('user_roles').select('user_id, role')
      const { data: profiles } = await supabaseAdmin.from('employee_profiles').select('*')

      const userIds = (roles || []).map(r => r.user_id)
      const employees = []

      for (const uid of userIds) {
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(uid)
        const profile = (profiles || []).find(p => p.user_id === uid)
        const roleEntry = (roles || []).find(r => r.user_id === uid)

        employees.push({
          user_id: uid,
          email: user?.email || '',
          role: roleEntry?.role || '',
          full_name: profile?.full_name || 'স্বর্ণ সুতা',
          avatar_url: profile?.avatar_url || null,
          phone: profile?.phone || null,
          is_active: profile?.is_active ?? true,
          created_at: profile?.created_at || user?.created_at || '',
        })
      }

      return new Response(JSON.stringify(employees), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
