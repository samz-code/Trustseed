import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import { lookupRate, type RateMap, type ActiveRate } from './forexRates';

/**
 * Column on `exchange_rates` holding the last-modified timestamp. Change this
 * single constant if your schema names it something else (e.g. 'rate_date').
 */
const RATE_TIMESTAMP_COLUMN = 'updated_at';

/** A money figure that knows its own currency. */
export interface MoneyRow {
  amount: number;
  currency: string | null;
}

/** Total held in one specific currency. */
export interface CurrencyBucket {
  currency: string;
  total: number;
  count: number;
}

/**
 * The result of converting a mixed-currency set into one base currency.
 * `complete` is false when at least one currency had no usable rate path,
 * which means `total` understates reality and must be labelled as partial.
 */
export interface ConvertedTotal {
  /** Sum in `baseCurrency`, covering only the currencies that converted. */
  total: number;
  baseCurrency: string;
  /** Native per-currency breakdown, largest converted value first. */
  buckets: CurrencyBucket[];
  /** Rate actually applied per currency, keyed by currency code. */
  appliedRates: Record<string, number>;
  /** Currencies that had no rate path to base. Excluded from `total`. */
  unconverted: string[];
  /** True when every non-base currency converted successfully. */
  complete: boolean;
  /** Number of distinct currencies present in the source rows. */
  currencyCount: number;
}

export interface DashboardRatesState {
  rates: RateMap;
  /** Most recent rate timestamp across all active pairs, or null. */
  asOf: string | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * Loads active exchange rates the same way `useTenantExchangeRates` does, but
 * also captures the newest rate timestamp so the dashboard can state how
 * fresh its converted figures are. Conversion without a visible as-of date is
 * the thing that turns a ledger into a calculator.
 *
 * If the timestamp column does not exist, the query is retried without it so
 * the dashboard still works (it just cannot show an as-of time).
 */
export function useDashboardRates(tenantId: string | undefined): DashboardRatesState {
  const [rates, setRates] = useState<RateMap>({});
  const [asOf, setAsOf] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) {
      setRates({});
      setAsOf(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const baseColumns = 'from_currency, to_currency, buy_rate, sell_rate';

    try {
      let rows: Record<string, unknown>[] = [];
      let hasTimestamp = true;

      const withTs = await supabase
        .from('exchange_rates')
        .select(`${baseColumns}, ${RATE_TIMESTAMP_COLUMN}`)
        .eq('tenant_id', tenantId)
        .eq('is_active', true);

      if (withTs.error) {
        // Most likely the timestamp column does not exist on this schema.
        // Fall back to the plain query rather than failing the whole load.
        hasTimestamp = false;
        const plain = await supabase
          .from('exchange_rates')
          .select(baseColumns)
          .eq('tenant_id', tenantId)
          .eq('is_active', true);
        if (plain.error) throw plain.error;
        rows = (plain.data ?? []) as Record<string, unknown>[];
      } else {
        rows = (withTs.data ?? []) as Record<string, unknown>[];
      }

      const map: RateMap = {};
      let newest: string | null = null;

      rows.forEach((row) => {
        const from = row.from_currency;
        const to = row.to_currency;
        if (typeof from !== 'string' || typeof to !== 'string') return;

        const buy = Number(row.buy_rate);
        const sell = Number(row.sell_rate);

        const rate: ActiveRate = {
          from_currency: from.toUpperCase(),
          to_currency: to.toUpperCase(),
          buy_rate: Number.isFinite(buy) ? buy : 0,
          sell_rate: Number.isFinite(sell) ? sell : 0,
        };
        map[`${rate.from_currency}/${rate.to_currency}`] = rate;

        if (hasTimestamp) {
          const ts = row[RATE_TIMESTAMP_COLUMN];
          if (typeof ts === 'string' && (newest === null || ts > newest)) {
            newest = ts;
          }
        }
      });

      setRates(map);
      setAsOf(newest);
    } catch (err) {
      console.error('Error loading dashboard exchange rates:', err);
      setError(err instanceof Error ? err.message : 'Failed to load exchange rates');
      setRates({});
      setAsOf(null);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { rates, asOf, loading, error, reload: load };
}

/**
 * Buckets rows by their own currency. Rows with a null/blank currency are
 * attributed to `fallbackCurrency` rather than silently dropped.
 */
export function bucketByCurrency(
  rows: MoneyRow[],
  fallbackCurrency: string
): CurrencyBucket[] {
  const map = new Map<string, CurrencyBucket>();

  rows.forEach((row) => {
    const code = (row.currency || fallbackCurrency).toUpperCase();
    const amount = Number(row.amount);
    if (!Number.isFinite(amount)) return;
    const entry = map.get(code) ?? { currency: code, total: 0, count: 0 };
    entry.total += amount;
    entry.count += 1;
    map.set(code, entry);
  });

  return Array.from(map.values());
}

/**
 * Converts a set of currency buckets into one base currency using active
 * Forex Trading rates. Currencies with no rate path are reported in
 * `unconverted` and excluded from the total instead of being added at 1:1 --
 * adding unlike units is exactly the bug this replaces.
 *
 * `mode` is 'buy' by default: the institution values foreign holdings at the
 * rate it would buy that currency at.
 */
export function convertToBase(
  buckets: CurrencyBucket[],
  baseCurrency: string,
  rates: RateMap,
  mode: 'buy' | 'sell' = 'buy'
): ConvertedTotal {
  const base = (baseCurrency || 'KES').toUpperCase();
  const appliedRates: Record<string, number> = {};
  const unconverted: string[] = [];
  let total = 0;

  buckets.forEach((bucket) => {
    if (bucket.currency === base) {
      appliedRates[bucket.currency] = 1;
      total += bucket.total;
      return;
    }
    const rate = lookupRate(rates, bucket.currency, base, mode);
    if (rate === null || !Number.isFinite(rate) || rate <= 0) {
      unconverted.push(bucket.currency);
      return;
    }
    appliedRates[bucket.currency] = rate;
    total += bucket.total * rate;
  });

  const sorted = [...buckets].sort((a, b) => {
    const av = Math.abs(a.total * (appliedRates[a.currency] ?? 0));
    const bv = Math.abs(b.total * (appliedRates[b.currency] ?? 0));
    return bv - av;
  });

  return {
    total,
    baseCurrency: base,
    buckets: sorted,
    appliedRates,
    unconverted,
    complete: unconverted.length === 0,
    currencyCount: buckets.length,
  };
}

/** Convenience: bucket then convert in one call. */
export function aggregateMoney(
  rows: MoneyRow[],
  baseCurrency: string,
  rates: RateMap,
  mode: 'buy' | 'sell' = 'buy'
): ConvertedTotal {
  return convertToBase(
    bucketByCurrency(rows, baseCurrency),
    baseCurrency,
    rates,
    mode
  );
}

/** Empty result, for initial state and early returns. */
export function emptyTotal(baseCurrency: string): ConvertedTotal {
  return {
    total: 0,
    baseCurrency: (baseCurrency || 'KES').toUpperCase(),
    buckets: [],
    appliedRates: {},
    unconverted: [],
    complete: true,
    currencyCount: 0,
  };
}

/** Rates need more precision than money. Four decimals, trimmed. */
export function formatRate(rate: number): string {
  if (!Number.isFinite(rate)) return '-';
  const fixed = rate >= 1 ? rate.toFixed(4) : rate.toPrecision(6);
  return String(Number(fixed));
}

/**
 * Short label for a card subtitle, e.g. "2 currencies - 1 USD = 129.5 KES"
 * or "3 currencies - UGX not rated". Returns `fallback` when there is nothing
 * worth saying (single base-currency bucket).
 */
export function rateSummary(result: ConvertedTotal, fallback: string): string {
  const foreign = result.buckets.filter((b) => b.currency !== result.baseCurrency);
  if (foreign.length === 0) return fallback;

  const parts: string[] = [
    `${result.currencyCount} ${result.currencyCount === 1 ? 'currency' : 'currencies'}`,
  ];

  if (foreign.length === 1) {
    const code = foreign[0].currency;
    const rate = result.appliedRates[code];
    if (rate) {
      parts.push(`1 ${code} = ${formatRate(rate)} ${result.baseCurrency}`);
    }
  } else {
    parts.push('at active rates');
  }

  if (result.unconverted.length > 0) {
    parts.push(`${result.unconverted.join(', ')} not rated`);
  }

  return parts.join(' - ');
}

/** Human "as of" label for the rate timestamp. */
export function formatAsOf(iso: string | null): string {
  if (!iso) return 'time not recorded';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'time not recorded';
  return d.toLocaleString([], {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Native-currency breakdown as a single line, for tooltips:
 * "KES 500,000.00 + USD 4,000.00".
 */
export function breakdownLine(result: ConvertedTotal): string {
  if (result.buckets.length === 0) return 'No balances';
  return result.buckets
    .map(
      (b) =>
        `${b.currency} ${b.total.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
    )
    .join(' + ');
}