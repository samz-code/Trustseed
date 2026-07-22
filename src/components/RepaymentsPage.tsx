import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Tables } from '../lib/supabase';
import type { FloatAccount } from '../types';
import { ReceiptModal, buildReceiptData, type ReceiptData } from './TransactionReceipt';
import {
  Banknote,
  Search,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  AlertTriangle,
  X,
  DollarSign,
  TrendingUp,
  CalendarClock,
  Percent,
  Wallet,
  Receipt,
  ChevronRight,
} from 'lucide-react';

type LoanAccount = Tables<'loan_accounts'>;
type ScheduleEntry = Tables<'loan_payment_schedule'>;
type Customer = Tables<'customers'>;

function formatMoney(value: number, currency = 'KES'): string {
  const symbols: Record<string, string> = { USD: '$', KES: 'KSh ', SSP: 'SSP ', EUR: '\u20ac', GBP: '\u00a3' };
  const symbol = symbols[currency] ?? `${currency} `;
  return `${symbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// ---------------------------------------------------------------------------
// Loan arithmetic.
//
// Every figure below is derived from the schedule and the loan account rather
// than stored separately, so a card can never disagree with the ledger it is
// describing.
// ---------------------------------------------------------------------------

interface LoanMetrics {
  principal: number;
  totalRepayable: number;
  totalPaid: number;
  outstanding: number;
  interestTotal: number;
  progressPct: number;
  installmentsTotal: number;
  installmentsPaid: number;
  nextDue: { date: string; amount: number } | null;
  arrears: number;
  daysPastDue: number;
}

function computeMetrics(loan: LoanAccount, schedule: ScheduleEntry[]): LoanMetrics {
  const principal = Number(loan.principal_amount ?? 0);
  const outstanding = Number(loan.total_outstanding ?? 0);

  // Summing the schedule rather than trusting a stored total: if an
  // installment is later restructured or waived, the schedule is the record
  // that changes and the header should follow it.
  const totalRepayable = schedule.reduce((sum, s) => sum + Number(s.total_due ?? 0), 0);
  const totalPaid = schedule.reduce((sum, s) => sum + Number(s.total_paid ?? 0), 0);
  const interestTotal = schedule.reduce((sum, s) => sum + Number(s.interest_due ?? 0), 0);

  const installmentsTotal = schedule.length;
  const installmentsPaid = schedule.filter((s) => s.status === 'paid' || s.status === 'waived').length;

  // Progress is measured against what is actually repayable, not against
  // principal. A member who has paid all the interest and none of the capital
  // has not repaid half the loan, and the bar should not suggest otherwise.
  const progressPct = totalRepayable > 0 ? Math.min(100, (totalPaid / totalRepayable) * 100) : 0;

  // The earliest installment still carrying a balance is what falls due next,
  // regardless of what the loan account's cached next_payment_date says.
  const upcoming = schedule
    .filter((s) => s.status !== 'paid' && s.status !== 'waived')
    .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];

  const nextDue = upcoming
    ? {
        date: upcoming.due_date,
        amount: round2(Number(upcoming.total_due ?? 0) - Number(upcoming.total_paid ?? 0)),
      }
    : null;

  // Arrears counts only installments whose due date has passed. An unpaid
  // installment due next month is not in arrears, and treating it as such
  // would put healthy loans on a collections list.
  const today = new Date().toISOString().slice(0, 10);
  const arrears = schedule
    .filter((s) => s.due_date < today && s.status !== 'paid' && s.status !== 'waived')
    .reduce((sum, s) => sum + round2(Number(s.total_due ?? 0) - Number(s.total_paid ?? 0)), 0);

  return {
    principal,
    totalRepayable,
    totalPaid,
    outstanding,
    interestTotal,
    progressPct,
    installmentsTotal,
    installmentsPaid,
    nextDue,
    arrears: round2(arrears),
    daysPastDue: Number(loan.days_past_due ?? 0),
  };
}

function daysUntil(dateStr: string): number {
  const due = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - now.getTime()) / 86400000);
}

function dueLabel(dateStr: string): { text: string; tone: 'ok' | 'soon' | 'late' } {
  const d = daysUntil(dateStr);
  if (d < 0) return { text: `${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'} overdue`, tone: 'late' };
  if (d === 0) return { text: 'Due today', tone: 'soon' };
  if (d <= 7) return { text: `Due in ${d} day${d === 1 ? '' : 's'}`, tone: 'soon' };
  return { text: `Due ${new Date(dateStr).toLocaleDateString()}`, tone: 'ok' };
}

function customerName(c: Customer | undefined | null): string {
  if (!c) return 'Unknown customer';
  if (c.customer_type !== 'individual') return c.business_name || 'Unnamed business';
  const name = `${c.first_name || ''} ${c.last_name || ''}`.trim();
  return name || 'Unnamed';
}

export function RepaymentsPage() {
  const { tenant, branch, admin } = useAuth();

  // loan_accounts does not currently carry a currency column in every
  // deployment, so read it defensively and fall back to the institution
  // default rather than printing the wrong symbol on a receipt.
  const tenantCurrency =
    (tenant?.settings as { default_currency?: string } | null)?.default_currency ?? 'KES';
  const loanCurrency = (loan: LoanAccount | null | undefined): string =>
    (loan as unknown as { currency?: string } | null)?.currency ?? tenantCurrency;

  const [loans, setLoans] = useState<LoanAccount[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  const [payingInstallment, setPayingInstallment] = useState<ScheduleEntry | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [submitting, setSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Which till the cash was received into. Without this the repayment was
  // recorded against the loan but the money existed nowhere: the customer
  // handed over notes and no float rose to match.
  const [floatAccounts, setFloatAccounts] = useState<FloatAccount[]>([]);
  const [paymentFloatId, setPaymentFloatId] = useState('');

  // Receipt shown after a successful payment. A customer settling a loan
  // instalment deserves the same proof as one sending a transfer.
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  const loadLoans = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    setLoadError(null);
    try {
      let loansQuery = supabase
        .from('loan_accounts')
        .select('*')
        .eq('tenant_id', tenant.id)
        .in('status', ['active', 'restructured'])
        .order('created_at', { ascending: false });
      if (branch) {
        loansQuery = loansQuery.eq('branch_id', branch.id);
      }

      const { data: loanRows, error: loanError } = await loansQuery;
      if (loanError) throw loanError;

      const loanList = loanRows ?? [];
      setLoans(loanList);

      // Tills that can receive the cash, so the drawer rises in the same
      // transaction as the loan being credited.
      const { data: floatRows, error: floatError } = await supabase
        .from('float_accounts')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('status', 'active');
      if (floatError) throw floatError;
      setFloatAccounts((floatRows ?? []) as unknown as FloatAccount[]);

      const customerIds = Array.from(new Set(loanList.map((l) => l.customer_id)));
      if (customerIds.length > 0) {
        const { data: custData, error: custError } = await supabase
          .from('customers')
          .select('*')
          .in('id', customerIds);
        if (custError) throw custError;
        setCustomers(custData ?? []);
      } else {
        setCustomers([]);
      }
    } catch (err) {
      console.error('Error loading loans:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load active loans');
      setLoans([]);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [tenant, branch]);

  useEffect(() => {
    loadLoans();
  }, [loadLoans]);

  const filteredLoans = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q === '') return loans;
    return loans.filter((l) => {
      const customer = customers.find((c) => c.id === l.customer_id);
      return (
        l.loan_number.toLowerCase().includes(q) || customerName(customer).toLowerCase().includes(q)
      );
    });
  }, [loans, customers, searchQuery]);

  const selectedLoan = loans.find((l) => l.id === selectedLoanId) ?? null;

  // Portfolio summary across every active loan on screen. Computed from the
  // loan accounts rather than a separate query so it always agrees with the
  // list beneath it.
  const portfolio = useMemo(() => {
    const outstanding = loans.reduce((sum, l) => sum + Number(l.total_outstanding ?? 0), 0);
    const principal = loans.reduce((sum, l) => sum + Number(l.principal_amount ?? 0), 0);
    const collected = loans.reduce((sum, l) => sum + Number(l.total_paid ?? 0), 0);
    const inArrears = loans.filter((l) => Number(l.days_past_due ?? 0) > 0);
    const arrearsValue = inArrears.reduce((sum, l) => sum + Number(l.amount_past_due ?? 0), 0);

    // Portfolio at risk: the share of the book attached to borrowers who have
    // missed a due date. The standard microfinance health measure, and the
    // number a SACCO board asks for first.
    const par = outstanding > 0
      ? (inArrears.reduce((sum, l) => sum + Number(l.total_outstanding ?? 0), 0) / outstanding) * 100
      : 0;

    return {
      count: loans.length,
      outstanding,
      principal,
      collected,
      arrearsCount: inArrears.length,
      arrearsValue,
      par,
    };
  }, [loans]);

  const metrics = useMemo(
    () => (selectedLoan ? computeMetrics(selectedLoan, schedule) : null),
    [selectedLoan, schedule]
  );

  const loadSchedule = useCallback(async (loanAccountId: string) => {
    setScheduleLoading(true);
    try {
      const { data, error } = await supabase
        .from('loan_payment_schedule')
        .select('*')
        .eq('loan_account_id', loanAccountId)
        .order('payment_number', { ascending: true });
      if (error) throw error;
      setSchedule(data ?? []);
    } catch (err) {
      console.error('Error loading schedule:', err);
      setSchedule([]);
    } finally {
      setScheduleLoading(false);
    }
  }, []);

  const selectLoan = (loanId: string) => {
    setSelectedLoanId(loanId);
    loadSchedule(loanId);
  };

  const openPayment = (installment: ScheduleEntry) => {
    const remaining = round2(installment.total_due - installment.total_paid);
    setPayingInstallment(installment);
    setPaymentAmount(remaining > 0 ? String(remaining) : '');
    setPaymentMethod('cash');
    setPaymentError(null);
  };

  const closePayment = () => {
    setPayingInstallment(null);
    setPaymentAmount('');
    setPaymentError(null);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError(null);

    if (!tenant || !selectedLoan || !payingInstallment) return;

    const amount = parseFloat(paymentAmount);
    if (!paymentAmount || Number.isNaN(amount) || amount <= 0) {
      setPaymentError('Please enter a valid payment amount.');
      return;
    }

    const remainingDue = round2(payingInstallment.total_due - payingInstallment.total_paid);
    if (amount > remainingDue + 0.005) {
      setPaymentError(
        `Payment exceeds the remaining amount due on this installment (${formatMoney(remainingDue)}).`
      );
      return;
    }

    setSubmitting(true);
    try {
      // One database transaction does all of it: allocates interest before
      // principal, updates the installment, recomputes the loan account from
      // the full schedule, credits the till, and writes the ledger entry.
      //
      // Previously this was three separate browser-side writes with no money
      // movement at all. If the second or third failed, the installment read
      // paid while the loan account still said it was owed. And because no
      // float was credited and no transaction row written, the cash the
      // customer handed over existed nowhere in the system.
      const { data: result, error: rpcError } = await supabase.rpc('loan_repayment', {
        p_installment_id: payingInstallment.id,
        p_amount: amount,
        p_float_account_id: paymentFloatId || null,
        p_payment_method: paymentMethod,
        p_notes: null,
      } as never);
      // Guards live in the database ("Payment of 6000 exceeds the 5000 still
      // due on this installment") and are shown verbatim.
      if (rpcError) throw rpcError;

      const row = (Array.isArray(result) ? result[0] : result) as
        | {
            transaction_id?: string;
            interest_applied?: number;
            principal_applied?: number;
            new_float_balance?: number | null;
          }
        | null;

      // Receipt built from what the database actually recorded, not from what
      // the form hoped would happen.
      if (row?.transaction_id && tenant) {
        const customer = customers.find((c) => c.id === selectedLoan.customer_id);
        setReceiptData(
          buildReceiptData({
            institutionName: tenant.name,
            institutionLogoUrl:
              (tenant.settings as { branding?: { logo_url?: string | null } } | null)?.branding
                ?.logo_url ?? null,
            branchName: branch?.name ?? null,
            transactionId: row.transaction_id,
            reference: row.transaction_id.slice(0, 8).toUpperCase(),
            transactionType: 'loan_repayment',
            status: 'completed',
            createdAtIso: new Date().toISOString(),
            customerName: customerName(customer),
            customerAccountNumber: selectedLoan.loan_number ?? null,
            amount,
            currency: loanCurrency(selectedLoan),
            remainingFloatBalance: row.new_float_balance ?? null,
            remainingFloatCurrency: loanCurrency(selectedLoan),
            cashierName: admin?.full_name ?? null,
          })
        );
      }

      await loadLoans();
      await loadSchedule(selectedLoan.id);
      closePayment();
    } catch (err) {
      console.error('Error recording payment:', err);
      setPaymentError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  const getInstallmentBadge = (status: ScheduleEntry['status']) => {
    const map: Record<ScheduleEntry['status'], { cls: string; icon: React.ReactNode }> = {
      pending: { cls: 'bg-slate-100 text-slate-600', icon: <Clock className="w-3.5 h-3.5" /> },
      paid: { cls: 'bg-[#1ebcb2]/10 text-[#1ebcb2]', icon: <CheckCircle className="w-3.5 h-3.5" /> },
      partially_paid: { cls: 'bg-[#ee7b22]/10 text-[#ee7b22]', icon: <Clock className="w-3.5 h-3.5" /> },
      overdue: { cls: 'bg-[#c46040]/10 text-[#c46040]', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
      waived: { cls: 'bg-slate-100 text-slate-500', icon: <CheckCircle className="w-3.5 h-3.5" /> },
    };
    const s = map[status];
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium capitalize ${s.cls}`}>
        {s.icon}
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#641f60]">Loan Repayments</h1>
          <p className="text-slate-600 mt-1">Track repayment schedules and record payments</p>
        </div>
        <button
          onClick={loadLoans}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ================================================================
          Portfolio summary. Four figures a loan officer is asked for
          before anything else: what is out, what has come back, who is
          behind, and how much of the book that represents.
          ================================================================ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="group bg-white rounded-xl border border-[#dae1e1] p-5 transition-all duration-200 hover:shadow-lg hover:shadow-slate-200/60 hover:-translate-y-0.5 hover:border-[#641f60]/30">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-[#641f60]/10 flex items-center justify-center transition-colors group-hover:bg-[#641f60]/15">
              <Wallet className="w-5 h-5 text-[#641f60]" />
            </div>
            <span className="text-xs text-slate-400">{portfolio.count} active</span>
          </div>
          <p className="text-xs font-medium text-slate-500 mb-1">Outstanding</p>
          <p className="text-2xl font-bold text-[#641f60] tabular-nums">
            {formatMoney(portfolio.outstanding, tenantCurrency)}
          </p>
        </div>

        <div className="group bg-white rounded-xl border border-[#dae1e1] p-5 transition-all duration-200 hover:shadow-lg hover:shadow-slate-200/60 hover:-translate-y-0.5 hover:border-[#1ebcb2]/40">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-[#1ebcb2]/10 flex items-center justify-center transition-colors group-hover:bg-[#1ebcb2]/20">
              <TrendingUp className="w-5 h-5 text-[#1ebcb2]" />
            </div>
          </div>
          <p className="text-xs font-medium text-slate-500 mb-1">Collected to date</p>
          <p className="text-2xl font-bold text-[#159089] tabular-nums">
            {formatMoney(portfolio.collected, tenantCurrency)}
          </p>
        </div>

        <div className="group bg-white rounded-xl border border-[#dae1e1] p-5 transition-all duration-200 hover:shadow-lg hover:shadow-slate-200/60 hover:-translate-y-0.5 hover:border-[#c46040]/40">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-[#c46040]/10 flex items-center justify-center transition-colors group-hover:bg-[#c46040]/20">
              <AlertTriangle className="w-5 h-5 text-[#c46040]" />
            </div>
            <span className="text-xs text-slate-400">{portfolio.arrearsCount} loans</span>
          </div>
          <p className="text-xs font-medium text-slate-500 mb-1">In arrears</p>
          <p className="text-2xl font-bold text-[#c46040] tabular-nums">
            {formatMoney(portfolio.arrearsValue, tenantCurrency)}
          </p>
        </div>

        <div className="group bg-white rounded-xl border border-[#dae1e1] p-5 transition-all duration-200 hover:shadow-lg hover:shadow-slate-200/60 hover:-translate-y-0.5 hover:border-[#ee7b22]/40">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-[#ee7b22]/10 flex items-center justify-center transition-colors group-hover:bg-[#ee7b22]/20">
              <Percent className="w-5 h-5 text-[#ee7b22]" />
            </div>
          </div>
          <p className="text-xs font-medium text-slate-500 mb-1">Portfolio at risk</p>
          <p className="text-2xl font-bold text-[#ee7b22] tabular-nums">
            {portfolio.par.toFixed(1)}%
          </p>
        </div>
      </div>

      {loadError && (
        <div className="bg-[#c46040]/10 border border-[#c46040]/30 rounded-xl p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-[#c46040]/15 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-6 h-6 text-[#c46040]" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-[#c46040]">Something went wrong</h3>
            <p className="text-sm text-slate-600">{loadError}</p>
          </div>
          <button
            onClick={loadLoans}
            className="px-4 py-2 bg-[#ee7b22] hover:bg-[#c46040] text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Loan list */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search loans..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-3 w-32 bg-slate-200 rounded mb-2" />
                  <div className="h-2 w-20 bg-slate-100 rounded mb-2" />
                  <div className="h-1.5 w-full bg-slate-100 rounded-full" />
                </div>
              ))}
            </div>
          ) : filteredLoans.length > 0 ? (
            <div className="p-3 space-y-2 max-h-[640px] overflow-y-auto">
              {filteredLoans.map((loan) => {
                const customer = customers.find((c) => c.id === loan.customer_id);
                const isSelected = loan.id === selectedLoanId;

                // Repaid share, from the loan account so the list does not
                // need every loan's schedule fetched to draw a bar.
                const paid = Number(loan.total_paid ?? 0);
                const outstanding = Number(loan.total_outstanding ?? 0);
                const denom = paid + outstanding;
                const pct = denom > 0 ? Math.min(100, (paid / denom) * 100) : 0;
                const late = Number(loan.days_past_due ?? 0) > 0;

                return (
                  <button
                    key={loan.id}
                    onClick={() => selectLoan(loan.id)}
                    className={`group w-full text-left p-4 rounded-xl border transition-all duration-200 ${
                      isSelected
                        ? 'border-[#641f60] bg-[#641f60]/5 shadow-sm'
                        : 'border-[#dae1e1] hover:border-[#641f60]/40 hover:shadow-md hover:shadow-slate-200/50 hover:-translate-y-0.5'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 text-sm truncate">
                          {customerName(customer)}
                        </p>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">{loan.loan_number}</p>
                      </div>
                      <ChevronRight
                        className={`w-4 h-4 flex-shrink-0 transition-all duration-200 ${
                          isSelected
                            ? 'text-[#641f60] translate-x-0.5'
                            : 'text-slate-300 group-hover:text-[#641f60] group-hover:translate-x-0.5'
                        }`}
                      />
                    </div>

                    <div className="flex items-baseline justify-between mb-2">
                      <span className="text-xs text-slate-500">Outstanding</span>
                      <span className="text-sm font-bold text-slate-900 tabular-nums">
                        {formatMoney(outstanding, loanCurrency(loan))}
                      </span>
                    </div>

                    {/* Repayment progress. The bar is the fastest read on a
                        list of thirty loans, so it earns its place above the
                        arrears line. */}
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ease-out ${
                          late ? 'bg-[#c46040]' : 'bg-[#1ebcb2]'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[11px] text-slate-400 tabular-nums">
                        {pct.toFixed(0)}% repaid
                      </span>
                      {late && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#c46040]">
                          <AlertTriangle className="w-3 h-3" />
                          {loan.days_past_due}d overdue
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-14 px-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <Banknote className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-600">No active loans</p>
              <p className="text-xs text-slate-400 text-center mt-1 max-w-[200px]">
                Disbursed loans appear here once they are running.
              </p>
            </div>
          )}
        </div>

        {/* Schedule */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
          {!selectedLoan ? (
            <div className="flex flex-col items-center justify-center py-24 px-4">
              <div className="w-16 h-16 rounded-full bg-[#641f60]/5 flex items-center justify-center mb-4">
                <Receipt className="w-8 h-8 text-[#641f60]/40" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Select a loan</h3>
              <p className="text-slate-500 text-center max-w-sm text-sm">
                Choose a loan on the left to see its repayment schedule, interest breakdown, and
                record a payment.
              </p>
            </div>
          ) : (
            <>
              {/* ==========================================================
                  Loan header: the arithmetic a member asks about at the
                  counter. Principal, what it costs, what has been paid,
                  what is left, and when the next payment falls.
                  ========================================================== */}
              <div className="px-6 py-5 border-b border-[#dae1e1] bg-gradient-to-br from-[#641f60]/[0.04] to-transparent">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      {customerName(customers.find((c) => c.id === selectedLoan.customer_id))}
                    </h2>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      {selectedLoan.loan_number}
                    </p>
                  </div>
                  {metrics?.nextDue && (
                    <div
                      className={`px-4 py-2.5 rounded-xl border transition-colors ${
                        dueLabel(metrics.nextDue.date).tone === 'late'
                          ? 'bg-[#c46040]/10 border-[#c46040]/30'
                          : dueLabel(metrics.nextDue.date).tone === 'soon'
                            ? 'bg-[#ee7b22]/10 border-[#ee7b22]/30'
                            : 'bg-white border-[#dae1e1]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <CalendarClock
                          className={`w-3.5 h-3.5 ${
                            dueLabel(metrics.nextDue.date).tone === 'late'
                              ? 'text-[#c46040]'
                              : dueLabel(metrics.nextDue.date).tone === 'soon'
                                ? 'text-[#ee7b22]'
                                : 'text-slate-400'
                          }`}
                        />
                        <span className="text-[11px] font-medium text-slate-500">
                          {dueLabel(metrics.nextDue.date).text}
                        </span>
                      </div>
                      <p className="text-lg font-bold text-slate-900 tabular-nums">
                        {formatMoney(metrics.nextDue.amount, loanCurrency(selectedLoan))}
                      </p>
                    </div>
                  )}
                </div>

                {metrics && (
                  <>
                    {/* Repayment progress against total repayable, not
                        principal. Paying all the interest is not half the
                        loan, and the bar should not imply it is. */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-slate-500">
                          {metrics.installmentsPaid} of {metrics.installmentsTotal} installments
                          settled
                        </span>
                        <span className="text-xs font-bold text-[#641f60] tabular-nums">
                          {metrics.progressPct.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#1ebcb2] to-[#159089] rounded-full transition-all duration-700 ease-out"
                          style={{ width: `${metrics.progressPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="bg-white rounded-lg border border-[#dae1e1] p-3 transition-all duration-200 hover:border-slate-300 hover:shadow-sm">
                        <p className="text-[11px] font-medium text-slate-400 mb-1">Principal</p>
                        <p className="text-sm font-bold text-slate-900 tabular-nums">
                          {formatMoney(metrics.principal, loanCurrency(selectedLoan))}
                        </p>
                      </div>
                      <div className="bg-white rounded-lg border border-[#dae1e1] p-3 transition-all duration-200 hover:border-slate-300 hover:shadow-sm">
                        <p className="text-[11px] font-medium text-slate-400 mb-1">
                          Interest &amp; fees
                        </p>
                        <p className="text-sm font-bold text-[#ee7b22] tabular-nums">
                          {formatMoney(
                            round2(metrics.totalRepayable - metrics.principal),
                            loanCurrency(selectedLoan)
                          )}
                        </p>
                      </div>
                      <div className="bg-white rounded-lg border border-[#dae1e1] p-3 transition-all duration-200 hover:border-slate-300 hover:shadow-sm">
                        <p className="text-[11px] font-medium text-slate-400 mb-1">Paid to date</p>
                        <p className="text-sm font-bold text-[#159089] tabular-nums">
                          {formatMoney(metrics.totalPaid, loanCurrency(selectedLoan))}
                        </p>
                      </div>
                      <div
                        className={`rounded-lg border p-3 transition-all duration-200 hover:shadow-sm ${
                          metrics.arrears > 0
                            ? 'bg-[#c46040]/5 border-[#c46040]/30'
                            : 'bg-white border-[#dae1e1] hover:border-slate-300'
                        }`}
                      >
                        <p className="text-[11px] font-medium text-slate-400 mb-1">
                          {metrics.arrears > 0 ? 'In arrears' : 'Balance'}
                        </p>
                        <p
                          className={`text-sm font-bold tabular-nums ${
                            metrics.arrears > 0 ? 'text-[#c46040]' : 'text-slate-900'
                          }`}
                        >
                          {formatMoney(
                            metrics.arrears > 0 ? metrics.arrears : metrics.outstanding,
                            loanCurrency(selectedLoan)
                          )}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {scheduleLoading ? (
                <div className="p-5 space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="animate-pulse flex items-center gap-4">
                      <div className="w-9 h-9 rounded-lg bg-slate-200 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="h-3 w-28 bg-slate-200 rounded mb-2" />
                        <div className="h-2 w-40 bg-slate-100 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : schedule.length > 0 ? (
                <div className="p-4 space-y-2.5 max-h-[560px] overflow-y-auto">
                  {schedule.map((installment) => {
                    const due = Number(installment.total_due ?? 0);
                    const paid = Number(installment.total_paid ?? 0);
                    const remaining = round2(due - paid);
                    const canPay = installment.status !== 'paid' && installment.status !== 'waived';
                    const pct = due > 0 ? Math.min(100, (paid / due) * 100) : 0;
                    const isLate =
                      installment.due_date < new Date().toISOString().slice(0, 10) && canPay;

                    return (
                      <div
                        key={installment.id}
                        className={`group rounded-xl border p-4 transition-all duration-200 ${
                          isLate
                            ? 'border-[#c46040]/30 bg-[#c46040]/[0.03] hover:border-[#c46040]/50'
                            : installment.status === 'paid'
                              ? 'border-[#dae1e1] bg-slate-50/50'
                              : 'border-[#dae1e1] hover:border-[#641f60]/30 hover:shadow-md hover:shadow-slate-200/50'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          {/* Installment number, sized to read at a glance
                              when scanning a twelve-month schedule. */}
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold transition-colors ${
                              installment.status === 'paid'
                                ? 'bg-[#1ebcb2]/15 text-[#159089]'
                                : isLate
                                  ? 'bg-[#c46040]/15 text-[#c46040]'
                                  : 'bg-slate-100 text-slate-500 group-hover:bg-[#641f60]/10 group-hover:text-[#641f60]'
                            }`}
                          >
                            {installment.payment_number}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-slate-900">
                                  {new Date(installment.due_date).toLocaleDateString(undefined, {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                                </span>
                                {getInstallmentBadge(installment.status)}
                              </div>
                              <span className="text-sm font-bold text-slate-900 tabular-nums">
                                {formatMoney(due, loanCurrency(selectedLoan))}
                              </span>
                            </div>

                            {/* The split. A member asking "why is my payment
                                5,000 when I borrowed 50,000" is asking this
                                question, and burying it in a modal does not
                                answer it. */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 mb-2">
                              <span>
                                Principal{' '}
                                <span className="font-medium text-slate-700 tabular-nums">
                                  {formatMoney(
                                    Number(installment.principal_due ?? 0),
                                    loanCurrency(selectedLoan)
                                  )}
                                </span>
                              </span>
                              <span>
                                Interest{' '}
                                <span className="font-medium text-[#ee7b22] tabular-nums">
                                  {formatMoney(
                                    Number(installment.interest_due ?? 0),
                                    loanCurrency(selectedLoan)
                                  )}
                                </span>
                              </span>
                              {Number(installment.penalty_due ?? 0) > 0 && (
                                <span>
                                  Penalty{' '}
                                  <span className="font-medium text-[#c46040] tabular-nums">
                                    {formatMoney(
                                      Number(installment.penalty_due ?? 0),
                                      loanCurrency(selectedLoan)
                                    )}
                                  </span>
                                </span>
                              )}
                            </div>

                            {paid > 0 && (
                              <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden mb-2">
                                <div
                                  className="h-full bg-[#1ebcb2] rounded-full transition-all duration-500 ease-out"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            )}

                            <div className="flex items-center justify-between gap-3">
                              <span className="text-[11px] text-slate-400 tabular-nums">
                                {paid > 0
                                  ? `${formatMoney(paid, loanCurrency(selectedLoan))} paid · ${formatMoney(remaining, loanCurrency(selectedLoan))} remaining`
                                  : 'Nothing paid yet'}
                              </span>
                              {canPay && (
                                <button
                                  onClick={() => openPayment(installment)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#ee7b22] hover:bg-[#c46040] text-white text-xs font-semibold rounded-lg transition-all duration-200 hover:shadow-md hover:shadow-[#ee7b22]/25 active:scale-[0.97]"
                                >
                                  <DollarSign className="w-3.5 h-3.5" />
                                  Pay {remaining > 0 ? formatMoney(remaining, loanCurrency(selectedLoan)) : ''}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <p className="text-sm text-slate-400">No schedule found for this loan.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Record Payment Modal */}
      {payingInstallment && selectedLoan && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#641f60]">
                Record Payment &mdash; Installment {payingInstallment.payment_number}
              </h2>
              <button
                onClick={closePayment}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                Remaining due:{' '}
                <span className="font-semibold text-slate-900">
                  {formatMoney(round2(payingInstallment.total_due - payingInstallment.total_paid))}
                </span>
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                >
                  <option value="cash">Cash</option>
                  <option value="mpesa">M-Pesa</option>
                  <option value="mtn_momo">MTN Mobile Money</option>
                  <option value="bank">Bank Transfer</option>
                </select>
              </div>

              {/* Which till receives the cash. Optional, because a bank
                  transfer never passes through a drawer — but when cash is
                  taken at the counter, naming the till is what keeps the
                  drawer and the books in agreement. */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Received into which till?
                </label>
                <select
                  value={paymentFloatId}
                  onChange={(e) => setPaymentFloatId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                >
                  <option value="">Not tied to a till</option>
                  {floatAccounts
                    .filter((f) => f.currency === loanCurrency(selectedLoan))
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.float_type.replace(/_/g, ' ')} — {f.currency}{' '}
                        {Number(f.balance || 0).toLocaleString()}
                      </option>
                    ))}
                </select>
                <p className="text-xs text-slate-400 mt-1">
                  Choosing a till credits it in the same transaction as the loan, so cash on hand
                  matches what the books say was collected.
                </p>
              </div>

              {paymentError && (
                <div className="p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm">
                  {paymentError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closePayment}
                  className="px-4 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg transition-all duration-200 hover:shadow-xl hover:shadow-[#ee7b22]/25 active:scale-[0.98] disabled:opacity-50 disabled:hover:shadow-lg flex items-center gap-2"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <DollarSign className="w-5 h-5" />}
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt — a customer paying a loan instalment gets the same proof
          as one sending a transfer. */}
      {receiptData && (
        <ReceiptModal data={receiptData} onClose={() => setReceiptData(null)} />
      )}
    </div>
  );
}