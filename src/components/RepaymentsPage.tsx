import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Tables } from '../lib/supabase';
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

function customerName(c: Customer | undefined | null): string {
  if (!c) return 'Unknown customer';
  if (c.customer_type !== 'individual') return c.business_name || 'Unnamed business';
  const name = `${c.first_name || ''} ${c.last_name || ''}`.trim();
  return name || 'Unnamed';
}

export function RepaymentsPage() {
  const { tenant, branch } = useAuth();

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
      // Allocate the payment: interest first, then principal (standard practice).
      const interestRemaining = round2(payingInstallment.interest_due - payingInstallment.interest_paid);
      const interestPortion = round2(Math.min(amount, Math.max(interestRemaining, 0)));
      const principalPortion = round2(amount - interestPortion);

      const newInterestPaid = round2(payingInstallment.interest_paid + interestPortion);
      const newPrincipalPaid = round2(payingInstallment.principal_paid + principalPortion);
      const newTotalPaid = round2(payingInstallment.total_paid + amount);
      const isFullyPaid = newTotalPaid >= round2(payingInstallment.total_due) - 0.005;

      const { error: scheduleError } = await supabase
        .from('loan_payment_schedule')
        .update({
          interest_paid: newInterestPaid,
          principal_paid: newPrincipalPaid,
          total_paid: newTotalPaid,
          paid_date: isFullyPaid ? new Date().toISOString().slice(0, 10) : payingInstallment.paid_date,
          payment_method: paymentMethod,
          status: isFullyPaid
            ? 'paid'
            : newTotalPaid > 0
            ? 'partially_paid'
            : payingInstallment.status,
        })
        .eq('id', payingInstallment.id)
        .eq('tenant_id', tenant.id);

      if (scheduleError) throw scheduleError;

      // Recompute loan account aggregates from the full schedule so the
      // account's outstanding figures always match the sum of its
      // installments, rather than drifting from incremental updates.
      const { data: fullSchedule, error: scheduleReadError } = await supabase
        .from('loan_payment_schedule')
        .select('*')
        .eq('loan_account_id', selectedLoan.id);
      if (scheduleReadError) throw scheduleReadError;

      const rows = fullSchedule ?? [];
      const outstandingPrincipal = round2(
        rows.reduce((s, r) => s + (r.principal_due - r.principal_paid), 0)
      );
      const outstandingInterest = round2(
        rows.reduce((s, r) => s + (r.interest_due - r.interest_paid), 0)
      );
      const totalOutstanding = round2(outstandingPrincipal + outstandingInterest);
      const nextPending = rows
        .filter((r) => r.status === 'pending' || r.status === 'partially_paid' || r.status === 'overdue')
        .sort((a, b) => a.payment_number - b.payment_number)[0];
      const allPaid = rows.every((r) => r.status === 'paid' || r.status === 'waived');

      const { error: accountError } = await supabase
        .from('loan_accounts')
        .update({
          outstanding_principal: outstandingPrincipal,
          outstanding_interest: outstandingInterest,
          total_outstanding: totalOutstanding,
          next_payment_date: nextPending?.due_date ?? null,
          next_payment_amount: nextPending ? round2(nextPending.total_due - nextPending.total_paid) : null,
          last_payment_date: new Date().toISOString().slice(0, 10),
          last_payment_amount: amount,
          status: allPaid ? 'fully_paid' : 'active',
        })
        .eq('id', selectedLoan.id)
        .eq('tenant_id', tenant.id);

      if (accountError) throw accountError;

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
      <div>
        <h1 className="text-2xl font-bold text-[#641f60]">Loan Repayments</h1>
        <p className="text-slate-600 mt-1">Track repayment schedules and record payments</p>
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
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[#641f60]" />
            </div>
          ) : filteredLoans.length > 0 ? (
            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
              {filteredLoans.map((loan) => {
                const customer = customers.find((c) => c.id === loan.customer_id);
                const isSelected = loan.id === selectedLoanId;
                return (
                  <button
                    key={loan.id}
                    onClick={() => selectLoan(loan.id)}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      isSelected ? 'bg-[#641f60]/5 border-l-4 border-[#641f60]' : 'hover:bg-slate-50'
                    }`}
                  >
                    <p className="font-medium text-slate-900 text-sm truncate">{customerName(customer)}</p>
                    <p className="text-xs text-slate-500 font-mono">{loan.loan_number}</p>
                    <p className="text-xs text-slate-600 mt-1">
                      Outstanding: {formatMoney(loan.total_outstanding)}
                    </p>
                    {loan.days_past_due > 0 && (
                      <p className="text-xs text-[#c46040] mt-0.5">{loan.days_past_due} days overdue</p>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <Banknote className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm text-slate-500 text-center">No active loans found</p>
            </div>
          )}
        </div>

        {/* Schedule */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
          {!selectedLoan ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <Banknote className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Select a loan</h3>
              <p className="text-slate-500 text-center max-w-sm">
                Choose a loan on the left to view its repayment schedule.
              </p>
            </div>
          ) : (
            <>
              <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-slate-900">
                      {customerName(customers.find((c) => c.id === selectedLoan.customer_id))}
                    </h2>
                    <p className="text-xs text-slate-500 font-mono">{selectedLoan.loan_number}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Outstanding</p>
                    <p className="font-bold text-slate-900">{formatMoney(selectedLoan.total_outstanding)}</p>
                  </div>
                </div>
              </div>

              {scheduleLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-[#641f60]" />
                </div>
              ) : schedule.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 text-xs uppercase border-b border-slate-200">
                        <th className="text-left px-4 py-2">#</th>
                        <th className="text-left px-4 py-2">Due Date</th>
                        <th className="text-right px-4 py-2">Due</th>
                        <th className="text-right px-4 py-2">Paid</th>
                        <th className="text-left px-4 py-2">Status</th>
                        <th className="text-right px-4 py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {schedule.map((installment) => {
                        const remaining = round2(installment.total_due - installment.total_paid);
                        const canPay = installment.status !== 'paid' && installment.status !== 'waived';
                        return (
                          <tr key={installment.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-2.5 text-slate-500">{installment.payment_number}</td>
                            <td className="px-4 py-2.5 text-slate-700">
                              {new Date(installment.due_date).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono">
                              {formatMoney(installment.total_due)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono">
                              {formatMoney(installment.total_paid)}
                            </td>
                            <td className="px-4 py-2.5">{getInstallmentBadge(installment.status)}</td>
                            <td className="px-4 py-2.5 text-right">
                              {canPay && (
                                <button
                                  onClick={() => openPayment(installment)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#ee7b22] hover:bg-[#c46040] text-white text-xs font-medium rounded-lg transition-colors"
                                >
                                  <DollarSign className="w-3 h-3" />
                                  Pay {remaining > 0 ? formatMoney(remaining) : ''}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full">
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
                  className="px-6 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <DollarSign className="w-5 h-5" />}
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}