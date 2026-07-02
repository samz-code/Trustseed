import React, { useState, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Tables } from '../lib/supabase';
import * as XLSX from 'xlsx';
import {
  FileText,
  Download,
  Calendar,
  TrendingUp,
  Users,
  DollarSign,
  PieChart,
  FileSpreadsheet,
  Loader2,
  AlertCircle,
  RefreshCw,
  Search,
  Table as TableIcon,
} from 'lucide-react';

type Customer = Tables<'customers'>;
type LoanAccount = Tables<'loan_accounts'>;
type SavingsAccount = Tables<'savings_accounts'>;
type Transaction = Tables<'transactions'>;
type DailyOperation = Tables<'daily_operations'>;

type ReportId =
  | 'transactions'
  | 'customers'
  | 'loan_portfolio'
  | 'savings_portfolio'
  | 'daily_operations';

interface ReportColumn {
  key: string;
  label: string;
}

interface ReportDef {
  id: ReportId;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  usesDateRange: boolean;
  columns: ReportColumn[];
}

// A generated report result: column definitions + row objects keyed by column.key
interface ReportResult {
  def: ReportDef;
  rows: Record<string, string | number>[];
  generatedAt: string;
}

function customerName(c: Customer | undefined | null): string {
  if (!c) return '';
  if (c.customer_type !== 'individual') return c.business_name || 'Unnamed business';
  return `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unnamed';
}

function fmtDate(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
}

function fmtNum(value: number | null | undefined): number {
  return typeof value === 'number' && !Number.isNaN(value) ? Number(value.toFixed(2)) : 0;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function startOfMonthIso(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

const REPORTS: ReportDef[] = [
  {
    id: 'transactions',
    title: 'Transaction Summary',
    description: 'All transactions within a date range, with fees and status.',
    icon: <DollarSign className="w-6 h-6" />,
    color: 'bg-[#ee7b22]',
    usesDateRange: true,
    columns: [
      { key: 'reference', label: 'Reference' },
      { key: 'type', label: 'Type' },
      { key: 'amount', label: 'Amount' },
      { key: 'currency', label: 'Currency' },
      { key: 'fee', label: 'Fee' },
      { key: 'status', label: 'Status' },
      { key: 'compliance', label: 'Compliance' },
      { key: 'sender', label: 'Sender' },
      { key: 'receiver', label: 'Receiver' },
      { key: 'date', label: 'Date' },
    ],
  },
  {
    id: 'customers',
    title: 'Customer List',
    description: 'All customers with KYC, AML, and risk status.',
    icon: <Users className="w-6 h-6" />,
    color: 'bg-[#1ebcb2]',
    usesDateRange: false,
    columns: [
      { key: 'customer_number', label: 'Customer No.' },
      { key: 'name', label: 'Name' },
      { key: 'type', label: 'Type' },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' },
      { key: 'kyc', label: 'KYC' },
      { key: 'aml', label: 'AML' },
      { key: 'risk', label: 'Risk' },
      { key: 'status', label: 'Status' },
      { key: 'joined', label: 'Joined' },
    ],
  },
  {
    id: 'loan_portfolio',
    title: 'Loan Portfolio',
    description: 'Active loans, outstanding balances, and arrears.',
    icon: <TrendingUp className="w-6 h-6" />,
    color: 'bg-[#641f60]',
    usesDateRange: false,
    columns: [
      { key: 'loan_number', label: 'Loan No.' },
      { key: 'customer', label: 'Customer' },
      { key: 'principal', label: 'Principal' },
      { key: 'outstanding', label: 'Outstanding' },
      { key: 'past_due', label: 'Amount Past Due' },
      { key: 'days_past_due', label: 'Days Past Due' },
      { key: 'rate', label: 'Rate %' },
      { key: 'status', label: 'Status' },
      { key: 'disbursed', label: 'Disbursed' },
      { key: 'maturity', label: 'Maturity' },
    ],
  },
  {
    id: 'savings_portfolio',
    title: 'Savings Portfolio',
    description: 'Savings accounts, balances, and accrued interest.',
    icon: <PieChart className="w-6 h-6" />,
    color: 'bg-[#c46040]',
    usesDateRange: false,
    columns: [
      { key: 'account_number', label: 'Account No.' },
      { key: 'customer', label: 'Customer' },
      { key: 'balance', label: 'Balance' },
      { key: 'available', label: 'Available' },
      { key: 'held', label: 'Held' },
      { key: 'accrued_interest', label: 'Accrued Interest' },
      { key: 'status', label: 'Status' },
      { key: 'opened', label: 'Opened' },
    ],
  },
  {
    id: 'daily_operations',
    title: 'Daily Operations',
    description: 'Opening/closing records with transaction totals.',
    icon: <Calendar className="w-6 h-6" />,
    color: 'bg-[#1a3c6e]',
    usesDateRange: true,
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'state', label: 'State' },
      { key: 'total_transactions', label: 'Transactions' },
      { key: 'total_debits', label: 'Total Debits' },
      { key: 'total_credits', label: 'Total Credits' },
      { key: 'approval_status', label: 'Approval' },
    ],
  },
];

export function ReportsPage() {
  const { tenant, branch } = useAuth();

  const [dateFrom, setDateFrom] = useState(startOfMonthIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const [generatingId, setGeneratingId] = useState<ReportId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [previewSearch, setPreviewSearch] = useState('');

  const scopeByBranch = <T extends { branch_id: string | null }>(rows: T[]): T[] => {
    // Branch-scoped users only see their branch; institution-level sees all.
    if (!branch) return rows;
    return rows;
  };

  const generate = useCallback(
    async (def: ReportDef) => {
      if (!tenant) {
        setError('No institution context found. Please sign in again.');
        return;
      }
      setGeneratingId(def.id);
      setError(null);
      setPreviewSearch('');

      try {
        let rows: Record<string, string | number>[] = [];

        if (def.id === 'transactions') {
          let q = supabase
            .from('transactions')
            .select('*')
            .eq('tenant_id', tenant.id)
            .gte('created_at', `${dateFrom}T00:00:00.000Z`)
            .lte('created_at', `${dateTo}T23:59:59.999Z`)
            .order('created_at', { ascending: false });
          if (branch) q = q.eq('branch_id', branch.id);
          const { data, error: qErr } = await q;
          if (qErr) throw qErr;
          rows = (data ?? []).map((t: Transaction) => ({
            reference: t.reference,
            type: t.transaction_type.replace(/_/g, ' '),
            amount: fmtNum(t.amount),
            currency: t.currency,
            fee: fmtNum(t.fee_amount),
            status: t.status,
            compliance: t.compliance_status ?? '',
            sender: t.sender_name ?? '',
            receiver: t.receiver_name ?? '',
            date: fmtDate(t.created_at),
          }));
        } else if (def.id === 'customers') {
          let q = supabase
            .from('customers')
            .select('*')
            .eq('tenant_id', tenant.id)
            .order('created_at', { ascending: false });
          if (branch) q = q.eq('branch_id', branch.id);
          const { data, error: qErr } = await q;
          if (qErr) throw qErr;
          rows = (data ?? []).map((c: Customer) => ({
            customer_number: c.customer_number ?? '',
            name: customerName(c),
            type: c.customer_type,
            phone: c.phone,
            email: c.email ?? '',
            kyc: c.kyc_status,
            aml: c.aml_status,
            risk: c.risk_level,
            status: c.status,
            joined: fmtDate(c.created_at),
          }));
        } else if (def.id === 'loan_portfolio') {
          let q = supabase
            .from('loan_accounts')
            .select('*')
            .eq('tenant_id', tenant.id)
            .order('created_at', { ascending: false });
          if (branch) q = q.eq('branch_id', branch.id);
          const { data, error: qErr } = await q;
          if (qErr) throw qErr;
          const loans = data ?? [];

          // Batch-resolve customer names.
          const custIds = Array.from(new Set(loans.map((l: LoanAccount) => l.customer_id)));
          const custMap = new Map<string, Customer>();
          if (custIds.length > 0) {
            const { data: custs, error: cErr } = await supabase
              .from('customers')
              .select('*')
              .in('id', custIds);
            if (cErr) throw cErr;
            (custs ?? []).forEach((c: Customer) => custMap.set(c.id, c));
          }

          rows = loans.map((l: LoanAccount) => ({
            loan_number: l.loan_number,
            customer: customerName(custMap.get(l.customer_id)),
            principal: fmtNum(l.principal_amount),
            outstanding: fmtNum(l.total_outstanding),
            past_due: fmtNum(l.amount_past_due),
            days_past_due: l.days_past_due,
            rate: fmtNum(l.interest_rate),
            status: l.status,
            disbursed: fmtDate(l.disbursement_date),
            maturity: fmtDate(l.maturity_date),
          }));
        } else if (def.id === 'savings_portfolio') {
          let q = supabase
            .from('savings_accounts')
            .select('*')
            .eq('tenant_id', tenant.id)
            .order('created_at', { ascending: false });
          if (branch) q = q.eq('branch_id', branch.id);
          const { data, error: qErr } = await q;
          if (qErr) throw qErr;
          const accounts = data ?? [];

          const custIds = Array.from(new Set(accounts.map((a: SavingsAccount) => a.customer_id)));
          const custMap = new Map<string, Customer>();
          if (custIds.length > 0) {
            const { data: custs, error: cErr } = await supabase
              .from('customers')
              .select('*')
              .in('id', custIds);
            if (cErr) throw cErr;
            (custs ?? []).forEach((c: Customer) => custMap.set(c.id, c));
          }

          rows = accounts.map((a: SavingsAccount) => ({
            account_number: a.account_number,
            customer: customerName(custMap.get(a.customer_id)),
            balance: fmtNum(a.balance),
            available: fmtNum(a.available_balance),
            held: fmtNum(a.held_balance),
            accrued_interest: fmtNum(a.accrued_interest),
            status: a.status,
            opened: fmtDate(a.opened_at),
          }));
        } else if (def.id === 'daily_operations') {
          let q = supabase
            .from('daily_operations')
            .select('*')
            .eq('tenant_id', tenant.id)
            .gte('operation_date', dateFrom)
            .lte('operation_date', dateTo)
            .order('operation_date', { ascending: false });
          if (branch) q = q.eq('branch_id', branch.id);
          const { data, error: qErr } = await q;
          if (qErr) throw qErr;
          rows = (data ?? []).map((d: DailyOperation) => ({
            date: fmtDate(d.operation_date),
            state: d.state.replace(/_/g, ' '),
            total_transactions: d.total_transactions,
            total_debits: fmtNum(d.total_debits),
            total_credits: fmtNum(d.total_credits),
            approval_status: d.approval_status ?? '',
          }));
        }

        setResult({ def, rows: scopeByBranch(rows as never[]) as typeof rows, generatedAt: new Date().toISOString() });
      } catch (err) {
        console.error('Error generating report:', err);
        setError(err instanceof Error ? err.message : 'Failed to generate report');
        setResult(null);
      } finally {
        setGeneratingId(null);
      }
    },
    [tenant, branch, dateFrom, dateTo]
  );

  const previewRows = useMemo(() => {
    if (!result) return [];
    const q = previewSearch.trim().toLowerCase();
    if (q === '') return result.rows;
    return result.rows.filter((row) =>
      Object.values(row).some((v) => String(v).toLowerCase().includes(q))
    );
  }, [result, previewSearch]);

  const buildFilename = (ext: string): string => {
    if (!result) return `report.${ext}`;
    const stamp = todayIso();
    return `trust-seed_${result.def.id}_${stamp}.${ext}`;
  };

  const exportCsv = () => {
    if (!result || result.rows.length === 0) return;
    const cols = result.def.columns;
    const header = cols.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(',');
    const lines = result.rows.map((row) =>
      cols
        .map((c) => {
          const val = row[c.key] ?? '';
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(',')
    );
    const csv = [header, ...lines].join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = buildFilename('csv');
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    if (!result || result.rows.length === 0) return;
    const cols = result.def.columns;
    // Map internal keys -> friendly labels for the sheet.
    const sheetData = result.rows.map((row) => {
      const obj: Record<string, string | number> = {};
      cols.forEach((c) => {
        obj[c.label] = row[c.key] ?? '';
      });
      return obj;
    });
    const ws = XLSX.utils.json_to_sheet(sheetData, { header: cols.map((c) => c.label) });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, result.def.title.slice(0, 31));
    XLSX.writeFile(wb, buildFilename('xlsx'));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#641f60]">Reports</h1>
        <p className="text-slate-600 mt-1">Generate and export reports from your live data</p>
      </div>

      {/* Date range (applies to date-based reports) */}
      <div className="bg-white rounded-xl border border-[#dae1e1] p-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex items-center gap-2 text-slate-600">
            <Calendar className="w-5 h-5 text-[#641f60]" />
            <span className="text-sm font-medium">Date range (for dated reports)</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
              <input
                type="date"
                value={dateFrom}
                max={dateTo}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
              <input
                type="date"
                value={dateTo}
                min={dateFrom}
                max={todayIso()}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-[#c46040]/10 border border-[#c46040]/30 rounded-xl p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-[#c46040]/15 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-6 h-6 text-[#c46040]" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-[#c46040]">Couldn&rsquo;t generate report</h3>
            <p className="text-sm text-slate-600">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="px-4 py-2 bg-[#ee7b22] hover:bg-[#c46040] text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Dismiss
          </button>
        </div>
      )}

      {/* Report cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {REPORTS.map((def) => (
          <div key={def.id} className="bg-white rounded-xl border border-[#dae1e1] overflow-hidden flex flex-col">
            <div className={`px-6 py-4 ${def.color} text-white flex items-center gap-3`}>
              {def.icon}
              <h2 className="text-lg font-semibold">{def.title}</h2>
            </div>
            <div className="p-6 flex-1 flex flex-col">
              <p className="text-sm text-slate-500 flex-1">{def.description}</p>
              <div className="flex items-center gap-2 mt-3">
                {def.usesDateRange && (
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Uses date range
                  </span>
                )}
              </div>
              <button
                onClick={() => generate(def)}
                disabled={generatingId !== null}
                className="mt-4 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#641f60] hover:bg-[#4a1646] text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generatingId === def.id ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <TableIcon className="w-5 h-5" />
                    Generate
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Result preview */}
      {result && (
        <div className="bg-white rounded-xl border border-[#dae1e1] overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#641f60]">{result.def.title}</h2>
              <p className="text-sm text-slate-500">
                {result.rows.length} row{result.rows.length === 1 ? '' : 's'} &middot; generated{' '}
                {new Date(result.generatedAt).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={exportCsv}
                disabled={result.rows.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#1ebcb2] hover:bg-[#159089] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
              <button
                onClick={exportExcel}
                disabled={result.rows.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#ee7b22] hover:bg-[#c46040] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Excel
              </button>
            </div>
          </div>

          {result.rows.length > 0 ? (
            <>
              <div className="px-6 py-3 border-b border-slate-100">
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={previewSearch}
                    onChange={(e) => setPreviewSearch(e.target.value)}
                    placeholder="Filter rows..."
                    className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  />
                </div>
              </div>
              <div className="overflow-x-auto max-h-[32rem] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      {result.def.columns.map((c) => (
                        <th
                          key={c.key}
                          className="px-4 py-2.5 text-left font-semibold text-slate-600 whitespace-nowrap"
                        >
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        {result.def.columns.map((c) => (
                          <td key={c.key} className="px-4 py-2.5 text-slate-700 whitespace-nowrap">
                            {String(row[c.key] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewRows.length === 0 && (
                  <div className="py-8 text-center text-slate-400 text-sm">No rows match your filter.</div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">No data for this report</h3>
              <p className="text-slate-500 text-center max-w-sm">
                {result.def.usesDateRange
                  ? 'No records found in the selected date range. Try widening the range.'
                  : 'No records found yet.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}