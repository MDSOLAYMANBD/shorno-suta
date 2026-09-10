import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Convert UTC timestamp to local YYYY-MM-DD (Asia/Dhaka offset +6h handled implicitly by JS in container? Use UTC fallback)
function toDateStr(input: string | null | undefined): string {
  if (!input) return ''
  try {
    const d = new Date(input)
    // Asia/Dhaka offset (+6h)
    const local = new Date(d.getTime() + 6 * 60 * 60 * 1000)
    return local.toISOString().slice(0, 10)
  } catch {
    return ''
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const kind = url.searchParams.get('type') // person | unit | unit-module
    const id = url.searchParams.get('id')
    const moduleType = url.searchParams.get('module') // for unit-module

    if (!kind || !id) {
      return new Response(JSON.stringify({ error: 'Missing type or id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const isUuid = UUID_RE.test(id)
    const slugify = (s: string | null | undefined) =>
      (s || '').toLowerCase().trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Resolve slug -> entity id
    let resolvedId = id
    if (kind === 'person' && !isUuid) {
      const { data: pRow } = await supabase
        .from('acc_persons')
        .select('id')
        .eq('person_code', id)
        .maybeSingle()
      if (pRow?.id) resolvedId = pRow.id
    } else if ((kind === 'unit' || kind === 'unit-module') && !isUuid) {
      const { data: units } = await supabase.from('acc_units').select('id, name')
      const match = (units || []).find((u: any) => slugify(u.name) === id)
      if (match?.id) resolvedId = match.id
    }

    // Fetch branding (shared with order-memo)
    const { data: settings } = await supabase
      .from('store_settings')
      .select('key, value')
      .in('key', ['invoice_config', 'navbar_config', 'store_name', 'store_name_bn', 'footer_config'])
    const sMap: Record<string, string> = {}
    settings?.forEach((s: any) => { sMap[s.key] = s.value })
    let invoiceConfig: any = {}; let navbarConfig: any = {}; let footerConfig: any = {}
    try { invoiceConfig = JSON.parse(sMap.invoice_config || '{}') } catch {}
    try { navbarConfig = JSON.parse(sMap.navbar_config || '{}') } catch {}
    try { footerConfig = JSON.parse(sMap.footer_config || '{}') } catch {}
    const branding = {
      brand_name: navbarConfig.brand_name || sMap.store_name_bn || 'Store',
      brand_name_en: navbarConfig.brand_name_en || sMap.store_name || '',
      logo_url: invoiceConfig.logo_url || '',
      brand_color: invoiceConfig.brand_color || '#16a34a',
      phone: invoiceConfig.phone || '',
      whatsapp: invoiceConfig.whatsapp || '',
      address: invoiceConfig.address || '',
      website: 'https://shorno-suta.vercel.app',
      facebook: footerConfig.facebook || footerConfig.facebook_url || '',
      youtube: footerConfig.youtube || footerConfig.youtube_url || '',
    }

    type LedgerEntry = {
      id: string
      date: string
      memo_number: string | null
      description: string
      quantity: number | null
      rate: number | null
      bill: number   // amount the entity owes us / we owe them (debit)
      paid: number   // amount paid (credit)
    }

    let entity: any = null
    let ledger: LedgerEntry[] = []

    if (kind === 'person') {
      const { data: person, error: pErr } = await supabase
        .from('acc_persons')
        .select('id, name, person_code, type, phone, base_salary, joining_date, unit_id, acc_units(name)')
        .eq('id', resolvedId)
        .single()
      if (pErr || !person) {
        return new Response(JSON.stringify({ error: 'Person not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      entity = {
        kind: 'person',
        name: person.name,
        code: person.person_code,
        type: person.type,
        phone: person.phone,
        unit_name: (person as any).acc_units?.name || null,
      }

      const [{ data: partyEntries }, { data: expenseTxns }] = await Promise.all([
        supabase
          .from('acc_party_entries')
          .select('id, memo_number, date, product_name, quantity, rate, total, is_submission, created_at')
          .eq('person_id', resolvedId)
          .order('date', { ascending: true })
          .order('created_at', { ascending: true }),
        supabase
          .from('acc_transactions')
          .select('id, amount, description, created_at, type')
          .eq('person_id', resolvedId)
          .in('type', ['expense', 'salary', 'advance', 'bonus', 'party_payment', 'production_payment'])
          .order('created_at', { ascending: true }),
      ])

      ;(partyEntries || []).forEach((e: any) => {
        ledger.push({
          id: e.id,
          date: e.date,
          memo_number: e.memo_number,
          description: e.is_submission ? 'জমা' : (e.product_name || '—'),
          quantity: e.quantity,
          rate: e.rate,
          bill: e.is_submission ? 0 : Number(e.total) || 0,
          paid: e.is_submission ? (Number(e.total) || 0) : 0,
          source: e.is_submission ? 'submission' : 'bill',
        })
      })
      ;(expenseTxns || []).forEach((tx: any) => {
        ledger.push({
          id: tx.id,
          date: toDateStr(tx.created_at),
          memo_number: null,
          description: tx.description || tx.type,
          quantity: null,
          rate: null,
          bill: 0,
          paid: Number(tx.amount) || 0,
          source: 'expense',
        })
      })
    } else if (kind === 'unit') {
      const { data: unit, error: uErr } = await supabase
        .from('acc_units')
        .select('id, name')
        .eq('id', resolvedId)
        .single()
      if (uErr || !unit) {
        return new Response(JSON.stringify({ error: 'Unit not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      entity = { kind: 'unit', name: unit.name }

      const [{ data: txns }, { data: custom }] = await Promise.all([
        supabase
          .from('acc_transactions')
          .select('id, amount, description, type, created_at')
          .eq('unit_id', resolvedId)
          .order('created_at', { ascending: true }),
        supabase
          .from('acc_unit_custom_expenses')
          .select('id, module_name, item_name, amount, date, description, created_at')
          .eq('unit_id', resolvedId)
          .order('date', { ascending: true }),
      ])
      ;(txns || []).forEach((tx: any) => {
        const isIncome = ['income', 'sale', 'office_sell', 'investment'].includes(tx.type)
        ledger.push({
          id: tx.id,
          date: toDateStr(tx.created_at),
          memo_number: null,
          description: tx.description || tx.type,
          quantity: null,
          rate: null,
          bill: isIncome ? 0 : Number(tx.amount) || 0,
          paid: isIncome ? (Number(tx.amount) || 0) : 0,
          source: isIncome ? 'income' : 'expense',
        })
      })
      ;(custom || []).forEach((ce: any) => {
        ledger.push({
          id: ce.id,
          date: ce.date,
          memo_number: null,
          description: `[${ce.module_name}] ${ce.item_name || ce.description || ''}`,
          quantity: null,
          rate: null,
          bill: Number(ce.amount) || 0,
          paid: 0,
          source: 'bill',
        })
      })
    } else if (kind === 'unit-module') {
      const { data: unit, error: uErr } = await supabase
        .from('acc_units')
        .select('id, name')
        .eq('id', resolvedId)
        .single()
      if (uErr || !unit) {
        return new Response(JSON.stringify({ error: 'Unit not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      entity = { kind: 'unit-module', name: unit.name, module: moduleType || '' }

      // Pull persons belonging to this unit and aggregate their party entries + custom expenses matching module
      const [{ data: persons }, { data: custom }] = await Promise.all([
        supabase
          .from('acc_persons')
          .select('id, name')
          .eq('unit_id', resolvedId),
        supabase
          .from('acc_unit_custom_expenses')
          .select('id, module_name, item_name, amount, date, description, created_at')
          .eq('unit_id', resolvedId)
          .order('date', { ascending: true }),
      ])

      const personIds = (persons || []).map((p: any) => p.id)
      const personMap = new Map((persons || []).map((p: any) => [p.id, p.name]))

      if (personIds.length > 0) {
        const { data: partyEntries } = await supabase
          .from('acc_party_entries')
          .select('id, person_id, memo_number, date, product_name, quantity, rate, total, is_submission, created_at')
          .in('person_id', personIds)
          .order('date', { ascending: true })
        ;(partyEntries || []).forEach((e: any) => {
          ledger.push({
            id: e.id,
            date: e.date,
            memo_number: e.memo_number,
            description: `${personMap.get(e.person_id) || ''} — ${e.is_submission ? 'জমা' : (e.product_name || '—')}`,
            quantity: e.quantity,
            rate: e.rate,
            bill: e.is_submission ? 0 : Number(e.total) || 0,
            paid: e.is_submission ? (Number(e.total) || 0) : 0,
            source: e.is_submission ? 'submission' : 'bill',
          })
        })
      }

      ;(custom || []).forEach((ce: any) => {
        // Only include custom expenses tagged with this module (loose match)
        if (moduleType && ce.module_name && !String(ce.module_name).toLowerCase().includes(moduleType.toLowerCase())) return
        ledger.push({
          id: ce.id,
          date: ce.date,
          memo_number: null,
          description: `[${ce.module_name}] ${ce.item_name || ce.description || ''}`,
          quantity: null,
          rate: null,
          bill: Number(ce.amount) || 0,
          paid: 0,
          source: 'expense',
        })
      })
    } else {
      return new Response(JSON.stringify({ error: 'Invalid type' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Sort chronological then compute running totals
    ledger.sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    let runningBill = 0
    let runningPaid = 0
    const withRunning = ledger.map(e => {
      runningBill += e.bill
      runningPaid += e.paid
      return { ...e, balance: runningBill - runningPaid }
    })
    // Newest first for display
    const display = [...withRunning].reverse()

    const summary = {
      total_bill: runningBill,
      total_paid: runningPaid,
      balance: runningBill - runningPaid,
      entry_count: withRunning.length,
    }

    return new Response(JSON.stringify({
      entity,
      ledger: display,
      summary,
      branding,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30' },
    })
  } catch (e) {
    console.error('accounting-memo error', e)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
