import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Tables } from '../lib/supabase';
import {
  Book,
  Search,
  Loader2,
  RefreshCw,
  AlertCircle,
  Calendar,
  Landmark,
} from 'lucide-react';

type Account = Tables<'chart_of_accounts'>;
type JournalLine = Tables<'journal_entry_lines'>;
type JournalEntry = Tables<'journal_entries'>;

interface LedgerRow {
  lineId: string;
  entryDate: string;
  entryNumber: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

function formatMoney(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Accounts with a normal debit balance (asset, expense) increase with debits.
// Accounts with a normal credit balance (liability, equity, revenue) increase with credits.
function isDebitNormal(type: Account['account_type']): boolean {
  return type === 'asset' || type === 'expense';
}

export function GeneralLedgerPage() {
  const { tenant } = useAuth();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>([]);
  const [accountSearch, setAccountSearch] = useState('');

  const loadAccounts = useCallback(async () => {
    if (!tenant) return;
    setLoadingAccounts(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('account_code', { ascending: true });
      if (err) throw err;
      setAccounts(data ?? []);
    } catch (e) {
      console.error('Error loading accounts:', e);
      setError(e instanceof Error ? e.message : 'Failed to load accounts');
      setAccounts([]);
    } finally {
      setLoadingAccounts(false);
    }
  }, [tenant]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) ?? null;

  const loadLedger = useCallback(
    async (accountId: string) => {
      if (!tenant || !accountId) return;
      setLoadingLedger(true);
      setError(null);
      try {
        // Fetch all lines for this account, then fetch their parent entries in
        // one batched call and filter to posted entries only (unposted drafts
        // do not affect the ledger). Same batch-then-filter pattern used
        // elsewhere in the app to avoid relying on nested-filter queries.
        const { data: lines, error: linesError } = await supabase
          .from('journal_entry_lines')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('account_id', accountId);
        if (linesError) throw linesError;

        const lineRows: JournalLine[] = lines ?? [];
        if (lineRows.length === 0) {
          setLedgerRows([]);
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

        let combined = lineRows
          .filter((l) => entryMap.has(l.journal_entry_id))
          .map((l) => {
            const entry = entryMap.get(l.journal_entry_id)!;
            return { line: l, entry };
          });

        if (dateFrom) {
          combined = combined.filter((c) => c.entry.entry_date >= dateFrom);
        }
        if (dateTo) {
          combined = combined.filter((c) => c.entry.entry_date <= dateTo);
        }

        combined.sort((a, b) => {
          if (a.entry.entry_date !== b.entry.entry_date) {
            return a.entry.entry_date < b.entry.entry_date ? -1 : 1;
          }
          return a.line.line_number - b.line.line_number;
        });

        const accountType = accounts.find((a) => a.id === accountId)?.account_type ?? 'asset';
        const debitNormal = isDebitNormal(accountType);

        let running = 0;
        const rows: LedgerRow[] = combined.map(({ line, entry }) => {
          const debit = Number(line.debit_amount || 0);
          const credit = Number(line.credit_amount || 0);
          running += debitNormal ? debit - credit : credit - debit;
          return {
            lineId: line.id,
            entryDate: entry.entry_date,
            entryNumber: entry.entry_number,
            description: line.description || entry.description || '—',
            debit,
            credit,
            runningBalance: running,
          };
        });

        setLedgerRows(rows);
      } catch (e) {
        console.error('Error loading ledger:', e);
        setError(e instanceof Error ? e.message : 'Failed to load ledger');
        setLedgerRows([]);
      } finally {
        setLoadingLedger(false);
      }
    },
    [tenant, accounts, dateFrom, dateTo]
  );

  useEffect(() => {
    if (selectedAccountId) {
      loadLedger(selectedAccountId);
    } else {
      setLedgerRows([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountId, dateFrom, dateTo]);

  const filteredAccounts = useMemo(() => {
    const q = accountSearch.trim().toLowerCase();
    if (q === '') return accounts;
    return accounts.filter(
      (a) => a.account_code.toLowerCase().includes(q) || a.account_name.toLowerCase().includes(q)
    );
  }, [accounts, accountSearch]);

  const totals = useMemo(() => {
    const debit = ledgerRows.reduce((s, r) => s + r.debit, 0);
    const credit = ledgerRows.reduce((s, r) => s + r.credit, 0);
    const closingBalance = ledgerRows.length > 0 ? ledgerRows[ledgerRows.length - 1].runningBalance : 0;
    return { debit, credit, closingBalance };
  }, [ledgerRows]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#641f60]">General Ledger</h1>
        <p className="text-slate-600 mt-1">Browse posted activity for any account, with a running balance</p>
      </div>

      {error && (
        <div className="bg-[#c46040]/10 border border-[#c46040]/30 rounded-xl p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-[#c46040]/15 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-6 h-6 text-[#c46040]" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-[#c46040]">Couldn&rsquo;t load the ledger</h3>
            <p className="text-sm text-slate-600">{error}</p>
          </div>
          <button
            onClick={() => (selectedAccountId ? loadLedger(selectedAccountId) : loadAccounts())}
            className="px-4 py-2 bg-[#ee7b22] hover:bg-[#c46040] text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {/* Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Account</label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={accountSearch}
                onChange={(e) => setAccountSearch(e.target.value)}
                placeholder="Filter accounts..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
              />
            </div>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              disabled={loadingAccounts}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent disabled:opacity-50"
            >
              <option value="">
                {loadingAccounts ? 'Loading accounts...' : 'Select an account'}
              </option>
              {filteredAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.account_code} · {a.account_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">From Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">To Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Ledger table */}
      {!selectedAccountId ? (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 px-4">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <Book className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">Select an account</h3>
          <p className="text-slate-500 text-center max-w-sm">
            Choose an account above to view its posted transaction history.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {selectedAccount && (
            <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3 bg-slate-50">
              <div className="p-2 rounded-lg bg-[#641f60]/10 text-[#641f60]">
                <Landmark className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">
                  {selectedAccount.account_code} · {selectedAccount.account_name}
                </h2>
                <p className="text-xs text-slate-500 capitalize">
                  {selectedAccount.account_type} account · Closing balance:{' '}
                  <span className="font-semibold text-slate-700">{formatMoney(totals.closingBalance)}</span>
                </p>
              </div>
            </div>
          )}

          {loadingLedger ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#641f60]" />
            </div>
          ) : ledgerRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 text-xs uppercase border-b border-slate-200">
                    <th className="text-left px-5 py-3">Date</th>
                    <th className="text-left px-5 py-3">Entry #</th>
                    <th className="text-left px-5 py-3">Description</th>
                    <th className="text-right px-5 py-3">Debit</th>
                    <th className="text-right px-5 py-3">Credit</th>
                    <th className="text-right px-5 py-3">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ledgerRows.map((row) => (
                    <tr key={row.lineId} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 text-slate-600 whitespace-nowrap">
                        {new Date(row.entryDate).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-slate-500">{row.entryNumber}</td>
                      <td className="px-5 py-3 text-slate-800">{row.description}</td>
                      <td className="px-5 py-3 text-right font-mono">
                        {row.debit > 0 ? formatMoney(row.debit) : ''}
                      </td>
                      <td className="px-5 py-3 text-right font-mono">
                        {row.credit > 0 ? formatMoney(row.credit) : ''}
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-semibold text-slate-900">
                        {formatMoney(row.runningBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-semibold border-t border-slate-200">
                    <td className="px-5 py-3" colSpan={3}>
                      Period Totals
                    </td>
                    <td className="px-5 py-3 text-right font-mono">{formatMoney(totals.debit)}</td>
                    <td className="px-5 py-3 text-right font-mono">{formatMoney(totals.credit)}</td>
                    <td className="px-5 py-3 text-right font-mono">{formatMoney(totals.closingBalance)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <Book className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">No posted activity</h3>
              <p className="text-slate-500 text-center max-w-sm">
                This account has no posted journal entries in the selected date range.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}