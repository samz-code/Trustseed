import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Tables, InsertTables, Json } from '../lib/supabase';
import {
  Sunrise,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Lock,
  Wallet,
  Banknote,
  Landmark,
  Smartphone,
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

function buildDefaultRows(enabledCurrencies: string[]): BalanceRow[] {
  const currencyRows: BalanceRow[] = enabledCurrencies.map((c) => ({
    key: `cash_${c}`,
    label: `Cash (${c})`,
    amount: '',
  }));
  return [
    ...currencyRows,
    { key: 'bank', label: 'Bank', amount: '' },
    { key: 'mtn_momo', label: 'MTN Mobile Money', amount: '' },
    { key: 'mpesa', label: 'M-Pesa', amount: '' },
  ];
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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [rows, setRows] = useState<BalanceRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const enabledCurrencies = useMemo(() => {
    const settings = tenant?.settings as { enabled_currencies?: string[] } | null;
    return settings?.enabled_currencies?.length ? settings.enabled_currencies : ['KES'];
  }, [tenant]);

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

      // Prefill from the most recent CLOSED day's closing balances, if any.
      const lastClosed = (priorRows ?? []).find((r) => r.state === 'closed');
      const defaultRows = buildDefaultRows(enabledCurrencies);
      if (lastClosed) {
        const closing = parseBalances(lastClosed.closing_balances);
        setRows(
          defaultRows.map((r) => ({
            ...r,
            amount: closing[r.key] !== undefined ? String(closing[r.key]) : '',
          }))
        );
      } else {
        setRows(defaultRows);
      }
    } catch (err) {
      console.error('Error loading daily opening state:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load daily opening status');
    } finally {
      setLoading(false);
    }
  }, [tenant, branch, enabledCurrencies]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const updateRow = (key: string, amount: string) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, amount } : r)));
  };

  const total = useMemo(
    () => rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0),
    [rows]
  );

  const validate = (): string | null => {
    if (unclosedPriorOp) {
      return `${new Date(unclosedPriorOp.operation_date).toLocaleDateString()} has not been closed yet. Complete Daily Closing for that day before opening today.`;
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
          <h1 className="text-2xl font-bold text-[#641f60]">Daily Opening</h1>
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
      ) : unclosedPriorOp ? (
        <div className="bg-[#c46040]/5 border border-[#c46040]/30 rounded-xl p-6 flex items-start gap-4">
          <div className="w-11 h-11 rounded-full bg-[#c46040]/15 flex items-center justify-center flex-shrink-0">
            <Lock className="w-6 h-6 text-[#c46040]" />
          </div>
          <div>
            <h3 className="font-semibold text-[#c46040] mb-1">Previous day not yet closed</h3>
            <p className="text-sm text-slate-700">
              {new Date(unclosedPriorOp.operation_date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} is still{' '}
              <span className="font-medium capitalize">{unclosedPriorOp.state.replace(/_/g, ' ')}</span>. Go to
              Daily Closing and finish that day before opening today.
            </p>
          </div>
        </div>
      ) : todaysOp ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 bg-[#1ebcb2]/10 border-b border-[#1ebcb2]/20 flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-[#1ebcb2]" />
            <div>
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
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
              {Object.entries(parseBalances(todaysOp.opening_balances)).map(([key, value]) => (
                <div
                  key={key}
                  className="snap-start flex-shrink-0 w-40 border border-slate-200 rounded-xl bg-white shadow-sm p-4 text-center"
                >
                  <div className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-2">
                    <ChannelIcon channelKey={key} className="w-4 h-4 text-slate-400" />
                  </div>
                  <p className="text-xs text-slate-500 capitalize mb-1">{key.replace(/_/g, ' ')}</p>
                  <p className="font-semibold text-slate-900 text-sm">{formatMoney(value, currencyPrefix(key))}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleOpen} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#ee7b22]/10 flex items-center justify-center flex-shrink-0">
              <Sunrise className="w-5 h-5 text-[#ee7b22]" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Verify Opening Balances</h3>
              <p className="text-sm text-slate-500">
                Enter the confirmed cash and float balances to start today&rsquo;s operations.
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
                    htmlFor={`open-${row.key}`}
                    className="block text-center text-xs font-medium text-slate-600 mb-2"
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
                      className="w-full pl-10 pr-2 py-2 border border-slate-300 rounded-md text-right text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
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
                {formError}
              </div>
            )}
          </div>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Total (all channels)</p>
              <p className="text-lg font-semibold text-slate-900">{formatMoney(total)}</p>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg disabled:opacity-50 transition-all"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sunrise className="w-5 h-5" />}
              Confirm & Open
            </button>
          </div>
        </form>
      )}
    </div>
  );
}