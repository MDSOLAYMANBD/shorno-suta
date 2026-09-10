// One-shot diagnostic: calls steadfast-webhook with a fake Steadfast payload
// using the COURIER_WEBHOOK_SECRET that is only available inside edge runtime.
// SAFE: payload tagged with _test:true so we can roll it back cleanly.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const WEBHOOK_SECRET = Deno.env.get('COURIER_WEBHOOK_SECRET') || '';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  if (!WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: 'COURIER_WEBHOOK_SECRET missing' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const consignmentId = url.searchParams.get('consignment_id') || '245548746';
  const testStatus = url.searchParams.get('status') || 'in_transit';

  const payload = {
    consignment_id: consignmentId,
    status: testStatus,
    note: 'SELF-TEST event from steadfast-webhook-selftest',
    rider_name: 'Test Rider',
    rider_phone: '01700000000',
    hub_name: 'Test Hub',
    _test: true,
  };

  const target = `${SUPABASE_URL}/functions/v1/steadfast-webhook?secret=${encodeURIComponent(WEBHOOK_SECRET)}`;

  const startedAt = Date.now();
  const res = await fetch(target, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  const elapsed = Date.now() - startedAt;

  return new Response(JSON.stringify({
    ok: res.ok,
    status: res.status,
    elapsed_ms: elapsed,
    target,
    sent_payload: payload,
    response_body: text,
  }, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
