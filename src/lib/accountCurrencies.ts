// src/lib/accountCurrencies.ts
//
// Single source of truth for currency handling across Daily Operations
// (Opening / Closing) and the legacy DailyOperations page.
//
// The bug this fixes: reference (non-cash) accounts — Bank, MTN Mobile Money,
// M-Pesa — were defaulting to a hardcoded "KES" for their *displayed* currency
// while conversion math used the institution base currency. Label and math
// therefore disagreed whenever the base currency was not KES.
//
// Now every balance row resolves its currency through one function
// (`currencyForKey`), and reference accounts are configurable per institution,
// defaulting to the base currency instead of KES.

export interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
  /** Emoji flag for quick visual identification in pickers and lists. */
  flag: string;
}

export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', flag: '🇰🇪' },
  { code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh', flag: '🇺🇬' },
  { code: 'SSP', name: 'South Sudanese Pound', symbol: 'SSP', flag: '🇸🇸' },
  { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh', flag: '🇹🇿' },
  { code: 'RWF', name: 'Rwandan Franc', symbol: 'RWF', flag: '🇷🇼' },
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧' },
];

export const CURRENCY_SYMBOL_MAP: Record<string, string> = CURRENCY_OPTIONS.reduce(
  (acc, c) => ({ ...acc, [c.code]: c.symbol }),
  {} as Record<string, string>
);

export const CURRENCY_FLAG_MAP: Record<string, string> = CURRENCY_OPTIONS.reduce(
  (acc, c) => ({ ...acc, [c.code]: c.flag }),
  {} as Record<string, string>
);

// Reference (non-cash) channels that each carry a configurable currency.
export const REFERENCE_ACCOUNTS = ['bank', 'mtn_momo', 'mpesa'] as const;
export type ReferenceAccount = (typeof REFERENCE_ACCOUNTS)[number];

export const REFERENCE_ACCOUNT_LABELS: Record<string, string> = {
  bank: 'Bank',
  mtn_momo: 'MTN Mobile Money',
  mpesa: 'M-Pesa',
};

// code -> currency code, e.g. { bank: 'USD', mtn_momo: 'UGX', mpesa: 'KES' }
export type AccountCurrencyMap = Record<string, string>;

export function currencySymbol(currency: string): string {
  return CURRENCY_SYMBOL_MAP[currency] ?? `${currency} `;
}

/** Emoji flag for a currency, with a neutral fallback for unknown codes. */
export function currencyFlag(currency: string): string {
  return CURRENCY_FLAG_MAP[currency] ?? '🏳️';
}

export function formatMoney(value: number, currency = 'KES'): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${currencySymbol(currency)}${safe.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Money formatted with a leading flag, e.g. "🇰🇪 KSh1,000.00". */
export function formatMoneyWithFlag(value: number, currency = 'KES'): string {
  return `${currencyFlag(currency)} ${formatMoney(value, currency)}`;
}

/**
 * The one place that answers "what currency is this balance row in?".
 *
 * - Cash rows carry their currency in the key itself: `cash_USD` -> `USD`.
 * - Reference accounts (bank, mtn_momo, mpesa) use their configured currency,
 *   falling back to the institution base currency — NEVER a hardcoded KES.
 * - Anything else falls back to the base currency too.
 */
export function currencyForKey(
  key: string,
  accountCurrencies: AccountCurrencyMap,
  baseCurrency: string
): string {
  if (key.startsWith('cash_')) return key.slice(5) || baseCurrency;
  return accountCurrencies[key] ?? baseCurrency;
}

/** Human-readable label for a balance key. */
export function labelForKey(key: string): string {
  if (key.startsWith('cash_')) return `Cash (${key.slice(5)})`;
  return REFERENCE_ACCOUNT_LABELS[key] ?? key.replace(/_/g, ' ');
}

/**
 * Normalise a (possibly missing / partial) configured map into a complete
 * per-account currency map, defaulting each reference account to the base
 * currency when not explicitly configured.
 */
export function resolveAccountCurrencies(
  configured: AccountCurrencyMap | undefined,
  baseCurrency: string
): AccountCurrencyMap {
  const out: AccountCurrencyMap = {};
  for (const acc of REFERENCE_ACCOUNTS) {
    const code = configured?.[acc];
    out[acc] = code && code.trim() !== '' ? code : baseCurrency;
  }
  return out;
}

/** True when two account-currency maps differ for any reference account. */
export function accountCurrenciesDiffer(
  a: AccountCurrencyMap,
  b: AccountCurrencyMap
): boolean {
  return REFERENCE_ACCOUNTS.some((acc) => a[acc] !== b[acc]);
}