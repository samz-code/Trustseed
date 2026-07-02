import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Tables, Json } from '../lib/supabase';
import type { TenantSettings } from '../types';
import { useTenantExchangeRates, lookupRate } from '../lib/forexRates';
import {
  Sunset,
  Loader2,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Wallet,
  Banknote,
  Landmark,
  Smartphone,
  TrendingUp,
  TrendingDown,
  Activity,
  Coins,
} from 'lucide-react';

type DailyOperation = Tables<'daily_operations'>;

interface BalanceRow {
  key: string;
  label: string;
  amount: string;
}

const CURRENCY_SYMBOL_MAP: Record<string, string> = {
  KES: 'KSh',
  UGX: 'USh',
  SSP: 'SSP',
  TZS: 'TSh',
  RWF: 'RWF',
  USD: '$',
  EUR: '\u20ac',
  GBP: '\u00a3',
};

type TenantSettingsShape = Partial<TenantSettings> & {
  base_currency?: string;
  [key: string]: unknown;
};

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

function currencyForRow(key: string, baseCurrency: string): string {
  return key.startsWith('cash_') ? key.slice(5) : baseCurrency;
}

function ChannelIcon({ channelKey, className }: { channelKey: string; className?: string }) {
  if (channelKey.startsWith('cash_')) return <Banknote className={className} />;
  if (channelKey === 'bank') return <Landmark className={className} />;
  if (channelKey === 'mtn_momo' || channelKey === 'mpesa') return <Smartphone className={className} />;
  return <Wallet className={className} />;
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

function labelFor(key: string): string {
  if (key.startsWith('cash_')) return `Cash (${key.slice(5)})`;
  const map: Record<string, string> = { bank: 'Bank', mtn_momo: 'MTN Mobile Money', mpesa: 'M-Pesa' };
  return map[key] ?? key.replace(/_/g, ' ');
}

function StatusPill({ state }: { state: 'unopened' | 'active' | 'closed' }) {
  const styles: Record<typeof state, string> = {
    unopened: 'bg-[#ee7b22]/10 text-[#ee7b22] border-[#ee7b22]/30',
    active: 'bg-[#1ebcb2]/10 text-[#1ebcb2] border-[#1ebcb2]/30',
    closed: 'bg-[#641f60]/10 text-[#641f60] border-[#641f60]/30',
  };
  const labels: Record<typeof state, string> = {
    unopened: 'Not opened',
    active: 'Open — ready to close',
    closed: 'Closed',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${styles[state]}`}>
      {labels[state]}
    </span>
  );
}

export function DailyClosingPage() {
  const { tenant, branch, admin } = useAuth();

  const [todaysOp, setTodaysOp] = useState<DailyOperation | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [rows, setRows] = useState<BalanceRow[]>([]);
  const [txSummary, setTxSummary] = useState<{ count: number; totalDebits: number; totalCredits: number }>({
    count: 0,
    totalDebits: 0,
    totalCredits: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [manualRates, setManualRates] = useState<Record<string, string>>({});

  const { rates: fxRates, loading: fxLoading, error: fxError, reload: reloadFx } = useTenantExchangeRates(tenant?.id);

  const tenantSettings = useMemo<TenantSettingsShape>(
    () => (tenant?.settings ?? {}) as TenantSettingsShape,
    [tenant]
  );
  const baseCurrency = tenantSettings.base_currency ?? tenantSettings.default_currency ?? 'KES';

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

      if (todayRow && todayRow.state === 'active') {
        const opening = parseBalances(todayRow.opening_balances);
        setRows(
          Object.entries(opening).map(([key, value]) => ({
            key,
            label: labelFor(key),
            amount: String(value),
          }))
        );

        const startOfDay = `${today}T00:00:00.000Z`;
        const { data: txRows, error: txError } = await supabase
          .from('transactions')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('branch_id', branch.id)
          .gte('created_at', startOfDay)
          .in('status', ['completed', 'approved', 'processing']);
        if (txError) throw txError;

        const opRows = txRows ?? [];
        const debitTypes = new Set(['withdrawal', 'savings_withdrawal', 'loan_disbursement', 'float_return']);
        const totalDebits = opRows
          .filter((t) => debitTypes.has(t.transaction_type))
          .reduce((s, t) => s + Number(t.amount || 0), 0);
        const totalCredits = opRows
          .filter((t) => !debitTypes.has(t.transaction_type))
          .reduce((s, t) => s + Number(t.amount || 0), 0);
        setTxSummary({ count: opRows.length, totalDebits, totalCredits });
      }
    } catch (err) {
      console.error('Error loading daily closing state:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load daily closing status');
    } finally {
      setLoading(false);
    }
  }, [tenant, branch]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const updateRow = (key: string, amount: string) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, amount } : r)));
  };

  const updateManualRate = (code: string, value: string) => {
    setManualRates((prev) => ({ ...prev, [code]: value }));
  };

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

  const currenciesInUse = useMemo(() => {
    const codes = new Set<string>();
    rows.forEach((r) => {
      if (r.key.startsWith('cash_')) codes.add(r.key.slice(5));
    });
    return Array.from(codes).sort();
  }, [rows]);

  const currenciesNeedingRates = currenciesInUse.filter((c) => c !== baseCurrency);
  const missingRateCurrencies = currenciesNeedingRates.filter((c) => rateSource(c) === 'missing');

  const openingTotal = useMemo(() => {
    if (!todaysOp) return 0;
    const opening = parseBalances(todaysOp.opening_balances);
    return Object.entries(opening).reduce((sum, [key, value]) => {
      const code = currencyForRow(key, baseCurrency);
      const rate = resolvedRate(code);
      return sum + value * (rate ?? 0);
    }, 0);
  }, [todaysOp, baseCurrency, resolvedRate]);

  const closingTotal = useMemo(
    () =>
      rows.reduce((sum, r) => {
        const amt = parseFloat(r.amount) || 0;
        const code = currencyForRow(r.key, baseCurrency);
        const rate = resolvedRate(code);
        return sum + amt * (rate ?? 0);
      }, 0),
    [rows, baseCurrency, resolvedRate]
  );

  const expectedTotal = useMemo(
    () => openingTotal + txSummary.totalCredits - txSummary.totalDebits,
    [openingTotal, txSummary]
  );

  const variance = useMemo(() => closingTotal - expectedTotal, [closingTotal, expectedTotal]);
  const isBalanced = Math.abs(variance) < 0.01;

  const validate = (): string | null => {
    const hasAnyAmount = rows.some((r) => r.amount.trim() !== '');
    if (!hasAnyAmount) return 'Enter closing balances for at least one channel.';
    if (missingRateCurrencies.length > 0) {
      return `No exchange rate found for ${missingRateCurrencies.join(', ')} → ${baseCurrency}. Add the pair in Forex Trading, or enter a manual rate below.`;
    }
    for (const r of rows) {
      if (r.amount.trim() !== '' && parseFloat(r.amount) < 0) {
        return `${r.label} cannot be negative.`;
      }
    }
    return null;
  };

  const handleClose = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!tenant || !branch || !admin || !todaysOp) {
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

      const { error } = await supabase
        .from('daily_operations')
        .update({
          state: 'closed',
          closing_balances: balances,
          closed_by: admin.id,
          closed_at: new Date().toISOString(),
          total_transactions: txSummary.count,
          total_debits: txSummary.totalDebits,
          total_credits: txSummary.totalCredits,
          approval_status: 'approved',
          approved_by: admin.id,
          approved_at: new Date().toISOString(),
          notes: !isBalanced
            ? `Variance of ${formatMoney(variance, baseCurrency)} recorded at closing (closing total vs expected, converted to ${baseCurrency}).`
            : null,
        })
        .eq('id', todaysOp.id)
        .eq('tenant_id', tenant.id);

      if (error) throw error;

      await loadState();
    } catch (err) {
      console.error('Error closing the day:', err);
      setFormError(err instanceof Error ? err.message : 'Failed to complete daily closing');
    } finally {
      setSubmitting(false);
    }
  };

  const pageStatus: 'unopened' | 'active' | 'closed' = !todaysOp
    ? 'unopened'
    : todaysOp.state === 'closed'
    ? 'closed'
    : 'active';

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
          <h1 className="text-2xl font-bold text-[#641f60]">Daily Closing</h1>
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
        {currenciesInUse.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <Coins className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            {currenciesInUse.map((code) => (
              <span
                key={code}
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  code === baseCurrency ? 'bg-[#641f60]/10 text-[#641f60]' : 'bg-[#1ebcb2]/10 text-[#1ebcb2]'
                }`}
              >
                {code}
                {code === baseCurrency ? ' (base)' : ''}
              </span>
            ))}
          </div>
        )}
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
      ) : !todaysOp ? (
        <div className="bg-[#ee7b22]/5 border border-[#ee7b22]/30 rounded-xl p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-[#ee7b22]/15 flex items-center justify-center mx-auto mb-3">
            <Sunset className="w-6 h-6 text-[#ee7b22]" />
          </div>
          <h3 className="font-semibold text-[#641f60] mb-1">Today has not been opened yet</h3>
          <p className="text-sm text-slate-600">Complete Daily Opening before you can close the day.</p>
        </div>
      ) : todaysOp.state === 'closed' ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 bg-[#1ebcb2]/10 border-b border-[#1ebcb2]/20 flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-[#1ebcb2] shrink-0" />
            <div className="min-w-0">
              <h3 className="font-semibold text-[#641f60]">Today is closed</h3>
              <p className="text-sm text-slate-600">
                Closed at {todaysOp.closed_at ? new Date(todaysOp.closed_at).toLocaleTimeString() : '—'}
              </p>
            </div>
          </div>
          <div className="p-6">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Closing Balances</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {Object.entries(parseBalances(todaysOp.closing_balances)).map(([key, value]) => (
                <div key={key} className="border border-slate-200 rounded-xl bg-white shadow-sm p-4 text-center min-w-0">
                  <div className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-2">
                    <ChannelIcon channelKey={key} className="w-4 h-4 text-slate-400" />
                  </div>
                  <p className="text-xs text-slate-500 mb-1 truncate">{labelFor(key)}</p>
                  <p className="font-semibold text-slate-900 text-sm break-words">
                    {formatMoney(value, currencyPrefix(key))}
                  </p>
                </div>
              ))}
            </div>
            {todaysOp.notes && (
              <div className="mt-4 flex items-start gap-2 text-sm text-[#c46040]">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p className="break-words">{todaysOp.notes}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleClose} className="space-y-6">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 min-w-0">
              <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                <Activity className="w-4 h-4 shrink-0" />
                Transactions Today
              </div>
              <p className="text-xl font-bold text-slate-900">{txSummary.count}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 min-w-0">
              <div className="flex items-center gap-2 text-[#1ebcb2] text-sm mb-1">
                <TrendingUp className="w-4 h-4 shrink-0" />
                Total Credits
              </div>
              <p className="text-xl font-bold text-slate-900 break-words">
                {formatMoney(txSummary.totalCredits, baseCurrency)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 min-w-0">
              <div className="flex items-center gap-2 text-[#ee7b22] text-sm mb-1">
                <TrendingDown className="w-4 h-4 shrink-0" />
                Total Debits
              </div>
              <p className="text-xl font-bold text-slate-900 break-words">
                {formatMoney(txSummary.totalDebits, baseCurrency)}
              </p>
            </div>
          </div>

          {currenciesNeedingRates.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
                <h3 className="font-semibold text-slate-900">Today&rsquo;s Rates (from Forex Trading)</h3>
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
                        <input
                          type="number"
                          step="0.000001"
                          min="0"
                          value={manualRates[code] ?? ''}
                          onChange={(e) => updateManualRate(code, e.target.value)}
                          placeholder="Enter rate manually"
                          className="w-full min-w-0 box-border px-3 py-2 border border-slate-300 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#641f60]/10 flex items-center justify-center flex-shrink-0">
                <Sunset className="w-5 h-5 text-[#641f60]" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-900">Confirm Closing Balances</h3>
                <p className="text-sm text-slate-500">
                  Count and enter actual balances for each channel to close the day.
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
                      htmlFor={`close-${row.key}`}
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
                        id={`close-${row.key}`}
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

              <div className="pt-4 mt-4 border-t border-dashed border-slate-300 space-y-1.5 text-sm">
                <p className="text-xs text-slate-400 mb-1">All figures below converted to {baseCurrency}</p>
                <div className="flex items-center justify-between gap-4 text-slate-600">
                  <span>Opening total</span>
                  <span className="break-words text-right">{formatMoney(openingTotal, baseCurrency)}</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-slate-600">
                  <span>+ Credits &minus; Debits</span>
                  <span className="break-words text-right">
                    {formatMoney(txSummary.totalCredits - txSummary.totalDebits, baseCurrency)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 font-medium text-slate-800">
                  <span>Expected closing total</span>
                  <span className="break-words text-right">{formatMoney(expectedTotal, baseCurrency)}</span>
                </div>
                <div className="flex items-center justify-between gap-4 font-semibold text-slate-900">
                  <span>Entered closing total</span>
                  <span className="break-words text-right">{formatMoney(closingTotal, baseCurrency)}</span>
                </div>

                <div
                  className={`mt-3 rounded-lg p-3 flex items-start gap-2.5 ${
                    isBalanced ? 'bg-[#1ebcb2]/10' : 'bg-[#c46040]/10'
                  }`}
                >
                  {isBalanced ? (
                    <CheckCircle className="w-5 h-5 text-[#1ebcb2] flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-[#c46040] flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className={`font-semibold ${isBalanced ? 'text-[#1ebcb2]' : 'text-[#c46040]'}`}>
                      {isBalanced
                        ? 'Balances match'
                        : `Off by ${formatMoney(Math.abs(variance), baseCurrency)} (${variance > 0 ? 'over' : 'short'})`}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {isBalanced
                        ? 'Entered totals match expected totals exactly.'
                        : "This will be recorded as a variance note on today\u2019s record when you close."}
                    </p>
                  </div>
                </div>
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

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg disabled:opacity-50 transition-all"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sunset className="w-5 h-5" />}
                Confirm & Close
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}