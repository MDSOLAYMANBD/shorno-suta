import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkBalanceWithProvider, getActiveSmsProvider } from "../_shared/smsProviders.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization")?.replace("Bearer ", "") || "";
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    let authorized = authHeader === serviceRoleKey;
    if (!authorized) {
      const supabaseAuth = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: `Bearer ${authHeader}` } } }
      );
      const { data: claimsData } = await supabaseAuth.auth.getClaims(authHeader);
      if (claimsData?.claims?.sub) {
        const { data: hasAny } = await supabaseAuth.rpc('has_any_role', { _user_id: claimsData.claims.sub });
        if (hasAny === true) authorized = true;
      }
    }
    if (!authorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Optional ?provider=mimsms|automas, else uses active provider
    const url = new URL(req.url);
    let providerName = url.searchParams.get("provider") || "";
    if (!providerName) {
      try {
        const body = req.method !== "GET" ? await req.json().catch(() => null) : null;
        providerName = body?.provider || "";
      } catch {}
    }
    if (!providerName) {
      const active = await getActiveSmsProvider(supabase);
      providerName = active?.provider_name || "mimsms";
    }

    const result = await checkBalanceWithProvider(supabase, providerName);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Balance check error:', (err as Error).message);
    return new Response(JSON.stringify({ error: (err as Error).message, balance: null }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
