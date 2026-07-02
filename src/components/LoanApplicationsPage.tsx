import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Tables, InsertTables } from '../lib/supabase';
import {
  Plus,
  Search,
  FileText,
  X,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  ThumbsUp,
  ThumbsDown,
  CircleDollarSign,
} from 'lucide-react';

type LoanApplication = Tables<'loan_applications'>;
type LoanProduct = Tables<'loan_products'>;
type Customer = Tables<'customers'>;
type ApplicationStatus = LoanApplication['status'];

interface ApplicationForm {
  customer_id: string;
  product_id: string;
  requested_amount: string;
  currency: string;
  term_months: string;
  purpose: string;
  collateral_type: string;
  collateral_description: string;
  collateral_value: string;
  guarantor_name: string;
  guarantor_phone: string;
  monthly_income: string;
  employment_status: string;
  employer_name: string;
}

const EMPTY_FORM: ApplicationForm = {
  customer_id: '',
  product_id: '',
  requested_amount: '',
  currency: 'KES',
  term_months: '',
  purpose: '',
  collateral_type: '',
  collateral_description: '',
  collateral_value: '',
  guarantor_name: '',
  guarantor_phone: '',
  monthly_income: '',
  employment_status: '',
  employer_name: '',
};

function formatMoney(value: number, currency = 'KES'): string {
  const symbols: Record<string, string> = { USD: '$', KES: 'KSh ', SSP: 'SSP ', EUR: '\u20ac', GBP: '\u00a3' };
  const symbol = symbols[currency] ?? `${currency} `;
  return `${symbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function customerName(c: Customer | undefined | null): string {
  if (!c) return 'Unknown customer';
  if (c.customer_type !== 'individual') return c.business_name || 'Unnamed business';
  const name = `${c.first_name || ''} ${c.last_name || ''}`.trim();
  return name || 'Unnamed';
}

interface ScheduleRow {
  payment_number: number;
  due_date: string;
  principal_due: number;
  interest_due: number;
  total_due: number;
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Generates a monthly amortization schedule.
 * - reducing_balance: standard declining-balance amortized payment (equal
 *   total installment, interest computed on the remaining balance each period).
 * - flat: interest computed once on the original principal and spread evenly.
 * The final installment is adjusted so cumulative principal exactly equals
 * the loan principal, avoiding floating-point drift over many periods.
 */
function generateAmortizationSchedule(
  principal: number,
  annualRatePct: number,
  termMonths: number,
  interestType: 'flat' | 'reducing_balance',
  disbursementDate: string
): ScheduleRow[] {
  const monthlyRate = annualRatePct / 100 / 12;
  const rows: ScheduleRow[] = [];

  if (interestType === 'flat') {
    const totalInterest = principal * (annualRatePct / 100) * (termMonths / 12);
    const principalPerPeriod = principal / termMonths;
    const interestPerPeriod = totalInterest / termMonths;
    let cumulativePrincipal = 0;

    for (let i = 1; i <= termMonths; i++) {
      const isLast = i === termMonths;
      const principalDue = isLast ? round2(principal - cumulativePrincipal) : round2(principalPerPeriod);
      cumulativePrincipal += principalDue;
      const interestDue = round2(interestPerPeriod);
      rows.push({
        payment_number: i,
        due_date: addMonths(disbursementDate, i),
        principal_due: principalDue,
        interest_due: interestDue,
        total_due: round2(principalDue + interestDue),
      });
    }
    return rows;
  }

  // reducing_balance
  const payment =
    monthlyRate > 0
      ? (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths))
      : principal / termMonths;

  let remaining = principal;
  for (let i = 1; i <= termMonths; i++) {
    const isLast = i === termMonths;
    const interestDue = round2(remaining * monthlyRate);
    let principalDue = round2(payment - interestDue);
    if (isLast) {
      principalDue = round2(remaining); // zero out any rounding drift on the final installment
    }
    remaining = round2(remaining - principalDue);
    rows.push({
      payment_number: i,
      due_date: addMonths(disbursementDate, i),
      principal_due: principalDue,
      interest_due: interestDue,
      total_due: round2(principalDue + interestDue),
    });
  }
  return rows;
}

export function LoanApplicationsPage() {
  const { tenant, branch, admin } = useAuth();

  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ApplicationStatus>('all');

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<ApplicationForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [actioningId, setActioningId] = useState<string | null>(null);
  const [disbursingId, setDisbursingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const loadData = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    setLoadError(null);
    try {
      let appsQuery = supabase
        .from('loan_applications')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });
      if (branch) {
        appsQuery = appsQuery.eq('branch_id', branch.id);
      }

      const productsQuery = supabase
        .from('loan_products')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('status', 'active');

      const customersQuery = supabase
        .from('customers')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('status', 'active');

      const [appsRes, productsRes, customersRes] = await Promise.all([
        appsQuery,
        productsQuery,
        customersQuery,
      ]);

      if (appsRes.error) throw appsRes.error;
      if (productsRes.error) throw productsRes.error;
      if (customersRes.error) throw customersRes.error;

      setApplications(appsRes.data ?? []);
      setProducts(productsRes.data ?? []);
      setCustomers(customersRes.data ?? []);
    } catch (err) {
      console.error('Error loading loan applications:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load loan applications');
      setApplications([]);
      setProducts([]);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [tenant, branch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredApplications = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return applications.filter((a) => {
      const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
      const customer = customers.find((c) => c.id === a.customer_id);
      const matchesSearch =
        q === '' ||
        a.application_number.toLowerCase().includes(q) ||
        customerName(customer).toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [applications, customers, searchQuery, statusFilter]);

  const selectedProduct = products.find((p) => p.id === formData.product_id) ?? null;

  const validateForm = (): string | null => {
    if (!formData.customer_id) return 'Please select a customer.';
    if (!formData.product_id) return 'Please select a loan product.';

    const amount = parseFloat(formData.requested_amount);
    if (!formData.requested_amount || Number.isNaN(amount) || amount <= 0) {
      return 'Please enter a valid requested amount.';
    }
    if (selectedProduct) {
      if (amount < selectedProduct.min_amount) {
        return `Amount must be at least ${formatMoney(selectedProduct.min_amount, formData.currency)} for this product.`;
      }
      if (selectedProduct.max_amount !== null && amount > selectedProduct.max_amount) {
        return `Amount cannot exceed ${formatMoney(selectedProduct.max_amount, formData.currency)} for this product.`;
      }
    }

    const term = parseInt(formData.term_months, 10);
    if (!formData.term_months || Number.isNaN(term) || term < 1) {
      return 'Please enter a valid loan term in months.';
    }
    if (selectedProduct) {
      if (term < selectedProduct.min_term_months) {
        return `Term must be at least ${selectedProduct.min_term_months} months for this product.`;
      }
      if (selectedProduct.max_term_months !== null && term > selectedProduct.max_term_months) {
        return `Term cannot exceed ${selectedProduct.max_term_months} months for this product.`;
      }
    }

    if (selectedProduct?.requires_collateral && !formData.collateral_description.trim()) {
      return 'This product requires collateral — please describe it.';
    }

    return null;
  };

  const openForm = () => {
    setFormData(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setFormData(EMPTY_FORM);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!tenant || !admin) {
      setFormError('No institution context found. Please sign in again.');
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const insert: InsertTables<'loan_applications'> = {
        tenant_id: tenant.id,
        branch_id: branch?.id ?? null,
        customer_id: formData.customer_id,
        product_id: formData.product_id,
        requested_amount: parseFloat(formData.requested_amount),
        currency: formData.currency,
        term_months: parseInt(formData.term_months, 10),
        purpose: formData.purpose.trim() || null,
        collateral_type: formData.collateral_type.trim() || null,
        collateral_description: formData.collateral_description.trim() || null,
        collateral_value: formData.collateral_value ? parseFloat(formData.collateral_value) : null,
        guarantor_name: formData.guarantor_name.trim() || null,
        guarantor_phone: formData.guarantor_phone.trim() || null,
        monthly_income: formData.monthly_income ? parseFloat(formData.monthly_income) : null,
        employment_status: formData.employment_status.trim() || null,
        employer_name: formData.employer_name.trim() || null,
        status: 'submitted',
        created_by: admin.id,
      };

      const { error } = await supabase.from('loan_applications').insert(insert);
      if (error) throw error;

      await loadData();
      closeForm();
    } catch (err) {
      console.error('Error creating loan application:', err);
      setFormError(err instanceof Error ? err.message : 'Failed to create loan application');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (application: LoanApplication) => {
    if (!tenant || !admin) return;
    setActioningId(application.id);
    try {
      const { error } = await supabase
        .from('loan_applications')
        .update({
          status: 'approved',
          approved_amount: application.requested_amount,
          approved_by: admin.id,
          approved_at: new Date().toISOString(),
          reviewed_by: admin.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', application.id)
        .eq('tenant_id', tenant.id);

      if (error) throw error;
      await loadData();
    } catch (err) {
      console.error('Error approving application:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to approve application');
    } finally {
      setActioningId(null);
    }
  };

  const openReject = (id: string) => {
    setRejectingId(id);
    setRejectionReason('');
  };

  const handleReject = async () => {
    if (!tenant || !admin || !rejectingId) return;
    if (!rejectionReason.trim()) {
      setLoadError('A rejection reason is required.');
      return;
    }
    setActioningId(rejectingId);
    try {
      const { error } = await supabase
        .from('loan_applications')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason.trim(),
          reviewed_by: admin.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', rejectingId)
        .eq('tenant_id', tenant.id);

      if (error) throw error;
      await loadData();
      setRejectingId(null);
      setRejectionReason('');
    } catch (err) {
      console.error('Error rejecting application:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to reject application');
    } finally {
      setActioningId(null);
    }
  };

  const handleDisburse = async (application: LoanApplication) => {
    if (!tenant) return;
    const product = products.find((p) => p.id === application.product_id);
    if (!product) {
      setLoadError('Could not find the loan product for this application.');
      return;
    }
    const principal = application.approved_amount ?? application.requested_amount;
    if (!principal || principal <= 0) {
      setLoadError('This application has no valid approved amount to disburse.');
      return;
    }

    setDisbursingId(application.id);
    try {
      const disbursementDate = new Date().toISOString().slice(0, 10);
      const maturityDate = addMonths(disbursementDate, application.term_months);

      const accountInsert: InsertTables<'loan_accounts'> = {
        tenant_id: tenant.id,
        branch_id: application.branch_id,
        application_id: application.id,
        customer_id: application.customer_id,
        product_id: product.id,
        principal_amount: principal,
        interest_rate: product.default_interest_rate,
        term_months: application.term_months,
        status: 'active',
      };

      const { data: createdAccount, error: accountError } = await supabase
        .from('loan_accounts')
        .insert(accountInsert)
        .select()
        .maybeSingle();

      if (accountError) throw accountError;
      if (!createdAccount) throw new Error('Loan account was not created.');

      const schedule = generateAmortizationSchedule(
        principal,
        product.default_interest_rate,
        application.term_months,
        product.interest_type,
        disbursementDate
      );

      const scheduleInserts: InsertTables<'loan_payment_schedule'>[] = schedule.map((row) => ({
        tenant_id: tenant.id,
        loan_account_id: createdAccount.id,
        payment_number: row.payment_number,
        due_date: row.due_date,
        principal_due: row.principal_due,
        interest_due: row.interest_due,
        total_due: row.total_due,
        status: 'pending',
      }));

      const { error: scheduleError } = await supabase
        .from('loan_payment_schedule')
        .insert(scheduleInserts);

      if (scheduleError) {
        // loan_accounts has no DELETE policy (by design, for audit integrity),
        // so we cannot silently roll back a loan account with no schedule.
        // Surface this clearly instead.
        throw new Error(
          `Loan account ${createdAccount.loan_number} was created, but its repayment schedule failed to generate: ` +
            `${scheduleError.message}. This loan currently has no schedule and needs review.`
        );
      }

      const totalInterest = schedule.reduce((s, r) => s + r.interest_due, 0);
      const { error: updateAccountError } = await supabase
        .from('loan_accounts')
        .update({
          disbursement_date: disbursementDate,
          maturity_date: maturityDate,
          outstanding_principal: principal,
          outstanding_interest: round2(totalInterest),
          total_outstanding: round2(principal + totalInterest),
          next_payment_date: schedule[0]?.due_date ?? null,
          next_payment_amount: schedule[0]?.total_due ?? null,
        })
        .eq('id', createdAccount.id)
        .eq('tenant_id', tenant.id);

      if (updateAccountError) throw updateAccountError;

      const { error: appUpdateError } = await supabase
        .from('loan_applications')
        .update({ status: 'disbursed' })
        .eq('id', application.id)
        .eq('tenant_id', tenant.id);

      if (appUpdateError) throw appUpdateError;

      await loadData();
    } catch (err) {
      console.error('Error disbursing loan:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to disburse loan');
    } finally {
      setDisbursingId(null);
    }
  };

  const getStatusBadge = (status: ApplicationStatus) => {
    const map: Record<ApplicationStatus, { cls: string; icon: React.ReactNode }> = {
      draft: { cls: 'bg-slate-100 text-slate-600', icon: <FileText className="w-3.5 h-3.5" /> },
      submitted: { cls: 'bg-[#ee7b22]/10 text-[#ee7b22]', icon: <Send className="w-3.5 h-3.5" /> },
      under_review: { cls: 'bg-[#ee7b22]/10 text-[#ee7b22]', icon: <Clock className="w-3.5 h-3.5" /> },
      approved: { cls: 'bg-[#1ebcb2]/10 text-[#1ebcb2]', icon: <CheckCircle className="w-3.5 h-3.5" /> },
      rejected: { cls: 'bg-[#c46040]/10 text-[#c46040]', icon: <XCircle className="w-3.5 h-3.5" /> },
      withdrawn: { cls: 'bg-slate-100 text-slate-500', icon: <XCircle className="w-3.5 h-3.5" /> },
      disbursed: { cls: 'bg-[#641f60]/10 text-[#641f60]', icon: <CheckCircle className="w-3.5 h-3.5" /> },
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#641f60]">Loan Applications</h1>
          <p className="text-slate-600 mt-1">Review, approve, and track loan applications</p>
        </div>
        <button
          onClick={openForm}
          disabled={products.length === 0 || customers.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-5 h-5" />
          New Application
        </button>
      </div>

      {(products.length === 0 || customers.length === 0) && !loading && (
        <div className="bg-[#ee7b22]/10 border border-[#ee7b22]/30 rounded-xl p-4 text-sm text-[#641f60]">
          {products.length === 0 && 'You need at least one active loan product. '}
          {customers.length === 0 && 'You need at least one active customer. '}
          Add these first before submitting an application.
        </div>
      )}

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
            onClick={loadData}
            className="px-4 py-2 bg-[#ee7b22] hover:bg-[#c46040] text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by application number or customer..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="disbursed">Disbursed</option>
          </select>
        </div>
      </div>

      {/* Applications list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#641f60]" />
          </div>
        ) : filteredApplications.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filteredApplications.map((app) => {
              const customer = customers.find((c) => c.id === app.customer_id);
              const product = products.find((p) => p.id === app.product_id);
              const canDecide = app.status === 'submitted' || app.status === 'under_review';
              return (
                <div key={app.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm text-slate-500">{app.application_number}</span>
                        {getStatusBadge(app.status)}
                      </div>
                      <h3 className="font-semibold text-slate-900 mt-1">{customerName(customer)}</h3>
                      <p className="text-sm text-slate-600">
                        {product?.name ?? 'Unknown product'} · {formatMoney(app.requested_amount, app.currency)} ·{' '}
                        {app.term_months} months
                      </p>
                      {app.purpose && <p className="text-sm text-slate-500 mt-1">{app.purpose}</p>}
                      {app.status === 'rejected' && app.rejection_reason && (
                        <p className="text-sm text-[#c46040] mt-1">Rejected: {app.rejection_reason}</p>
                      )}
                    </div>
                    {canDecide && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleApprove(app)}
                          disabled={actioningId === app.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1ebcb2] hover:bg-[#641f60] text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                        >
                          {actioningId === app.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ThumbsUp className="w-3.5 h-3.5" />
                          )}
                          Approve
                        </button>
                        <button
                          onClick={() => openReject(app.id)}
                          disabled={actioningId === app.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#c46040] text-[#c46040] hover:bg-[#c46040]/10 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      </div>
                    )}
                    {app.status === 'approved' && (
                      <div className="flex-shrink-0">
                        <button
                          onClick={() => handleDisburse(app)}
                          disabled={disbursingId === app.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#641f60] hover:bg-[#4a1646] text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                        >
                          {disbursingId === app.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CircleDollarSign className="w-3.5 h-3.5" />
                          )}
                          Disburse
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No applications found</h3>
            <p className="text-slate-500 text-center max-w-sm">
              {searchQuery || statusFilter !== 'all'
                ? 'No applications match your search or filter.'
                : 'Submit your first loan application to get started.'}
            </p>
          </div>
        )}
      </div>

      {/* New Application Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-[#641f60]">New Loan Application</h2>
              <button
                onClick={closeForm}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Customer *</label>
                  <select
                    required
                    value={formData.customer_id}
                    onChange={(e) => setFormData((prev) => ({ ...prev, customer_id: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  >
                    <option value="">Select a customer</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {customerName(c)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Loan Product *</label>
                  <select
                    required
                    value={formData.product_id}
                    onChange={(e) => setFormData((prev) => ({ ...prev, product_id: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  >
                    <option value="">Select a product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.default_interest_rate}%)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedProduct && (
                <p className="text-xs text-slate-500 -mt-2">
                  {selectedProduct.name}: {formatMoney(selectedProduct.min_amount)}
                  {selectedProduct.max_amount ? ` – ${formatMoney(selectedProduct.max_amount)}` : '+'}, term{' '}
                  {selectedProduct.min_term_months}
                  {selectedProduct.max_term_months ? `–${selectedProduct.max_term_months}` : '+'} months
                  {selectedProduct.requires_collateral ? ', collateral required' : ''}.
                </p>
              )}

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.requested_amount}
                    onChange={(e) => setFormData((prev) => ({ ...prev, requested_amount: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData((prev) => ({ ...prev, currency: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  >
                    <option value="KES">KES</option>
                    <option value="USD">USD</option>
                    <option value="SSP">SSP</option>
                    <option value="UGX">UGX</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Term (months) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.term_months}
                    onChange={(e) => setFormData((prev) => ({ ...prev, term_months: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Purpose</label>
                <input
                  type="text"
                  value={formData.purpose}
                  onChange={(e) => setFormData((prev) => ({ ...prev, purpose: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  placeholder="What is this loan for?"
                />
              </div>

              {selectedProduct?.requires_collateral && (
                <div className="border-t border-slate-200 pt-4 space-y-4">
                  <h3 className="text-sm font-semibold text-slate-900">Collateral (required for this product)</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                      <input
                        type="text"
                        value={formData.collateral_type}
                        onChange={(e) => setFormData((prev) => ({ ...prev, collateral_type: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                        placeholder="Vehicle, land title..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Estimated Value</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.collateral_value}
                        onChange={(e) => setFormData((prev) => ({ ...prev, collateral_value: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
                    <textarea
                      rows={2}
                      value={formData.collateral_description}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, collateral_description: e.target.value }))
                      }
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              <div className="border-t border-slate-200 pt-4 space-y-4">
                <h3 className="text-sm font-semibold text-slate-900">Guarantor & Income (optional)</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Guarantor Name</label>
                    <input
                      type="text"
                      value={formData.guarantor_name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, guarantor_name: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Guarantor Phone</label>
                    <input
                      type="tel"
                      value={formData.guarantor_phone}
                      onChange={(e) => setFormData((prev) => ({ ...prev, guarantor_phone: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Income</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.monthly_income}
                      onChange={(e) => setFormData((prev) => ({ ...prev, monthly_income: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Employment Status</label>
                    <input
                      type="text"
                      value={formData.employment_status}
                      onChange={(e) => setFormData((prev) => ({ ...prev, employment_status: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                      placeholder="Employed, self-employed..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Employer</label>
                    <input
                      type="text"
                      value={formData.employer_name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, employer_name: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {formError && (
                <div className="p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm">
                  {formError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-4 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Submit Application
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {rejectingId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-lg font-bold text-[#641f60] mb-4">Reject Application</h2>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reason *</label>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
              placeholder="Why is this application being rejected?"
              autoFocus
            />
            <div className="flex items-center justify-end gap-3 mt-4">
              <button
                onClick={() => setRejectingId(null)}
                className="px-4 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actioningId === rejectingId}
                className="px-6 py-2.5 bg-[#c46040] hover:bg-[#641f60] text-white font-medium rounded-lg shadow-lg disabled:opacity-50 flex items-center gap-2"
              >
                {actioningId === rejectingId ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <ThumbsDown className="w-5 h-5" />
                )}
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}