import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';

export interface ActiveRate {
  from_currency: string;
  to_currency: string;
  buy_rate: number;
  sell_rate: number;
}

export type RateMap = Record<string, ActiveRate>; // key: `${from}/${to}`

/**
 * Loads the institution's currently active exchange rates from the Forex
 * Trading module (`exchange_rates` table) and exposes them as a lookup map.
 */
export function useTenantExchangeRates(tenantId: string | undefined) {
  const [rates, setRates] = useState<RateMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) {
      setRates({});
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('exchange_rates')
        .select('from_currency, to_currency, buy_rate, sell_rate')
        .eq('tenant_id', tenantId)
        .eq('is_active', true);
      if (fetchError) throw fetchError;

      const map: RateMap = {};
      (data ?? []).forEach((r) => {
        map[`${r.from_currency}/${r.to_currency}`] = r as ActiveRate;
      });
      setRates(map);
    } catch (err) {
      console.error('Error loading exchange rates:', err);
      setError(err instanceof Error ? err.message : 'Failed to load exchange rates');
      setRates({});
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  return { rates, loading, error, reload: load };
}

/**
 * Looks up a conversion rate from `fromCode` into `toCode` using the active
 * Forex Trading rates.
 *
 * Forex Trading typically only stores rates quoted against a single common
 * currency (e.g. USD/KES, EUR/KES, GBP/KES, UGX/KES) rather than every
 * possible pair. A naive direct-or-inverse lookup fails as soon as neither
 * `fromCode` nor `toCode` is that common currency (e.g. EUR -> UGX, when
 * only EUR/KES and UGX/KES exist).
 *
 * To fix that, this builds a small currency graph from every active pair
 * (each pair becomes a two-way edge: the stored rate one way, its
 * reciprocal the other) and does a breadth-first search for *any* chain of
 * configured rates connecting `fromCode` to `toCode`, multiplying the rates
 * along that path. A direct pair is just a one-hop path, so existing single
 * pair behaviour is unchanged - this only adds the ability to triangulate
 * through a shared currency when a direct pair isn't configured.
 */
export function lookupRate(
  rates: RateMap,
  fromCode: string,
  toCode: string,
  mode: 'buy' | 'sell' = 'buy'
): number | null {
  if (fromCode === toCode) return 1;

  const graph = new Map<string, Map<string, number>>();

  const addEdge = (a: string, b: string, rate: number) => {
    if (!Number.isFinite(rate) || rate <= 0) return;
    if (!graph.has(a)) graph.set(a, new Map());
    // If multiple active rates somehow define the same edge, keep the first.
    if (!graph.get(a)!.has(b)) graph.get(a)!.set(b, rate);
  };

  Object.values(rates).forEach((r) => {
    const rate = mode === 'buy' ? r.buy_rate : r.sell_rate;
    if (!Number.isFinite(rate) || rate <= 0) return;
    addEdge(r.from_currency, r.to_currency, rate);
    addEdge(r.to_currency, r.from_currency, 1 / rate);
  });

  if (!graph.has(fromCode)) return null;

  const visited = new Set<string>([fromCode]);
  const queue: { code: string; acc: number }[] = [{ code: fromCode, acc: 1 }];

  while (queue.length > 0) {
    const { code, acc } = queue.shift()!;
    const neighbors = graph.get(code);
    if (!neighbors) continue;

    for (const [next, rate] of neighbors) {
      if (visited.has(next)) continue;
      const nextAcc = acc * rate;
      if (next === toCode) return nextAcc;
      visited.add(next);
      queue.push({ code: next, acc: nextAcc });
    }
  }

  return null;
}