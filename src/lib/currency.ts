import { useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * Single source of truth for currency formatting across the app.
 *
 * Every module used to keep its own local symbol map that defaulted to "$",
 * which is why a KES tenant sometimes rendered dollar signs. Use this hook
 * (or the standalone helpers) everywhere instead.
 */

// ISO code -> display symbol. Extend as you add supported currencies.
export const CURRENCY_SYMBOLS: Record<string, string> = {
  KES: 'KSh',
  USD: '$',
  EUR: '\u20ac',
  GBP: '\u00a3',
  SSP: 'SSP',
  UGX: 'USh',
  TZS: 'TSh',
  RWF: 'FRw',
  NGN: '\u20a6',
  ZAR: 'R',
  GHS: 'GH\u20b5',
};

export function currencySymbol(code: string | null | undefined): string {
  if (!code) return '';
  return CURRENCY_SYMBOLS[code.toUpperCase()] ?? `${code.toUpperCase()} `;
}

/**
 * Format an amount with the given currency code.
 * Symbol currencies render as "KSh 1,234.00"; unknown codes fall back to
 * "XYZ 1,234.00".
 */
export function formatCurrency(
  amount: number | null | undefined,
  code: string | null | undefined,
  opts: { minimumFractionDigits?: number; maximumFractionDigits?: number } = {}
): string {
  const value = typeof amount === 'number' && !Number.isNaN(amount) ? amount : 0;
  const { minimumFractionDigits = 2, maximumFractionDigits = 2 } = opts;
  const formatted = value.toLocaleString(undefined, { minimumFractionDigits, maximumFractionDigits });
  const sym = currencySymbol(code);
  // Symbols that are letters (KSh, SSP, USh...) read better with a trailing
  // space; single-glyph symbols ($, EUR sign) sit flush.
  const needsSpace = /[A-Za-z]$/.test(sym);
  return sym ? `${sym}${needsSpace ? ' ' : ''}${formatted}` : formatted;
}

/**
 * Hook bound to the current tenant's default currency. Use `format()` for the
 * tenant default, or pass an explicit code for multi-currency rows.
 */
export function useCurrency() {
  const { tenant } = useAuth();

  const defaultCurrency = useMemo(() => {
    const settings = tenant?.settings as { default_currency?: string } | null;
    return settings?.default_currency || 'KES';
  }, [tenant]);

  const enabledCurrencies = useMemo(() => {
    const settings = tenant?.settings as { enabled_currencies?: string[] } | null;
    const list = settings?.enabled_currencies;
    return list && list.length > 0 ? list : [defaultCurrency];
  }, [tenant, defaultCurrency]);

  const format = useCallback(
    (
      amount: number | null | undefined,
      code?: string | null,
      opts?: { minimumFractionDigits?: number; maximumFractionDigits?: number }
    ) => formatCurrency(amount, code ?? defaultCurrency, opts),
    [defaultCurrency]
  );

  const symbol = useCallback((code?: string | null) => currencySymbol(code ?? defaultCurrency), [
    defaultCurrency,
  ]);

  return { defaultCurrency, enabledCurrencies, format, symbol };
}