import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await anonClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { action } = await req.json()
    const now = new Date()
    const bdNow = new Date(now.getTime() + 6 * 60 * 60 * 1000)
    const dateStr = bdNow.toISOString().split('T')[0]

    // Fetch employee duty config
    const { data: empProfile } = await supabase
      .from('employee_profiles')
      .select('duty_start_time, duty_end_time, off_day')
      .eq('user_id', user.id)
      .maybeSingle()

    const dutyStartTime = empProfile?.duty_start_time || '10:00'
    const dutyEndTime = empProfile?.duty_end_time || '21:00'
    const offDay = empProfile?.off_day || 'friday'

    // Parse time string "HH:00" to minutes
    const parseTimeToMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number)
      return h * 60 + (m || 0)
    }

    const officeStartMinutes = parseTimeToMinutes(dutyStartTime)
    const officeEndMinutes = parseTimeToMinutes(dutyEndTime)

    // Check off day
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const bdDayOfWeek = bdNow.getUTCDay()
    const todayDayName = dayNames[bdDayOfWeek]

    // Get today's record
    const { data: existing } = await supabase
      .from('staff_attendance')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', dateStr)
      .maybeSingle()

    if (action === 'check_in') {
      if (existing?.check_in) {
        return new Response(JSON.stringify({ error: 'আজকে ইতিমধ্যে চেক-ইন করা হয়েছে' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const bdHours = bdNow.getUTCHours()
      const bdMinutes = bdNow.getUTCMinutes()
      const totalMinutes = bdHours * 60 + bdMinutes
      const lateMinutes = Math.max(0, totalMinutes - officeStartMinutes)

      let status = lateMinutes > 0 ? 'late' : 'present'
      if (todayDayName === offDay) status = 'off_day'

      const record = {
        user_id: user.id,
        date: dateStr,
        check_in: now.toISOString(),
        status,
        late_minutes: todayDayName === offDay ? 0 : lateMinutes,
      }

      const { data, error } = await supabase
        .from('staff_attendance')
        .upsert(record, { onConflict: 'user_id,date' })
        .select()
        .single()

      if (error) throw error

      let message = ''
      if (todayDayName === offDay) {
        message = 'ছুটির দিনে চেক-ইন ✅'
      } else if (lateMinutes > 0) {
        message = `আপনি ${lateMinutes} মিনিট লেট ⏰`
      } else {
        message = 'আপনি সময়মতো এসেছেন ✅'
      }

      return new Response(JSON.stringify({ success: true, data, message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'lunch_start') {
      if (!existing?.check_in) {
        return new Response(JSON.stringify({ error: 'আগে চেক-ইন করুন' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (existing?.lunch_start) {
        return new Response(JSON.stringify({ error: 'লাঞ্চ ইতিমধ্যে শুরু হয়েছে' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const { data, error } = await supabase
        .from('staff_attendance')
        .update({ lunch_start: now.toISOString() })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) throw error
      return new Response(JSON.stringify({ success: true, data, message: 'লাঞ্চ শুরু হয়েছে 🍽️ — ৬০ মিনিট আছে' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'lunch_end') {
      if (!existing?.lunch_start) {
        return new Response(JSON.stringify({ error: 'আগে লাঞ্চ শুরু করুন' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (existing?.lunch_end) {
        return new Response(JSON.stringify({ error: 'লাঞ্চ ইতিমধ্যে শেষ হয়েছে' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const lunchStartTime = new Date(existing.lunch_start).getTime()
      const durationMinutes = Math.round((now.getTime() - lunchStartTime) / 60000)
      const lunchOvertime = Math.max(0, durationMinutes - 60)

      const { data, error } = await supabase
        .from('staff_attendance')
        .update({
          lunch_end: now.toISOString(),
          lunch_duration_minutes: durationMinutes,
          lunch_overtime_minutes: lunchOvertime,
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) throw error
      const msg = lunchOvertime > 0 ? `লাঞ্চে ${lunchOvertime} মিনিট অতিরিক্ত ⚠️` : `লাঞ্চ শেষ — ${durationMinutes} মিনিট ✅`
      return new Response(JSON.stringify({ success: true, data, message: msg }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'check_out') {
      if (!existing?.check_in) {
        return new Response(JSON.stringify({ error: 'আগে চেক-ইন করুন' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (existing?.check_out) {
        return new Response(JSON.stringify({ error: 'ইতিমধ্যে চেক-আউট করা হয়েছে' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const bdHours = bdNow.getUTCHours()
      const bdMinutes = bdNow.getUTCMinutes()
      const totalMinutes = bdHours * 60 + bdMinutes
      const earlyLeave = todayDayName === offDay ? 0 : Math.max(0, officeEndMinutes - totalMinutes)
      const overtime = todayDayName === offDay ? 0 : Math.max(0, totalMinutes - officeEndMinutes)

      const checkInTime = new Date(existing.check_in).getTime()
      const lunchDuration = existing.lunch_duration_minutes || 0
      const totalWorkingMinutes = Math.round((now.getTime() - checkInTime) / 60000) - lunchDuration
      const totalWorkingHours = Math.round((totalWorkingMinutes / 60) * 100) / 100

      const { data, error } = await supabase
        .from('staff_attendance')
        .update({
          check_out: now.toISOString(),
          early_leave_minutes: earlyLeave,
          overtime_minutes: overtime,
          total_working_hours: totalWorkingHours,
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) throw error
      let msg = `ডিউটি শেষ — মোট ${totalWorkingHours} ঘণ্টা কাজ`
      if (earlyLeave > 0) msg += ` | ${earlyLeave} মিনিট আগে ছুটি`
      if (overtime > 0) msg += ` | ${overtime} মিনিট ওভারটাইম 🌟`
      return new Response(JSON.stringify({ success: true, data, message: msg }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'get_today') {
      return new Response(JSON.stringify({ success: true, data: existing }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'get_monthly') {
      const { month, year } = await req.json().catch(() => ({}))
      const m = month || bdNow.getUTCMonth() + 1
      const y = year || bdNow.getUTCFullYear()
      const startDate = `${y}-${String(m).padStart(2, '0')}-01`
      const endDate = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`

      const { data, error } = await supabase
        .from('staff_attendance')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lt('date', endDate)
        .order('date', { ascending: false })

      if (error) throw error
      return new Response(JSON.stringify({ success: true, data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
