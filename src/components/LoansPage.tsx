import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { LoanProduct, LoanApplication, LoanAccount, Customer, FloatAccount } from '../types';
import type { InsertTables } from '../lib/supabase';
import { ReceiptModal, buildReceiptData, type ReceiptData } from './TransactionReceipt';
import {
  Plus,
  Search,
  Banknote,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  DollarSign,
  Calendar,
  TrendingUp,
  AlertCircle,
  Eye,
  FileText,
  X,
  RefreshCw,
  Send,
  ThumbsUp,
  ThumbsDown,
  Wallet,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Form shapes
// ---------------------------------------------------------------------------

interface ProductForm {
  name: string;
  code: string;
  description: string;
  min_amount: string;
  max_amount: string;
  interest_type: 'flat' | 'reducing_balance';
  default_interest_rate: string;
  min_term_months: string;
  max_term_months: string;
  grace_period_days: string;
  penalty_rate: string;
  late_fee: string;
  requires_collateral: boolean;
}

const EMPTY_PRODUCT: ProductForm = {
  name: '',
  code: '',
  description: '',
  min_amount: '1000',
  max_amount: '',
  interest_type: 'flat',
  default_interest_rate: '12',
  min_term_months: '1',
  max_term_months: '24',
  grace_period_days: '0',
  penalty_rate: '0',
  late_fee: '0',
  requires_collateral: false,
};

interface ApplicationForm {
  customer_id: string;
  product_id: string;
  requested_amount: string;
  term_months: string;
  purpose: string;
  monthly_income: string;
  employment_status: string;
  guarantor_name: string;
  guarantor_phone: string;
  collateral_description: string;
  collateral_value: string;
}

const EMPTY_APPLICATION: ApplicationForm = {
  customer_id: '',
  product_id: '',
  requested_amount: '',
  term_months: '12',
  purpose: '',
  monthly_income: '',
  employment_status: '',
  guarantor_name: '',
  guarantor_phone: '',
  collateral_description: '',
  collateral_value: '',
};

function customerLabel(c: Customer | undefined | null): string {
  if (!c) return 'Unknown customer';
  if (c.customer_type !== 'individual') return c.business_name || 'Unnamed business';
  return `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unnamed';
}

interface LoansPageProps {
  tab?: 'products' | 'applications' | 'active' | 'repayments';
}

export function LoansPage({ tab = 'products' }: LoansPageProps) {
  const { tenant, branch, admin } = useAuth();
  const [activeTab, setActiveTab] = useState(tab);
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [loans, setLoans] = useState<LoanAccount[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // The page previously had these two modals but no state behind them and no
  // submit handlers: the buttons opened shells that could never save. Nor was
  // there any way to approve an application or disburse an approved one, which
  // is why loan_accounts stays empty even where applications exist.
  const [productForm, setProductForm] = useState<ProductForm>(EMPTY_PRODUCT);
  const [productError, setProductError] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<LoanProduct | null>(null);

  const [applicationForm, setApplicationForm] = useState<ApplicationForm>(EMPTY_APPLICATION);
  const [applicationError, setApplicationError] = useState<string | null>(null);

  // Review: approve or reject a submitted application.
  const [reviewApp, setReviewApp] = useState<LoanApplication | null>(null);
  const [reviewAmount, setReviewAmount] = useState('');
  const [reviewReason, setReviewReason] = useState('');
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // Disbursement: the moment an approved application becomes a real loan.
  const [disburseApp, setDisburseApp] = useState<LoanApplication | null>(null);
  const [disburseFloatId, setDisburseFloatId] = useState('');
  const [disburseFirstDate, setDisburseFirstDate] = useState('');
  const [disburseError, setDisburseError] = useState<string | null>(null);
  const [disburseSubmitting, setDisburseSubmitting] = useState(false);
  const [floatAccounts, setFloatAccounts] = useState<FloatAccount[]>([]);

  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  useEffect(() => {
    if (tenant) {
      loadData();
    }
  }, [tenant, branch]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [productsRes, appsRes, loansRes, customersRes] = await Promise.all([
        supabase.from('loan_products').select('*').eq('tenant_id', tenant!.id),
        supabase.from('loan_applications').select('*, customer:customers(*), product:loan_products(*)').eq('tenant_id', tenant!.id).order('created_at', { ascending: false }),
        supabase.from('loan_accounts').select('*, customer:customers(*), product:loan_products(*)').eq('tenant_id', tenant!.id),
        supabase.from('customers').select('*').eq('tenant_id', tenant!.id).eq('status', 'active'),
      ]);

      // Tills the cash can be paid out of at disbursement.
      const floatsRes = await supabase
        .from('float_accounts')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .eq('status', 'active');
      setFloatAccounts((floatsRes.data ?? []) as unknown as FloatAccount[]);

      if (productsRes.data) setProducts(productsRes.data as LoanProduct[]);
      if (appsRes.data) setApplications(appsRes.data as LoanApplication[]);
      if (loansRes.data) setLoans(loansRes.data as LoanAccount[]);
      if (customersRes.data) setCustomers(customersRes.data as Customer[]);
    } catch (err) {
      console.error('Error loading loans data:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load loans data');
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================================
  // Loan products
  // ==========================================================================

  const openProductForm = (product?: LoanProduct) => {
    if (product) {
      setEditingProduct(product);
      setProductForm({
        name: product.name,
        code: product.code,
        description: product.description ?? '',
        min_amount: String(product.min_amount ?? 0),
        max_amount: product.max_amount != null ? String(product.max_amount) : '',
        interest_type: (product.interest_type as 'flat' | 'reducing_balance') ?? 'flat',
        default_interest_rate: String(product.default_interest_rate ?? 0),
        min_term_months: String(product.min_term_months ?? 1),
        max_term_months: product.max_term_months != null ? String(product.max_term_months) : '',
        grace_period_days: String(product.grace_period_days ?? 0),
        penalty_rate: String(product.penalty_rate ?? 0),
        late_fee: String(product.late_fee ?? 0),
        requires_collateral: !!product.requires_collateral,
      });
    } else {
      setEditingProduct(null);
      setProductForm(EMPTY_PRODUCT);
    }
    setProductError(null);
    setShowProductForm(true);
  };

  const closeProductForm = () => {
    setShowProductForm(false);
    setEditingProduct(null);
    setProductForm(EMPTY_PRODUCT);
    setProductError(null);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setProductError(null);

    if (!tenant) {
      setProductError('No institution context. Please sign in again.');
      return;
    }
    if (!productForm.name.trim()) {
      setProductError('Product name is required.');
      return;
    }
    if (!productForm.code.trim()) {
      setProductError('Product code is required.');
      return;
    }
    const rate = parseFloat(productForm.default_interest_rate);
    if (Number.isNaN(rate) || rate < 0) {
      setProductError('Enter a valid interest rate.');
      return;
    }
    const minAmt = parseFloat(productForm.min_amount) || 0;
    const maxAmt = productForm.max_amount ? parseFloat(productForm.max_amount) : null;
    if (maxAmt !== null && maxAmt < minAmt) {
      setProductError('Maximum amount cannot be less than the minimum.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: productForm.name.trim(),
        code: productForm.code.trim().toUpperCase(),
        description: productForm.description.trim() || null,
        min_amount: minAmt,
        max_amount: maxAmt,
        interest_type: productForm.interest_type,
        default_interest_rate: rate,
        min_interest_rate: rate,
        min_term_months: parseInt(productForm.min_term_months, 10) || 1,
        max_term_months: productForm.max_term_months
          ? parseInt(productForm.max_term_months, 10)
          : null,
        grace_period_days: parseInt(productForm.grace_period_days, 10) || 0,
        penalty_rate: parseFloat(productForm.penalty_rate) || 0,
        late_fee: parseFloat(productForm.late_fee) || 0,
        requires_collateral: productForm.requires_collateral,
        status: 'active' as const,
      };

      if (editingProduct) {
        const { error } = await supabase
          .from('loan_products')
          .update(payload)
          .eq('id', editingProduct.id)
          .eq('tenant_id', tenant.id);
        if (error) throw error;
      } else {
        const insert: InsertTables<'loan_products'> = { tenant_id: tenant.id, ...payload };
        const { error } = await supabase.from('loan_products').insert(insert);
        if (error) {
          // A duplicate code is the likeliest failure and deserves a clearer
          // message than the raw constraint name.
          if ((error as { code?: string }).code === '23505') {
            throw new Error(`A product with code ${payload.code} already exists.`);
          }
          throw error;
        }
      }

      await loadData();
      closeProductForm();
    } catch (err) {
      console.error('Error saving loan product:', err);
      setProductError(err instanceof Error ? err.message : 'Failed to save product');
    } finally {
      setSubmitting(false);
    }
  };

  // ==========================================================================
  // Applications
  // ==========================================================================

  const openApplicationForm = () => {
    setApplicationForm(EMPTY_APPLICATION);
    setApplicationError(null);
    setShowApplicationForm(true);
  };

  const closeApplicationForm = () => {
    setShowApplicationForm(false);
    setApplicationForm(EMPTY_APPLICATION);
    setApplicationError(null);
  };

  const selectedProduct = products.find((p) => p.id === applicationForm.product_id);

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    setApplicationError(null);

    if (!tenant || !admin) {
      setApplicationError('No institution context. Please sign in again.');
      return;
    }
    if (!applicationForm.customer_id) {
      setApplicationError('Choose a customer.');
      return;
    }
    if (!applicationForm.product_id) {
      setApplicationError('Choose a loan product.');
      return;
    }
    const amount = parseFloat(applicationForm.requested_amount);
    if (!applicationForm.requested_amount || Number.isNaN(amount) || amount <= 0) {
      setApplicationError('Enter a valid amount.');
      return;
    }
    const term = parseInt(applicationForm.term_months, 10);
    if (Number.isNaN(term) || term < 1) {
      setApplicationError('Enter a valid term in months.');
      return;
    }

    // Checked against the product's own limits so an application is not taken
    // that could never be approved.
    if (selectedProduct) {
      if (amount < Number(selectedProduct.min_amount ?? 0)) {
        setApplicationError(
          `${selectedProduct.name} has a minimum of ${Number(selectedProduct.min_amount).toLocaleString()}.`
        );
        return;
      }
      if (selectedProduct.max_amount != null && amount > Number(selectedProduct.max_amount)) {
        setApplicationError(
          `${selectedProduct.name} has a maximum of ${Number(selectedProduct.max_amount).toLocaleString()}.`
        );
        return;
      }
      if (term < Number(selectedProduct.min_term_months ?? 1)) {
        setApplicationError(`Minimum term for this product is ${selectedProduct.min_term_months} months.`);
        return;
      }
      if (selectedProduct.max_term_months != null && term > Number(selectedProduct.max_term_months)) {
        setApplicationError(`Maximum term for this product is ${selectedProduct.max_term_months} months.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const insert: InsertTables<'loan_applications'> = {
        tenant_id: tenant.id,
        branch_id: branch?.id ?? null,
        customer_id: applicationForm.customer_id,
        product_id: applicationForm.product_id,
        requested_amount: amount,
        currency:
          (tenant.settings as { default_currency?: string } | null)?.default_currency ?? 'KES',
        term_months: term,
        purpose: applicationForm.purpose.trim() || null,
        monthly_income: applicationForm.monthly_income
          ? parseFloat(applicationForm.monthly_income)
          : null,
        employment_status: applicationForm.employment_status.trim() || null,
        guarantor_name: applicationForm.guarantor_name.trim() || null,
        guarantor_phone: applicationForm.guarantor_phone.trim() || null,
        collateral_description: applicationForm.collateral_description.trim() || null,
        collateral_value: applicationForm.collateral_value
          ? parseFloat(applicationForm.collateral_value)
          : null,
        status: 'submitted',
        created_by: admin.id,
      };

      const { error } = await supabase.from('loan_applications').insert(insert);
      if (error) throw error;

      await loadData();
      closeApplicationForm();
    } catch (err) {
      console.error('Error submitting application:', err);
      setApplicationError(err instanceof Error ? err.message : 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  // ==========================================================================
  // Review: approve or reject
  // ==========================================================================

  const openReview = (app: LoanApplication) => {
    setReviewApp(app);
    // Default the approved amount to what was requested; a reviewer can lend
    // less, which is common, but should have to change it deliberately.
    setReviewAmount(String(app.requested_amount ?? ''));
    setReviewReason('');
    setReviewError(null);
  };

  const closeReview = () => {
    setReviewApp(null);
    setReviewAmount('');
    setReviewReason('');
    setReviewError(null);
  };

  const handleApprove = async () => {
    if (!reviewApp || !tenant || !admin) return;
    const amount = parseFloat(reviewAmount);
    if (!reviewAmount || Number.isNaN(amount) || amount <= 0) {
      setReviewError('Enter the amount being approved.');
      return;
    }
    if (amount > Number(reviewApp.requested_amount)) {
      setReviewError('Approved amount cannot exceed what was requested.');
      return;
    }

    setReviewSubmitting(true);
    setReviewError(null);
    try {
      const { error } = await supabase
        .from('loan_applications')
        .update({
          status: 'approved',
          approved_amount: amount,
          approved_by: admin.id,
          approved_at: new Date().toISOString(),
          reviewed_by: admin.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', reviewApp.id)
        .eq('tenant_id', tenant.id);
      if (error) throw error;

      await loadData();
      closeReview();
    } catch (err) {
      console.error('Error approving application:', err);
      setReviewError(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!reviewApp || !tenant || !admin) return;
    // A rejection without a reason is not reviewable later, and the customer
    // is owed an explanation.
    if (!reviewReason.trim()) {
      setReviewError('Give a reason for the rejection.');
      return;
    }

    setReviewSubmitting(true);
    setReviewError(null);
    try {
      const { error } = await supabase
        .from('loan_applications')
        .update({
          status: 'rejected',
          rejection_reason: reviewReason.trim(),
          reviewed_by: admin.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', reviewApp.id)
        .eq('tenant_id', tenant.id);
      if (error) throw error;

      await loadData();
      closeReview();
    } catch (err) {
      console.error('Error rejecting application:', err);
      setReviewError(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setReviewSubmitting(false);
    }
  };

  // ==========================================================================
  // Disbursement
  // ==========================================================================

  const openDisburse = (app: LoanApplication) => {
    setDisburseApp(app);
    setDisburseFloatId('');
    // Default the first repayment to a month out, which is the usual term.
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    setDisburseFirstDate(d.toISOString().slice(0, 10));
    setDisburseError(null);
  };

  const closeDisburse = () => {
    setDisburseApp(null);
    setDisburseFloatId('');
    setDisburseFirstDate('');
    setDisburseError(null);
  };

  const handleDisburse = async () => {
    if (!disburseApp || !tenant) return;

    setDisburseSubmitting(true);
    setDisburseError(null);
    try {
      // One transaction creates the loan account, generates the full
      // repayment schedule, debits the till and writes the ledger entry.
      // Doing these separately would allow a loan account with no schedule,
      // which could never be repaid, or cash leaving with no loan recorded.
      const { data: result, error } = await supabase.rpc('loan_disburse', {
        p_application_id: disburseApp.id,
        p_float_account_id: disburseFloatId || null,
        p_first_payment_date: disburseFirstDate || null,
        p_notes: null,
      } as never);
      if (error) throw error;

      const row = (Array.isArray(result) ? result[0] : result) as
        | {
            loan_account_id?: string;
            loan_number?: string;
            transaction_id?: string;
            installments?: number;
            total_repayable?: number;
            new_float_balance?: number | null;
          }
        | null;

      if (row?.transaction_id) {
        const customer = customers.find((c) => c.id === disburseApp.customer_id);
        const currency =
          disburseApp.currency ??
          (tenant.settings as { default_currency?: string } | null)?.default_currency ??
          'KES';
        setReceiptData(
          buildReceiptData({
            institutionName: tenant.name,
            institutionLogoUrl:
              (tenant.settings as { branding?: { logo_url?: string | null } } | null)?.branding
                ?.logo_url ?? null,
            branchName: branch?.name ?? null,
            transactionId: row.transaction_id,
            reference: row.loan_number ?? row.transaction_id.slice(0, 8).toUpperCase(),
            transactionType: 'loan_disbursement',
            status: 'completed',
            createdAtIso: new Date().toISOString(),
            customerName: customerLabel(customer),
            customerAccountNumber: row.loan_number ?? null,
            amount: Number(disburseApp.approved_amount ?? disburseApp.requested_amount),
            currency,
            remainingFloatBalance: row.new_float_balance ?? null,
            remainingFloatCurrency: currency,
            cashierName: admin?.full_name ?? null,
          })
        );
      }

      await loadData();
      closeDisburse();
    } catch (err) {
      console.error('Error disbursing loan:', err);
      setDisburseError(err instanceof Error ? err.message : 'Failed to disburse loan');
    } finally {
      setDisburseSubmitting(false);
    }
  };

  const tabs = [
    { id: 'products', label: 'Loan Products', icon: <Banknote className="w-4 h-4" /> },
    { id: 'applications', label: 'Applications', icon: <FileText className="w-4 h-4" /> },
    { id: 'active', label: 'Active Loans', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'repayments', label: 'Repayments', icon: <DollarSign className="w-4 h-4" /> },
  ];

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string }> = {
      active: { bg: 'bg-green-100', text: 'text-green-700' },
      pending: { bg: 'bg-amber-100', text: 'text-amber-700' },
      approved: { bg: 'bg-blue-100', text: 'text-blue-700' },
      rejected: { bg: 'bg-red-100', text: 'text-red-700' },
      completed: { bg: 'bg-slate-100', text: 'text-slate-700' },
      draft: { bg: 'bg-slate-100', text: 'text-slate-500' },
    };
    const style = styles[status] || styles.pending;
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#641f60]">Loans Management</h1>
          <p className="text-slate-600 mt-1">Manage loan products, applications, and repayments</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => openProductForm()}
            className="px-4 py-2 border border-[#1ebcb2] text-[#1ebcb2] rounded-lg hover:bg-[#1ebcb2]/10 transition-all"
          >
            <Plus className="w-4 h-4 inline mr-2" />
            Product
          </button>
          <button
            onClick={openApplicationForm}
            className="px-4 py-2.5 bg-gradient-to-r from-[#ee7b22] to-[#c46040] text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all"
          >
            <Plus className="w-5 h-5 inline mr-2" />
            New Application
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-[#dae1e1] p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[#ee7b22]/10">
              <Banknote className="w-6 h-6 text-[#ee7b22]" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Products</p>
              <p className="text-2xl font-bold text-slate-900">{products.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[#dae1e1] p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[#1ebcb2]/10">
              <Clock className="w-6 h-6 text-[#1ebcb2]" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Pending</p>
              <p className="text-2xl font-bold text-slate-900">{applications.filter((a) => a.status === 'submitted' || a.status === 'under_review').length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[#dae1e1] p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[#641f60]/10">
              <TrendingUp className="w-6 h-6 text-[#641f60]" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Active Loans</p>
              <p className="text-2xl font-bold text-slate-900">{loans.filter(l => l.status === 'active').length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[#dae1e1] p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-green-100">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Outstanding</p>
              <p className="text-2xl font-bold text-slate-900">
                {loans
                  .reduce(
                    (sum, l) =>
                      sum + Number((l as unknown as { total_outstanding?: number }).total_outstanding ?? 0),
                    0
                  )
                  .toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-[#dae1e1] p-2">
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-[#ee7b22] to-[#c46040] text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border border-[#dae1e1] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#1ebcb2]" />
          </div>
        ) : (
          <>
            {activeTab === 'products' && (
              <div className="divide-y divide-[#dae1e1]">
                {products.length > 0 ? products.map(product => (
                  <div key={product.id} className="p-6 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-slate-900">{product.name}</h3>
                        <p className="text-sm text-slate-500">{product.code}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-[#ee7b22]">{product.default_interest_rate}% p.a.</p>
                        <p className="text-sm text-slate-500">Up to ${product.max_amount?.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="py-12 text-center">
                    <Banknote className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">No loan products yet</p>
                    <button
                      onClick={() => openProductForm()}
                      className="mt-4 px-4 py-2 bg-[#ee7b22] text-white rounded-lg"
                    >
                      Create First Product
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'applications' && (
              <div className="divide-y divide-[#dae1e1]">
                {applications.length > 0 ? applications.map(app => (
                  <div key={app.id} className="p-6 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-[#1ebcb2]/10 flex items-center justify-center">
                          <FileText className="w-6 h-6 text-[#1ebcb2]" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900">
                            {(app as any).customer?.first_name} {(app as any).customer?.last_name}
                          </h3>
                          <p className="text-sm text-slate-500">{app.application_number}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {getStatusBadge(app.status)}
                        <div className="text-right">
                          {/* Was hardcoded to "$" regardless of the actual
                              currency, which would misstate every non-USD
                              institution's figures. */}
                          <p className="text-lg font-bold text-slate-900">
                            {app.currency ?? ''}{' '}
                            {Number(
                              app.approved_amount ?? app.requested_amount ?? 0
                            ).toLocaleString()}
                          </p>
                          <p className="text-sm text-slate-500">
                            {app.term_months} months
                            {app.approved_amount != null &&
                              Number(app.approved_amount) !== Number(app.requested_amount) &&
                              ` · ${Number(app.requested_amount).toLocaleString()} requested`}
                          </p>
                        </div>
                        {/* The lifecycle actions that did not exist: an
                            application could be created but never reviewed,
                            and an approved one could never pay out. */}
                        {(app.status === 'submitted' || app.status === 'under_review') && (
                          <button
                            onClick={() => openReview(app)}
                            className="px-3 py-1.5 bg-[#1ebcb2] hover:bg-[#159089] text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Review
                          </button>
                        )}
                        {app.status === 'approved' && (
                          <button
                            onClick={() => openDisburse(app)}
                            className="px-3 py-1.5 bg-[#ee7b22] hover:bg-[#c46040] text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                          >
                            <Banknote className="w-3.5 h-3.5" />
                            Disburse
                          </button>
                        )}
                        {app.status === 'rejected' && app.rejection_reason && (
                          <span
                            className="text-xs text-[#c46040] max-w-[160px] truncate"
                            title={app.rejection_reason}
                          >
                            {app.rejection_reason}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="py-12 text-center">
                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">No applications yet</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'active' && (
              <div className="divide-y divide-[#dae1e1]">
                {loans.filter(l => l.status === 'active').length > 0 ? loans.filter(l => l.status === 'active').map(loan => (
                  <div key={loan.id} className="p-6 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-[#641f60]/10 flex items-center justify-center">
                          <TrendingUp className="w-6 h-6 text-[#641f60]" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900">
                            {(loan as any).customer?.first_name} {(loan as any).customer?.last_name}
                          </h3>
                          <p className="text-sm text-slate-500">{loan.loan_number}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-lg font-bold text-[#ee7b22]">${loan.total_outstanding?.toLocaleString()}</p>
                          <p className="text-sm text-slate-500">Outstanding</p>
                        </div>
                        <button className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                          <Eye className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="py-12 text-center">
                    <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">No active loans</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'repayments' && (
              <div className="py-12 text-center">
                <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Repayment tracking coming soon</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Product Form Modal */}
      {showProductForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-[#dae1e1] flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-[#641f60]">
                {editingProduct ? 'Edit Loan Product' : 'Create Loan Product'}
              </h2>
              <button
                type="button"
                onClick={closeProductForm}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={productForm.name}
                    onChange={(e) => setProductForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]"
                    placeholder="e.g. Business Boost"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Code *</label>
                  <input
                    type="text"
                    required
                    value={productForm.code}
                    onChange={(e) => setProductForm((p) => ({ ...p, code: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] uppercase"
                    placeholder="BIZ01"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={productForm.description}
                  onChange={(e) => setProductForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Min Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={productForm.min_amount}
                    onChange={(e) => setProductForm((p) => ({ ...p, min_amount: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Max Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={productForm.max_amount}
                    onChange={(e) => setProductForm((p) => ({ ...p, max_amount: e.target.value }))}
                    placeholder="No limit"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]"
                  />
                </div>
              </div>

              {/* Flat and reducing balance produce genuinely different
                  schedules for the same headline rate, so this is a real
                  choice rather than a label. */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Interest Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['flat', 'reducing_balance'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setProductForm((p) => ({ ...p, interest_type: t }))}
                      className={`px-3 py-2.5 rounded-lg border text-sm transition-all ${
                        productForm.interest_type === t
                          ? 'border-[#1ebcb2] bg-[#1ebcb2]/10 text-[#641f60] font-medium'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {t === 'flat' ? 'Flat' : 'Reducing Balance'}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {productForm.interest_type === 'flat'
                    ? 'Interest is charged on the full principal for the whole term.'
                    : 'Interest is charged only on what is still owed, so it costs the customer less.'}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Rate (%) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    value={productForm.default_interest_rate}
                    onChange={(e) =>
                      setProductForm((p) => ({ ...p, default_interest_rate: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Min Term</label>
                  <input
                    type="number"
                    min="1"
                    value={productForm.min_term_months}
                    onChange={(e) =>
                      setProductForm((p) => ({ ...p, min_term_months: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Max Term</label>
                  <input
                    type="number"
                    min="1"
                    value={productForm.max_term_months}
                    onChange={(e) =>
                      setProductForm((p) => ({ ...p, max_term_months: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Grace (days)</label>
                  <input
                    type="number"
                    min="0"
                    value={productForm.grace_period_days}
                    onChange={(e) =>
                      setProductForm((p) => ({ ...p, grace_period_days: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Penalty (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={productForm.penalty_rate}
                    onChange={(e) => setProductForm((p) => ({ ...p, penalty_rate: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Late Fee</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={productForm.late_fee}
                    onChange={(e) => setProductForm((p) => ({ ...p, late_fee: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={productForm.requires_collateral}
                  onChange={(e) =>
                    setProductForm((p) => ({ ...p, requires_collateral: e.target.checked }))
                  }
                  className="w-4 h-4 accent-[#1ebcb2]"
                />
                <span className="text-sm text-slate-700">Requires collateral</span>
              </label>

              {productError && (
                <div className="p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {productError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeProductForm}
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-gradient-to-r from-[#ee7b22] to-[#c46040] text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Application Form Modal */}
      {showApplicationForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-[#dae1e1] flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-[#641f60]">New Loan Application</h2>
              <button
                type="button"
                onClick={closeApplicationForm}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitApplication} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Customer *</label>
                  <select
                    required
                    value={applicationForm.customer_id}
                    onChange={(e) =>
                      setApplicationForm((p) => ({ ...p, customer_id: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]"
                  >
                    <option value="">Select customer</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {customerLabel(c)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Product *</label>
                  <select
                    required
                    value={applicationForm.product_id}
                    onChange={(e) =>
                      setApplicationForm((p) => ({ ...p, product_id: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]"
                  >
                    <option value="">Select product</option>
                    {products
                      .filter((p) => p.status === 'active')
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.default_interest_rate}%)
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* The product's own limits, shown so an application is not
                  taken that could never be approved. */}
              {selectedProduct && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                  {selectedProduct.name}: {Number(selectedProduct.min_amount).toLocaleString()}
                  {selectedProduct.max_amount != null
                    ? ` to ${Number(selectedProduct.max_amount).toLocaleString()}`
                    : ' and above'}
                  {', '}
                  {selectedProduct.min_term_months}
                  {selectedProduct.max_term_months != null
                    ? `-${selectedProduct.max_term_months}`
                    : '+'}{' '}
                  months, {selectedProduct.default_interest_rate}%{' '}
                  {selectedProduct.interest_type === 'flat' ? 'flat' : 'reducing balance'}
                  {selectedProduct.requires_collateral && ' · collateral required'}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={applicationForm.requested_amount}
                    onChange={(e) =>
                      setApplicationForm((p) => ({ ...p, requested_amount: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Term (months) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={applicationForm.term_months}
                    onChange={(e) =>
                      setApplicationForm((p) => ({ ...p, term_months: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Purpose</label>
                <textarea
                  rows={2}
                  value={applicationForm.purpose}
                  onChange={(e) => setApplicationForm((p) => ({ ...p, purpose: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Monthly Income
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={applicationForm.monthly_income}
                    onChange={(e) =>
                      setApplicationForm((p) => ({ ...p, monthly_income: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Employment Status
                  </label>
                  <input
                    type="text"
                    value={applicationForm.employment_status}
                    onChange={(e) =>
                      setApplicationForm((p) => ({ ...p, employment_status: e.target.value }))
                    }
                    placeholder="e.g. Self-employed"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Guarantor</label>
                  <input
                    type="text"
                    value={applicationForm.guarantor_name}
                    onChange={(e) =>
                      setApplicationForm((p) => ({ ...p, guarantor_name: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Guarantor Phone
                  </label>
                  <input
                    type="tel"
                    value={applicationForm.guarantor_phone}
                    onChange={(e) =>
                      setApplicationForm((p) => ({ ...p, guarantor_phone: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]"
                  />
                </div>
              </div>

              {selectedProduct?.requires_collateral && (
                <div className="grid grid-cols-2 gap-4 p-3 bg-[#ee7b22]/5 border border-[#ee7b22]/20 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Collateral *
                    </label>
                    <input
                      type="text"
                      value={applicationForm.collateral_description}
                      onChange={(e) =>
                        setApplicationForm((p) => ({
                          ...p,
                          collateral_description: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Estimated Value
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={applicationForm.collateral_value}
                      onChange={(e) =>
                        setApplicationForm((p) => ({ ...p, collateral_value: e.target.value }))
                      }
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]"
                    />
                  </div>
                </div>
              )}

              {applicationError && (
                <div className="p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {applicationError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeApplicationForm}
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-gradient-to-r from-[#ee7b22] to-[#c46040] text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4" />}
                  Submit Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review: approve or reject */}
      {reviewApp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-[#dae1e1] flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#641f60]">Review Application</h2>
              <button
                type="button"
                onClick={closeReview}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <p className="font-medium text-slate-900">
                  {customerLabel(customers.find((c) => c.id === reviewApp.customer_id))}
                </p>
                <p className="text-sm text-slate-600">
                  Requested {Number(reviewApp.requested_amount).toLocaleString()} over{' '}
                  {reviewApp.term_months} months
                </p>
                {reviewApp.purpose && (
                  <p className="text-xs text-slate-500">Purpose: {reviewApp.purpose}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Approve amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={reviewAmount}
                  onChange={(e) => setReviewAmount(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Lending less than requested is common; it cannot exceed the request.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Rejection reason
                </label>
                <textarea
                  rows={2}
                  value={reviewReason}
                  onChange={(e) => setReviewReason(e.target.value)}
                  placeholder="Required only if rejecting"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]"
                />
              </div>

              {reviewError && (
                <div className="p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {reviewError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={reviewSubmitting}
                  className="flex-1 px-4 py-2.5 border border-[#c46040] text-[#c46040] hover:bg-[#c46040]/10 font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <ThumbsDown className="w-4 h-4" />
                  Reject
                </button>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={reviewSubmitting}
                  className="flex-1 px-4 py-2.5 bg-[#1ebcb2] hover:bg-[#159089] text-white font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {reviewSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ThumbsUp className="w-4 h-4" />
                  )}
                  Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Disbursement */}
      {disburseApp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-[#dae1e1] flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#641f60] flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                Disburse Loan
              </h2>
              <button
                type="button"
                onClick={closeDisburse}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="font-medium text-slate-900">
                  {customerLabel(customers.find((c) => c.id === disburseApp.customer_id))}
                </p>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200">
                  <span className="text-xs text-slate-500">Amount to disburse</span>
                  <span className="text-lg font-bold text-slate-900">
                    {Number(
                      disburseApp.approved_amount ?? disburseApp.requested_amount
                    ).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Over {disburseApp.term_months} months
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Pay out from which till?
                </label>
                <select
                  value={disburseFloatId}
                  onChange={(e) => setDisburseFloatId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]"
                >
                  <option value="">Not tied to a till</option>
                  {floatAccounts.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.float_type.replace(/_/g, ' ')} — {f.currency}{' '}
                      {Number(f.balance || 0).toLocaleString()}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1">
                  Choosing a till debits it in the same transaction. The branch cannot lend cash it
                  does not hold, so the disbursement is refused if the till is short.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  First repayment due
                </label>
                <input
                  type="date"
                  value={disburseFirstDate}
                  onChange={(e) => setDisburseFirstDate(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]"
                />
                <p className="text-xs text-slate-400 mt-1">
                  The full repayment schedule is generated from this date.
                </p>
              </div>

              {disburseError && (
                <div className="p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {disburseError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeDisburse}
                  className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDisburse}
                  disabled={disburseSubmitting}
                  className="flex-1 px-4 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {disburseSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Banknote className="w-4 h-4" />
                  )}
                  Disburse
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {receiptData && (
        <ReceiptModal data={receiptData} onClose={() => setReceiptData(null)} />
      )}
    </div>
  );
}