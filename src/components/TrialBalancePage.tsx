import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Tables } from '../lib/supabase';
import {
  Scale,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Calendar,
  Printer,
} from 'lucide-react';

type Account = Tables<'chart_of_accounts'>;
type JournalLine = Tables<'journal_entry_lines'>;
type JournalEntry = Tables<'journal_entries'>;

interface TrialBalanceRow {
  account: Account;
  debit: number;
  credit: number;
}

function formatMoney(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const TYPE_ORDER: Account['account_type'][] = ['asset', 'liability', 'equity', 'revenue', 'expense'];
const TYPE_LABELS: Record<Account['account_type'], string> = {
  asset: 'Assets',
  liability: 'Liabilities',
  equity: 'Equity',
  revenue: 'Revenue',
  expense: 'Expenses',
};

export function TrialBalancePage() {
  const { tenant } = useAuth();

  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [showZeroBalances, setShowZeroBalances] = useState(false);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rows, setRows] = useState<TrialBalanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTrialBalance = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    setError(null);
    try {
      const { data: accountsData, error: accountsError } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('account_code', { ascending: true });
      if (accountsError) throw accountsError;

      const accountList = accountsData ?? [];
      setAccounts(accountList);

      if (accountList.length === 0) {
        setRows([]);
        return;
      }

      const { data: linesData, error: linesError } = await supabase
        .from('journal_entry_lines')
        .select('*')
        .eq('tenant_id', tenant.id);
      if (linesError) throw linesError;

      const lineRows: JournalLine[] = linesData ?? [];
      if (lineRows.length === 0) {
        setRows(accountList.map((a) => ({ account: a, debit: 0, credit: 0 })));
        return;
      }

      const entryIds = Array.from(new Set(lineRows.map((l) => l.journal_entry_id)));
      const { data: entriesData, error: entriesError } = await supabase
        .from('journal_entries')
        .select('*')
        .in('id', entryIds)
        .eq('status', 'posted');
      if (entriesError) throw entriesError;

      const entryMap = new Map<string, JournalEntry>();
      (entriesData ?? []).forEach((e) => entryMap.set(e.id, e));

      const totalsByAccount = new Map<string, { debit: number; credit: number }>();
      for (const line of lineRows) {
        const entry = entryMap.get(line.journal_entry_id);
        if (!entry) continue; // not posted, or outside our fetch
        if (entry.entry_date > asOfDate) continue; // after the as-of cutoff

        const current = totalsByAccount.get(line.account_id) ?? { debit: 0, credit: 0 };
        current.debit += Number(line.debit_amount || 0);
        current.credit += Number(line.credit_amount || 0);
        totalsByAccount.set(line.account_id, current);
      }

      const computedRows: TrialBalanceRow[] = accountList.map((a) => {
        const totals = totalsByAccount.get(a.id) ?? { debit: 0, credit: 0 };
        return { account: a, debit: totals.debit, credit: totals.credit };
      });

      setRows(computedRows);
    } catch (err) {
      console.error('Error loading trial balance:', err);
      setError(err instanceof Error ? err.message : 'Failed to load trial balance');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tenant, asOfDate]);

  useEffect(() => {
    loadTrialBalance();
  }, [loadTrialBalance]);

  const visibleRows = useMemo(
    () => (showZeroBalances ? rows : rows.filter((r) => r.debit !== 0 || r.credit !== 0)),
    [rows, showZeroBalances]
  );

  const rowsByType = useMemo(() => {
    const groups: Record<Account['account_type'], TrialBalanceRow[]> = {
      asset: [],
      liability: [],
      equity: [],
      revenue: [],
      expense: [],
    };
    for (const r of visibleRows) {
      groups[r.account.account_type].push(r);
    }
    return groups;
  }, [visibleRows]);

  const grandTotals = useMemo(() => {
    const debit = rows.reduce((s, r) => s + r.debit, 0);
    const credit = rows.reduce((s, r) => s + r.credit, 0);
    return { debit, credit, balanced: Math.abs(debit - credit) < 0.005 };
  }, [rows]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#641f60]">Trial Balance</h1>
          <p className="text-slate-600 mt-1">Verify total debits equal total credits as of a chosen date</p>
        </div>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
        >
          <Printer className="w-5 h-5" />
          Print
        </button>
      </div>

      {error && (
        <div className="bg-[#c46040]/10 border border-[#c46040]/30 rounded-xl p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-[#c46040]/15 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-6 h-6 text-[#c46040]" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-[#c46040]">Couldn&rsquo;t load the trial balance</h3>
            <p className="text-sm text-slate-600">{error}</p>
          </div>
          <button
            onClick={loadTrialBalance}
            className="px-4 py-2 bg-[#ee7b22] hover:bg-[#c46040] text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {/* Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">As of Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:mt-6">
            <input
              type="checkbox"
              checked={showZeroBalances}
              onChange={(e) => setShowZeroBalances(e.target.checked)}
              className="rounded border-slate-300 text-[#1ebcb2] focus:ring-[#1ebcb2]"
            />
            Show accounts with zero balance
          </label>
        </div>
      </div>

      {/* Balance check banner */}
      {!loading && accounts.length > 0 && (
        <div
          className={`rounded-xl p-4 flex items-center gap-3 border ${
            grandTotals.balanced
              ? 'bg-[#1ebcb2]/10 border-[#1ebcb2]/30 text-[#1ebcb2]'
              : 'bg-[#c46040]/10 border-[#c46040]/30 text-[#c46040]'
          }`}
        >
          {grandTotals.balanced ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <p className="text-sm font-medium">
            {grandTotals.balanced
              ? `Books are balanced. Total debits equal total credits: ${formatMoney(grandTotals.debit)}.`
              : `Books are NOT balanced. Debits ${formatMoney(grandTotals.debit)} vs credits ${formatMoney(
                  grandTotals.credit
                )} — difference of ${formatMoney(Math.abs(grandTotals.debit - grandTotals.credit))}.`}
          </p>
        </div>
      )}

      {/* Report */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#641f60]" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <Scale className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No accounts yet</h3>
            <p className="text-slate-500 text-center max-w-sm">
              Add accounts to your Chart of Accounts to generate a trial balance.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-xs uppercase border-b border-slate-200">
                  <th className="text-left px-5 py-3">Code</th>
                  <th className="text-left px-5 py-3">Account</th>
                  <th className="text-right px-5 py-3">Debit</th>
                  <th className="text-right px-5 py-3">Credit</th>
                </tr>
              </thead>
              <tbody>
                {TYPE_ORDER.map((type) => {
                  const group = rowsByType[type];
                  if (group.length === 0) return null;
                  const typeDebit = group.reduce((s, r) => s + r.debit, 0);
                  const typeCredit = group.reduce((s, r) => s + r.credit, 0);
                  return (
                    <React.Fragment key={type}>
                      <tr className="bg-slate-50">
                        <td colSpan={4} className="px-5 py-2 font-semibold text-slate-700 text-xs uppercase">
                          {TYPE_LABELS[type]}
                        </td>
                      </tr>
                      {group.map((row) => (
                        <tr key={row.account.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-2.5 font-mono text-xs text-slate-500">{row.account.account_code}</td>
                          <td className="px-5 py-2.5 text-slate-800">{row.account.account_name}</td>
                          <td className="px-5 py-2.5 text-right font-mono">
                            {row.debit > 0 ? formatMoney(row.debit) : ''}
                          </td>
                          <td className="px-5 py-2.5 text-right font-mono">
                            {row.credit > 0 ? formatMoney(row.credit) : ''}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-b-2 border-slate-200 font-medium text-slate-600">
                        <td className="px-5 py-2" colSpan={2}>
                          Subtotal — {TYPE_LABELS[type]}
                        </td>
                        <td className="px-5 py-2 text-right font-mono">{formatMoney(typeDebit)}</td>
                        <td className="px-5 py-2 text-right font-mono">{formatMoney(typeCredit)}</td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-[#641f60]/5 font-bold text-[#641f60] border-t-2 border-[#641f60]/20">
                  <td className="px-5 py-3" colSpan={2}>
                    Grand Total
                  </td>
                  <td className="px-5 py-3 text-right font-mono">{formatMoney(grandTotals.debit)}</td>
                  <td className="px-5 py-3 text-right font-mono">{formatMoney(grandTotals.credit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}