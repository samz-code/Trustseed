import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Tables, Json } from '../lib/supabase';
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
} from 'lucide-react';

type DailyOperation = Tables<'daily_operations'>;

interface BalanceRow {
  key: string;
  label: string;
  amount: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatMoney(value: number, currency = 'KES'): string {
  const symbols: Record<string, string> = { USD: '$', KES: 'KSh ', SSP: 'SSP ', EUR: '\u20ac', GBP: '\u00a3' };
  const symbol = symbols[currency] ?? `${currency} `;
  return `${symbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function currencyPrefix(key: string): string {
  return key.startsWith('cash_') ? key.slice(5) : 'KES';
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

        // Real transaction totals for today at this branch — not fabricated.
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

  const openingTotal = useMemo(() => {
    if (!todaysOp) return 0;
    return Object.values(parseBalances(todaysOp.opening_balances)).reduce((s, v) => s + v, 0);
  }, [todaysOp]);

  const closingTotal = useMemo(
    () => rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0),
    [rows]
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
            ? `Variance of ${formatMoney(variance)} recorded at closing (closing total vs expected).`
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
    <div className="space-y-6 max-w-3xl">
      <div className="space-y-1">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-[#641f60]">Daily Closing</h1>
          {branch && <StatusPill state={pageStatus} />}
        </div>
        <p className="text-slate-600">
          {branch ? `${branch.name} — ${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}` : 'Select a branch to continue'}
        </p>
      </div>

      {loadError && (
        <div className="bg-[#c46040]/10 border border-[#c46040]/30 rounded-xl p-4 flex items-center gap-4" role="alert">
          <div className="w-11 h-11 rounded-full bg-[#c46040]/15 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-6 h-6 text-[#c46040]" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-[#c46040]">Something went wrong</h3>
            <p className="text-sm text-slate-600">{loadError}</p>
          </div>
          <button
            onClick={loadState}
            className="px-4 py-2 bg-[#ee7b22] hover:bg-[#c46040] text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
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
            <CheckCircle className="w-6 h-6 text-[#1ebcb2]" />
            <div>
              <h3 className="font-semibold text-[#641f60]">Today is closed</h3>
              <p className="text-sm text-slate-600">
                Closed at {todaysOp.closed_at ? new Date(todaysOp.closed_at).toLocaleTimeString() : '—'}
              </p>
            </div>
          </div>
          <div className="p-6">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Closing Balances</h4>
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
              {Object.entries(parseBalances(todaysOp.closing_balances)).map(([key, value]) => (
                <div
                  key={key}
                  className="snap-start flex-shrink-0 w-40 border border-slate-200 rounded-xl bg-white shadow-sm p-4 text-center"
                >
                  <div className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-2">
                    <ChannelIcon channelKey={key} className="w-4 h-4 text-slate-400" />
                  </div>
                  <p className="text-xs text-slate-500 mb-1">{labelFor(key)}</p>
                  <p className="font-semibold text-slate-900 text-sm">{formatMoney(value, currencyPrefix(key))}</p>
                </div>
              ))}
            </div>
            {todaysOp.notes && (
              <div className="mt-4 flex items-start gap-2 text-sm text-[#c46040]">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>{todaysOp.notes}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleClose} className="space-y-6">
          {/* Today's activity summary — real data */}
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                <Activity className="w-4 h-4" />
                Transactions Today
              </div>
              <p className="text-xl font-bold text-slate-900">{txSummary.count}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-[#1ebcb2] text-sm mb-1">
                <TrendingUp className="w-4 h-4" />
                Total Credits
              </div>
              <p className="text-xl font-bold text-slate-900">{formatMoney(txSummary.totalCredits)}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-[#ee7b22] text-sm mb-1">
                <TrendingDown className="w-4 h-4" />
                Total Debits
              </div>
              <p className="text-xl font-bold text-slate-900">{formatMoney(txSummary.totalDebits)}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#641f60]/10 flex items-center justify-center flex-shrink-0">
                <Sunset className="w-5 h-5 text-[#641f60]" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Confirm Closing Balances</h3>
                <p className="text-sm text-slate-500">
                  Count and enter actual balances for each channel to close the day.
                </p>
              </div>
            </div>

            <div className="p-6 space-y-3">
              <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
                {rows.map((row) => (
                  <div
                    key={row.key}
                    className="snap-start flex-shrink-0 w-44 border border-slate-200 rounded-xl bg-white shadow-sm p-4 focus-within:border-[#1ebcb2] focus-within:ring-1 focus-within:ring-[#1ebcb2] hover:shadow-md transition-all"
                  >
                    <div className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-2">
                      <ChannelIcon channelKey={row.key} className="w-4 h-4 text-slate-400" />
                    </div>
                    <label
                      htmlFor={`close-${row.key}`}
                      className="block text-center text-xs font-medium text-slate-600 mb-2"
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
                        className="w-full pl-10 pr-2 py-2 border border-slate-300 rounded-md text-right text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Reconciliation receipt */}
              <div className="pt-4 mt-4 border-t border-dashed border-slate-300 space-y-1.5 text-sm">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Opening total</span>
                  <span>{formatMoney(openingTotal)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>+ Credits &minus; Debits</span>
                  <span>{formatMoney(txSummary.totalCredits - txSummary.totalDebits)}</span>
                </div>
                <div className="flex items-center justify-between font-medium text-slate-800">
                  <span>Expected closing total</span>
                  <span>{formatMoney(expectedTotal)}</span>
                </div>
                <div className="flex items-center justify-between font-semibold text-slate-900">
                  <span>Entered closing total</span>
                  <span>{formatMoney(closingTotal)}</span>
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
                  <div>
                    <p className={`font-semibold ${isBalanced ? 'text-[#1ebcb2]' : 'text-[#c46040]'}`}>
                      {isBalanced
                        ? 'Balances match'
                        : `Off by ${formatMoney(Math.abs(variance))} (${variance > 0 ? 'over' : 'short'})`}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {isBalanced
                        ? 'Entered totals match expected totals exactly.'
                        : 'This will be recorded as a variance note on today\u2019s record when you close.'}
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
                  {formError}
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