// supabase/functions/refresh-exchange-rates/index.ts
//
// Fetches mid-market rates once a day and recalculates every active,
// auto-updating pair across all tenants.
//
// WHY THIS RUNS SERVER-SIDE
// The browser can only refresh rates while someone happens to have the Forex
// page open. A bureau needs rates current at opening time whether or not
// anyone has logged in, so the fetch belongs in a scheduled function.
//
// WHY IT DOESN'T JUST WRITE THE MID RATE
// The API returns mid-market. A bureau buys below and sells above that, and
// the difference is its margin. Writing the mid rate into both buy and sell
// would silently zero out the institution's FX income. Instead each pair
// stores a spread_percent and the database function apply_market_rate()
// recomputes buy/sell around the fetched mid.
//
// DEPLOY
//   supabase functions deploy refresh-exchange-rates --no-verify-jwt
//
// SCHEDULE (run once in the SQL editor, after deploying):
//   select cron.schedule(
//     'trustseed-daily-fx',
//     '0 4 * * *',
//     $$ select net.http_post(
//          url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/refresh-exchange-rates',
//          headers := jsonb_build_object(
//            'Content-Type', 'application/json',
//            'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
//          )
//        ) $$
//   );
//
// Requires the pg_net extension for the outbound call:
//   create extension if not exists pg_net;

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RATE_API = 'https://open.er-api.com/v6/latest';

interface PairRow {
  from_currency: string;
  to_currency: string;
}

interface RefreshResult {
  pair: string;
  mid?: number;
  updated?: number;
  error?: string;
}

Deno.serve(async (req: Request) => {
  // Simple CORS so the function can also be triggered manually from the app.
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
    }

    // Service role: this job has no user session, and it updates rows across
    // every tenant, so it deliberately runs above RLS.
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Which pairs actually need refreshing? Only active, auto_update ones.
    const { data: pairData, error: pairErr } = await supabase.rpc('pairs_needing_refresh');
    if (pairErr) throw pairErr;

    const pairs = (pairData ?? []) as PairRow[];
    if (pairs.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: 'No auto-updating pairs configured.', results: [] }),
        { headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Group by base currency so one API call serves every pair that shares
    //    it (USD/KES and USD/UGX need a single fetch, not two).
    const byBase = new Map<string, string[]>();
    for (const p of pairs) {
      const list = byBase.get(p.from_currency) ?? [];
      list.push(p.to_currency);
      byBase.set(p.from_currency, list);
    }

    const results: RefreshResult[] = [];

    for (const [base, targets] of byBase.entries()) {
      let rates: Record<string, number> | null = null;

      try {
        const res = await fetch(`${RATE_API}/${base}`);
        if (!res.ok) throw new Error(`Rate service returned ${res.status}`);
        const json = await res.json();
        if (json?.result !== 'success' || !json?.rates) {
          throw new Error(json?.['error-type'] ?? 'Unexpected response from rate service');
        }
        rates = json.rates as Record<string, number>;
      } catch (err) {
        // One base failing must not abort the rest. Record it and continue,
        // leaving those pairs on their previous rates rather than zeroing
        // them or writing a guess.
        const message = err instanceof Error ? err.message : 'Unknown fetch error';
        for (const t of targets) results.push({ pair: `${base}/${t}`, error: message });
        continue;
      }

      for (const target of targets) {
        const mid = rates?.[target];
        if (typeof mid !== 'number' || !Number.isFinite(mid) || mid <= 0) {
          results.push({ pair: `${base}/${target}`, error: 'No rate available' });
          continue;
        }

        const { data: updated, error: applyErr } = await supabase.rpc('apply_market_rate', {
          p_from: base,
          p_to: target,
          p_mid: mid,
        });

        if (applyErr) {
          results.push({ pair: `${base}/${target}`, mid, error: applyErr.message });
        } else {
          results.push({ pair: `${base}/${target}`, mid, updated: Number(updated ?? 0) });
        }
      }
    }

    const totalUpdated = results.reduce((sum, r) => sum + (r.updated ?? 0), 0);
    const failures = results.filter((r) => r.error);

    return new Response(
      JSON.stringify({
        ok: failures.length === 0,
        ranAt: new Date().toISOString(),
        pairsChecked: results.length,
        rowsUpdated: totalUpdated,
        failures: failures.length,
        results,
      }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('refresh-exchange-rates failed:', err);
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
});