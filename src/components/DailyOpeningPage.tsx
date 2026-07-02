import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Tables, InsertTables, Json } from '../lib/supabase';
import type { TenantSettings } from '../types';
import { useTenantExchangeRates, lookupRate } from '../lib/forexRates';
import {
  Sunrise,
  Loader2,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Lock,
  Wallet,
  Banknote,
  Landmark,
  Smartphone,
  Coins,
  Check,
  Save,
  Globe,
} from 'lucide-react';

type DailyOperation = Tables<'daily_operations'>;

interface BalanceRow {
  key: string;
  label: string;
  amount: string;
}

interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
}

const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh' },
  { code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh' },
  { code: 'SSP', name: 'South Sudanese Pound', symbol: 'SSP' },
  { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh' },
  { code: 'RWF', name: 'Rwandan Franc', symbol: 'RWF' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '\u20ac' },
  { code: 'GBP', name: 'British Pound', symbol: '\u00a3' },
];

const CURRENCY_SYMBOL_MAP: Record<string, string> = CURRENCY_OPTIONS.reduce(
  (acc, c) => ({ ...acc, [c.code]: c.symbol }),
  {} as Record<string, string>
);

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatMoney(value: number, currency = 'KES'): string {
  const symbol = CURRENCY_SYMBOL_MAP[currency] ?? `${currency} `;
  return `${symbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function currencyPrefix(key: string): string {
  return key.startsWith('cash_') ? key.slice(5) : 'KES';
}

// Non-cash channels (bank, mobile money) are treated as already denominated
// in the institution's base currency; only physical cash carries its own
// currency code and needs conversion.
function currencyForRow(key: string, baseCurrency: string): string {
  return key.startsWith('cash_') ? key.slice(5) : baseCurrency;
}

function ChannelIcon({ channelKey, className }: { channelKey: string; className?: string }) {
  if (channelKey.startsWith('cash_')) return <Banknote className={className} />;
  if (channelKey === 'bank') return <Landmark className={className} />;
  if (channelKey === 'mtn_momo' || channelKey === 'mpesa') return <Smartphone className={className} />;
  return <Wallet className={className} />;
}

function buildRows(
  currencies: string[],
  prefill: Record<string, number>,
  existing: BalanceRow[]
): BalanceRow[] {
  const existingMap = new Map(existing.map((r) => [r.key, r.amount]));

  const valueFor = (key: string): string => {
    const kept = existingMap.get(key);
    if (kept !== undefined) return kept;
    return prefill[key] !== undefined ? String(prefill[key]) : '';
  };

  const currencyRows: BalanceRow[] = currencies.map((c) => ({
    key: `cash_${c}`,
    label: `Cash (${c})`,
    amount: valueFor(`cash_${c}`),
  }));

  const fixedRows: BalanceRow[] = [
    { key: 'bank', label: 'Bank', amount: valueFor('bank') },
    { key: 'mtn_momo', label: 'MTN Mobile Money', amount: valueFor('mtn_momo') },
    { key: 'mpesa', label: 'M-Pesa', amount: valueFor('mpesa') },
  ];

  return [...currencyRows, ...fixedRows];
}

function parseBalances(json: Json): Record<string, number> {
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
      const num = typeof v === 'number' ? v : parseFloat(String(v));
      if (!Number.isNaN(num)) out[k] = num;
    }
    return out;
  }
  return {};
}

type TenantSettingsShape = Partial<TenantSettings> & {
  base_currency?: string;
  [key: string]: unknown;
};

function StatusPill({ state }: { state: 'pending' | 'open' | 'closed' | 'blocked' }) {
  const styles: Record<typeof state, string> = {
    pending: 'bg-[#ee7b22]/10 text-[#ee7b22] border-[#ee7b22]/30',
    open: 'bg-[#1ebcb2]/10 text-[#1ebcb2] border-[#1ebcb2]/30',
    closed: 'bg-[#641f60]/10 text-[#641f60] border-[#641f60]/30',
    blocked: 'bg-[#c46040]/10 text-[#c46040] border-[#c46040]/30',
  };
  const labels: Record<typeof state, string> = {
    pending: 'Not opened',
    open: 'Open',
    closed: 'Closed',
    blocked: 'Blocked',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${styles[state]}`}>
      {labels[state]}
    </span>
  );
}

export function DailyOpeningPage() {
  const { tenant, branch, admin } = useAuth();

  const [todaysOp, setTodaysOp] = useState<DailyOperation | null>(null);
  const [unclosedPriorOp, setUnclosedPriorOp] = useState<DailyOperation | null>(null);
  const [lastClosingBalances, setLastClosingBalances] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [rows, setRows] = useState<BalanceRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>(['KES']);
  const [baseCurrency, setBaseCurrency] = useState<string>('KES');
  const [manualRates, setManualRates] = useState<Record<string, string>>({});
  const settingsInitialized = useRef(false);

  const [savingDefault, setSavingDefault] = useState(false);
  const [defaultSaved, setDefaultSaved] = useState(false);
  const [defaultSaveError, setDefaultSaveError] = useState<string | null>(null);

  const { rates: fxRates, loading: fxLoading, error: fxError, reload: reloadFx } = useTenantExchangeRates(tenant?.id);

  const tenantSettings = useMemo<TenantSettingsShape>(
    () => (tenant?.settings ?? {}) as TenantSettingsShape,
    [tenant]
  );
  const tenantDefaultCurrencies = useMemo(
    () => (tenantSettings.enabled_currencies?.length ? tenantSettings.enabled_currencies : ['KES']),
    [tenantSettings]
  );
  const tenantDefaultBase = useMemo(
    () => tenantSettings.base_currency ?? tenantSettings.default_currency ?? tenantDefaultCurrencies[0] ?? 'KES',
    [tenantSettings, tenantDefaultCurrencies]
  );

  useEffect(() => {
    if (!settingsInitialized.current && tenant) {
      setSelectedCurrencies(tenantDefaultCurrencies);
      setBaseCurrency(tenantDefaultBase);
      settingsInitialized.current = true;
    }
  }, [tenant, tenantDefaultCurrencies, tenantDefaultBase]);

  const loadState = useCallback(async () => {
    if (!tenant || !branch) return;
    setLoading(true);
    setLoadError(null);
    try {
      const today = todayIso();

      const { data: todayRow, error: todayError } = await supabase
        .from('daily_operations')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('branch_id', branch.id)
        .eq('operation_date', today)
        .maybeSingle();
      if (todayError) throw todayError;
      setTodaysOp(todayRow);

      const { data: priorRows, error: priorError } = await supabase
        .from('daily_operations')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('branch_id', branch.id)
        .neq('operation_date', today)
        .order('operation_date', { ascending: false })
        .limit(5);
      if (priorError) throw priorError;

      const unclosed = (priorRows ?? []).find((r) => r.state !== 'closed') ?? null;
      setUnclosedPriorOp(unclosed);

      const lastClosed = (priorRows ?? []).find((r) => r.state === 'closed');
      setLastClosingBalances(lastClosed ? parseBalances(lastClosed.closing_balances) : {});
    } catch (err) {
      console.error('Error loading daily opening state:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load daily opening status');
    } finally {
      setLoading(false);
    }
  }, [tenant, branch]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  useEffect(() => {
    if (todaysOp) return;
    setRows((prev) => buildRows(selectedCurrencies, lastClosingBalances, prev));
  }, [selectedCurrencies, lastClosingBalances, todaysOp]);

  const toggleCurrency = (code: string) => {
    setFormError(null);
    setSelectedCurrencies((prev) => {
      let next: string[];
      if (prev.includes(code)) {
        if (prev.length === 1) return prev; // keep at least one selected
        next = prev.filter((c) => c !== code);
      } else {
        next = [...prev, code].sort();
      }
      setBaseCurrency((currentBase) => (next.includes(currentBase) ? currentBase : next[0]));
      return next;
    });
  };

  const updateManualRate = (code: string, value: string) => {
    setManualRates((prev) => ({ ...prev, [code]: value }));
  };

  const handleSaveDefaultCurrencies = async () => {
    if (!tenant) return;
    setSavingDefault(true);
    setDefaultSaveError(null);
    setDefaultSaved(false);
    try {
      const existingSettings = tenant.settings as TenantSettings;
      const updatedSettings: TenantSettings = {
        ...existingSettings,
        enabled_currencies: selectedCurrencies,
        default_currency: baseCurrency,
      };
      const { error } = await supabase
        .from('tenants')
        .update({
          settings: updatedSettings,
        })
        .eq('id', tenant.id);
      if (error) throw error;
      setDefaultSaved(true);
    } catch (err) {
      console.error('Error saving default currencies:', err);
      setDefaultSaveError(err instanceof Error ? err.message : 'Failed to save default currencies');
    } finally {
      setSavingDefault(false);
    }
  };

  const updateRow = (key: string, amount: string) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, amount } : r)));
  };

  // Resolves the rate to convert `code` into `baseCurrency`: a configured
  // Forex Trading rate first, falling back to a manually-entered rate only
  // when that pair hasn't been set up in Forex Trading yet.
  const resolvedRate = useCallback(
    (code: string): number | null => {
      if (code === baseCurrency) return 1;
      const fx = lookupRate(fxRates, code, baseCurrency, 'buy');
      if (fx !== null) return fx;
      const manual = parseFloat(manualRates[code] ?? '');
      return Number.isFinite(manual) && manual > 0 ? manual : null;
    },
    [fxRates, baseCurrency, manualRates]
  );

  const rateSource = useCallback(
    (code: string): 'base' | 'forex' | 'manual' | 'missing' => {
      if (code === baseCurrency) return 'base';
      if (lookupRate(fxRates, code, baseCurrency, 'buy') !== null) return 'forex';
      const manual = parseFloat(manualRates[code] ?? '');
      return Number.isFinite(manual) && manual > 0 ? 'manual' : 'missing';
    },
    [fxRates, baseCurrency, manualRates]
  );

  const totalInBase = useMemo(
    () =>
      rows.reduce((sum, r) => {
        const amt = parseFloat(r.amount) || 0;
        const code = currencyForRow(r.key, baseCurrency);
        const rate = resolvedRate(code);
        return sum + amt * (rate ?? 0);
      }, 0),
    [rows, baseCurrency, resolvedRate]
  );

  const currenciesNeedingRates = selectedCurrencies.filter((c) => c !== baseCurrency);
  const missingRateCurrencies = currenciesNeedingRates.filter((c) => rateSource(c) === 'missing');

  const validate = (): string | null => {
    if (unclosedPriorOp) {
      return `${new Date(unclosedPriorOp.operation_date).toLocaleDateString()} has not been closed yet. Complete Daily Closing for that day before opening today.`;
    }
    if (selectedCurrencies.length === 0) {
      return 'Select at least one currency for today.';
    }
    if (missingRateCurrencies.length > 0) {
      return `No exchange rate found for ${missingRateCurrencies.join(', ')} → ${baseCurrency}. Add the pair in Forex Trading, or enter a manual rate below.`;
    }
    const hasAnyAmount = rows.some((r) => r.amount.trim() !== '' && parseFloat(r.amount) >= 0);
    if (!hasAnyAmount) return 'Enter at least one opening balance.';
    for (const r of rows) {
      if (r.amount.trim() !== '' && parseFloat(r.amount) < 0) {
        return `${r.label} cannot be negative.`;
      }
    }
    return null;
  };

  const handleOpen = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!tenant || !branch || !admin) {
      setFormError('No institution or branch context found. Please sign in again.');
      return;
    }

    const validationError = validate();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const balances: Record<string, number> = {};
      rows.forEach((r) => {
        balances[r.key] = parseFloat(r.amount) || 0;
      });

      const insert: InsertTables<'daily_operations'> = {
        tenant_id: tenant.id,
        branch_id: branch.id,
        operation_date: todayIso(),
        state: 'active',
        opening_balances: balances,
        opened_by: admin.id,
        opened_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('daily_operations').insert(insert);
      if (error) {
        if ((error as { code?: string }).code === '23505') {
          throw new Error('Today has already been opened for this branch.');
        }
        throw error;
      }

      await loadState();
    } catch (err) {
      console.error('Error opening the day:', err);
      setFormError(err instanceof Error ? err.message : 'Failed to complete daily opening');
    } finally {
      setSubmitting(false);
    }
  };

  const pageStatus: 'pending' | 'open' | 'closed' | 'blocked' = unclosedPriorOp
    ? 'blocked'
    : !todaysOp
    ? 'pending'
    : todaysOp.state === 'closed'
    ? 'closed'
    : 'open';

  const defaultsDiffer =
    baseCurrency !== tenantDefaultBase ||
    selectedCurrencies.length !== tenantDefaultCurrencies.length ||
    selectedCurrencies.some((c) => !tenantDefaultCurrencies.includes(c));

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <Loader2 className="w-8 h-8 animate-spin text-[#641f60]" />
        <p className="text-sm text-slate-500">Loading today&rsquo;s status&hellip;</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl min-w-0">
      <div className="space-y-1">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-[#641f60]">Daily Opening</h1>
          {branch && <StatusPill state={pageStatus} />}
        </div>
        <p className="text-slate-600">
          {branch
            ? `${branch.name} — ${new Date().toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}`
            : 'Select a branch to continue'}
        </p>
      </div>

      {loadError && (
        <div className="bg-[#c46040]/10 border border-[#c46040]/30 rounded-xl p-4 flex flex-wrap items-center gap-4" role="alert">
          <div className="w-11 h-11 rounded-full bg-[#c46040]/15 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-6 h-6 text-[#c46040]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-[#c46040]">Something went wrong</h3>
            <p className="text-sm text-slate-600 break-words">{loadError}</p>
          </div>
          <button
            onClick={loadState}
            className="px-4 py-2 bg-[#ee7b22] hover:bg-[#c46040] text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 shrink-0"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {!branch ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-500">
          <Wallet className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          No branch is currently selected.
        </div>
      ) : unclosedPriorOp ? (
        <div className="bg-[#c46040]/5 border border-[#c46040]/30 rounded-xl p-6 flex items-start gap-4">
          <div className="w-11 h-11 rounded-full bg-[#c46040]/15 flex items-center justify-center flex-shrink-0">
            <Lock className="w-6 h-6 text-[#c46040]" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-[#c46040] mb-1">Previous day not yet closed</h3>
            <p className="text-sm text-slate-700 break-words">
              {new Date(unclosedPriorOp.operation_date).toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}{' '}
              is still <span className="font-medium capitalize">{unclosedPriorOp.state.replace(/_/g, ' ')}</span>. Go
              to Daily Closing and finish that day before opening today.
            </p>
          </div>
        </div>
      ) : todaysOp ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 bg-[#1ebcb2]/10 border-b border-[#1ebcb2]/20 flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-[#1ebcb2] shrink-0" />
            <div className="min-w-0">
              <h3 className="font-semibold text-[#641f60]">
                {todaysOp.state === 'closed' ? 'Today is already closed' : 'Already opened for today'}
              </h3>
              <p className="text-sm text-slate-600">
                Opened at {todaysOp.opened_at ? new Date(todaysOp.opened_at).toLocaleTimeString() : '—'}
              </p>
            </div>
          </div>
          <div className="p-6">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Opening Balances</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {Object.entries(parseBalances(todaysOp.opening_balances)).map(([key, value]) => (
                <div key={key} className="border border-slate-200 rounded-xl bg-white shadow-sm p-4 text-center min-w-0">
                  <div className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-2">
                    <ChannelIcon channelKey={key} className="w-4 h-4 text-slate-400" />
                  </div>
                  <p className="text-xs text-slate-500 capitalize mb-1 truncate">{key.replace(/_/g, ' ')}</p>
                  <p className="font-semibold text-slate-900 text-sm break-words">
                    {formatMoney(value, currencyPrefix(key))}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleOpen} className="space-y-6">
          {/* Currency selection */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#1ebcb2]/10 flex items-center justify-center flex-shrink-0">
                <Coins className="w-5 h-5 text-[#1ebcb2]" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-900">Currencies for Today</h3>
                <p className="text-sm text-slate-500">
                  Choose which currencies this branch will handle today.
                </p>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div className="flex flex-wrap gap-2">
                {CURRENCY_OPTIONS.map((c) => {
                  const active = selectedCurrencies.includes(c.code);
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => toggleCurrency(c.code)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-all shrink-0 ${
                        active
                          ? 'border-[#1ebcb2] bg-[#1ebcb2]/10 text-[#641f60]'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                      aria-pressed={active}
                    >
                      {active && <Check className="w-3.5 h-3.5 text-[#1ebcb2] shrink-0" />}
                      <span>{c.symbol}</span>
                      <span>{c.code}</span>
                    </button>
                  );
                })}
              </div>

              {selectedCurrencies.length > 1 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">Base currency</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedCurrencies.map((code) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => setBaseCurrency(code)}
                        className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all shrink-0 ${
                          baseCurrency === code
                            ? 'border-[#641f60] bg-[#641f60]/10 text-[#641f60]'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleSaveDefaultCurrencies}
                  disabled={savingDefault || !defaultsDiffer}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:border-[#641f60] hover:text-[#641f60] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {savingDefault ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save as institution default
                </button>
                {defaultSaved && !defaultsDiffer && (
                  <span className="text-xs text-[#1ebcb2] font-medium flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Saved
                  </span>
                )}
                {defaultSaveError && <span className="text-xs text-[#c46040] break-words">{defaultSaveError}</span>}
              </div>
            </div>
          </div>

          {/* Today's rates, sourced from Forex Trading */}
          {currenciesNeedingRates.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-[#ee7b22]/10 flex items-center justify-center flex-shrink-0">
                    <Globe className="w-5 h-5 text-[#ee7b22]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900">Today&rsquo;s Rates</h3>
                    <p className="text-sm text-slate-500">
                      Pulled from Forex Trading &middot; buy rate, converting into {baseCurrency}.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={reloadFx}
                  disabled={fxLoading}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:border-[#641f60] hover:text-[#641f60] disabled:opacity-50 transition-all shrink-0"
                >
                  {fxLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Refresh
                </button>
              </div>

              {fxError && (
                <div className="mx-6 mt-4 p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm break-words">
                  {fxError}
                </div>
              )}

              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {currenciesNeedingRates.map((code) => {
                  const source = rateSource(code);
                  const fx = lookupRate(fxRates, code, baseCurrency, 'buy');
                  return (
                    <div key={code} className="border border-slate-200 rounded-lg p-3 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-sm font-medium text-slate-700 whitespace-nowrap">
                          1 {code} = {baseCurrency}
                        </span>
                        {source === 'forex' && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#1ebcb2]/10 text-[#1ebcb2] shrink-0">
                            Forex
                          </span>
                        )}
                        {source === 'manual' && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#ee7b22]/10 text-[#ee7b22] shrink-0">
                            Manual
                          </span>
                        )}
                        {source === 'missing' && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#c46040]/10 text-[#c46040] shrink-0">
                            Missing
                          </span>
                        )}
                      </div>

                      {source === 'forex' && fx !== null ? (
                        <p className="text-lg font-bold text-slate-900">
                          {fx.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                        </p>
                      ) : (
                        <div className="space-y-1">
                          <input
                            type="number"
                            step="0.000001"
                            min="0"
                            value={manualRates[code] ?? ''}
                            onChange={(e) => updateManualRate(code, e.target.value)}
                            placeholder="Enter rate manually"
                            className="w-full min-w-0 box-border px-3 py-2 border border-slate-300 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                          />
                          <p className="text-xs text-slate-400 flex items-start gap-1">
                            <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                            Not configured in Forex Trading. Add it there to avoid manual entry.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Balance entry */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#ee7b22]/10 flex items-center justify-center flex-shrink-0">
                <Sunrise className="w-5 h-5 text-[#ee7b22]" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-900">Verify Opening Balances</h3>
                <p className="text-sm text-slate-500">
                  Enter the confirmed cash and float balances to start today&rsquo;s operations.
                </p>
              </div>
            </div>

            <div className="p-6 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {rows.map((row) => (
                  <div
                    key={row.key}
                    className="border border-slate-200 rounded-xl bg-white shadow-sm p-4 focus-within:border-[#1ebcb2] focus-within:ring-1 focus-within:ring-[#1ebcb2] hover:shadow-md transition-all min-w-0"
                  >
                    <div className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-2">
                      <ChannelIcon channelKey={row.key} className="w-4 h-4 text-slate-400" />
                    </div>
                    <label
                      htmlFor={`open-${row.key}`}
                      className="block text-center text-xs font-medium text-slate-600 mb-2 truncate"
                      title={row.label}
                    >
                      {row.label}
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
                        {currencyPrefix(row.key)}
                      </span>
                      <input
                        id={`open-${row.key}`}
                        type="number"
                        step="0.01"
                        min="0"
                        value={row.amount}
                        onChange={(e) => updateRow(row.key, e.target.value)}
                        className="w-full min-w-0 box-border pl-10 pr-2 py-2 border border-slate-300 rounded-md text-right text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {formError && (
                <div
                  className="p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm flex items-start gap-2"
                  role="alert"
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span className="break-words">{formError}</span>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs text-slate-500 uppercase tracking-wide">
                  Total, converted to {baseCurrency}
                </p>
                <p className="text-lg font-semibold text-slate-900 break-words">
                  {formatMoney(totalInBase, baseCurrency)}
                </p>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg disabled:opacity-50 transition-all shrink-0"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sunrise className="w-5 h-5" />}
                Confirm & Open
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}