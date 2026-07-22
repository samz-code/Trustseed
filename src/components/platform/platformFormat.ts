/**
 * Shared formatting for the Platform Console.
 *
 * Subscription revenue is denominated in USD: Trust Seed bills every
 * institution in dollars regardless of the currency that institution
 * operates in internally. Keeping the currency in ONE constant here means
 * it can never drift between pages the way a hardcoded symbol does.
 *
 * Note: transaction VOLUME across tenants is a different matter. Tenants
 * transact in KES, USD, SSP and others, so a single summed figure mixes
 * currencies. It is labelled as an indicative total rather than presented
 * as if it were a real dollar amount.
 */

export const PLATFORM_CURRENCY = 'USD';

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: PLATFORM_CURRENCY,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const usdPrecise = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: PLATFORM_CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Whole-dollar figure, e.g. $5,798 — for headline metrics. */
export function money(value: number | null | undefined): string {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return usd.format(n);
}

/** Two-decimal figure, e.g. $499.00 — for per-row billing amounts. */
export function moneyExact(value: number | null | undefined): string {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return usdPrecise.format(n);
}

/** Plain integer with thousands separators. */
export function count(value: number | null | undefined): string {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return n.toLocaleString('en-US');
}

/** Compact figure for tight table cells, e.g. 1.2M. */
export function compact(value: number | null | undefined): string {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Human label from a snake_case enum, e.g. past_due -> Past due. */
export function label(value: string | null | undefined): string {
  if (!value) return '—';
  const s = value.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}