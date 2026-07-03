import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  ensureDefaultExpenseCategories,
  fetchExpenseCategories,
  fetchExpenses,
  createExpense,
  approveExpense,
  rejectExpense,
  markExpensePaid,
  deleteExpense,
  type ExpenseCategory,
  type ExpenseRow,
  type ExpenseStatus,
  type ExpensePaymentMethod,
} from '../lib/expenses';
import {
  Plus,
  X,
  Loader2,
  Receipt,
  CheckCircle2,
  XCircle,
  Clock,
  Banknote,
  AlertCircle,
  RefreshCw,
  Trash2,
  Filter,
  Home,
  Zap,
  Users as UsersIcon,
  Package,
  Megaphone,
  Car,
  Laptop,
  Landmark,
  MoreHorizontal,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Smartphone,
  Wallet as WalletIcon,
  FileCheck,
} from 'lucide-react';

const PAYMENT_METHODS: { value: ExpensePaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'mpesa', label: 'M-Pesa' },
  { value: 'card', label: 'Card' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
];

const STATUS_FILTERS: { value: ExpenseStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'paid', label: 'Paid' },
  { value: 'rejected', label: 'Rejected' },
];

function formatMoney(value: number, currency = 'KES'): string {
  const symbol = currency === 'USD' ? '$' : currency === 'KES' ? 'KSh ' : `${currency} `;
  return `${symbol}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatMoneyCompact(value: number, currency = 'KES'): string {
  const symbol = currency === 'USD' ? '$' : currency === 'KES' ? 'KSh ' : `${currency} `;
  if (value >= 1_000_000) return `${symbol}${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${symbol}${(value / 1_000).toFixed(1)}K`;
  return `${symbol}${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function statusBadge(status: ExpenseStatus): {
  bg: string;
  text: string;
  ring: string;
  icon: React.ReactNode;
} {
  switch (status) {
    case 'approved':
      return {
        bg: 'bg-[#1ebcb2]/10',
        text: 'text-[#1ebcb2]',
        ring: 'ring-[#1ebcb2]/20',
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      };
    case 'paid':
      return {
        bg: 'bg-[#641f60]/10',
        text: 'text-[#641f60]',
        ring: 'ring-[#641f60]/20',
        icon: <Banknote className="w-3.5 h-3.5" />,
      };
    case 'rejected':
      return {
        bg: 'bg-[#c46040]/10',
        text: 'text-[#c46040]',
        ring: 'ring-[#c46040]/20',
        icon: <XCircle className="w-3.5 h-3.5" />,
      };
    default:
      return {
        bg: 'bg-[#ee7b22]/10',
        text: 'text-[#ee7b22]',
        ring: 'ring-[#ee7b22]/20',
        icon: <Clock className="w-3.5 h-3.5" />,
      };
  }
}

// Category name -> icon + accent color, purely presentational. Falls back
// to a generic icon for any category not in this list (custom categories
// the tenant created themselves), so nothing ever renders blank.
const CATEGORY_STYLE: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  Rent: { icon: <Home className="w-4 h-4" />, color: 'text-[#641f60]', bg: 'bg-[#641f60]/10' },
  Utilities: { icon: <Zap className="w-4 h-4" />, color: 'text-[#ee7b22]', bg: 'bg-[#ee7b22]/10' },
  'Salaries & Wages': {
    icon: <UsersIcon className="w-4 h-4" />,
    color: 'text-[#1ebcb2]',
    bg: 'bg-[#1ebcb2]/10',
  },
  'Office Supplies': {
    icon: <Package className="w-4 h-4" />,
    color: 'text-[#641f60]',
    bg: 'bg-[#641f60]/10',
  },
  Marketing: {
    icon: <Megaphone className="w-4 h-4" />,
    color: 'text-[#ee7b22]',
    bg: 'bg-[#ee7b22]/10',
  },
  Transport: { icon: <Car className="w-4 h-4" />, color: 'text-[#1ebcb2]', bg: 'bg-[#1ebcb2]/10' },
  'IT & Software': {
    icon: <Laptop className="w-4 h-4" />,
    color: 'text-[#641f60]',
    bg: 'bg-[#641f60]/10',
  },
  'Bank Charges': {
    icon: <Landmark className="w-4 h-4" />,
    color: 'text-[#ee7b22]',
    bg: 'bg-[#ee7b22]/10',
  },
  Other: {
    icon: <MoreHorizontal className="w-4 h-4" />,
    color: 'text-slate-500',
    bg: 'bg-slate-100',
  },
};
const DEFAULT_CATEGORY_STYLE = {
  icon: <Receipt className="w-4 h-4" />,
  color: 'text-slate-500',
  bg: 'bg-slate-100',
};

function categoryStyle(name: string | undefined) {
  if (!name) return DEFAULT_CATEGORY_STYLE;
  return CATEGORY_STYLE[name] ?? DEFAULT_CATEGORY_STYLE;
}

const PAYMENT_ICON: Record<ExpensePaymentMethod, React.ReactNode> = {
  cash: <Banknote className="w-3.5 h-3.5" />,
  bank_transfer: <Landmark className="w-3.5 h-3.5" />,
  mpesa: <Smartphone className="w-3.5 h-3.5" />,
  card: <CreditCard className="w-3.5 h-3.5" />,
  cheque: <FileCheck className="w-3.5 h-3.5" />,
  other: <WalletIcon className="w-3.5 h-3.5" />,
};

const CHART_PALETTE = ['#641f60', '#1ebcb2', '#ee7b22', '#9DB282', '#c46040', '#4a1646', '#263439'];

const CAN_APPROVE_ROLES = new Set([
  'super_admin',
  'institution_admin',
  'branch_manager',
  'finance_officer',
  'accountant',
]);

export function ExpensesPage() {
  const { tenant, admin, branch, branches } = useAuth();

  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | 'all'>('all');

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<ExpensePaymentMethod>('cash');
  const [vendorName, setVendorName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');

  const [actioningId, setActioningId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const defaultCurrency =
    (tenant?.settings as { default_currency?: string } | null)?.default_currency || 'KES';

  const seesAllBranches =
    admin?.role === 'super_admin' ||
    admin?.role === 'institution_admin' ||
    admin?.role === 'head_office_admin';

  const canApprove = admin?.role ? CAN_APPROVE_ROLES.has(admin.role) : false;

  const branchId = branch?.id ?? null;

  const loadData = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    setError(null);
    try {
      await ensureDefaultExpenseCategories(tenant.id);
      const [cats, exp] = await Promise.all([
        fetchExpenseCategories(tenant.id),
        fetchExpenses({
          tenantId: tenant.id,
          branchId: seesAllBranches ? null : branchId,
          status: statusFilter,
          limit: 100,
        }),
      ]);
      setCategories(cats);
      setExpenses(exp);
    } catch (err) {
      console.error('Error loading expenses:', err);
      setError(err instanceof Error ? err.message : 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, [tenant, branchId, seesAllBranches, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setCategoryId('');
    setExpenseDate(new Date().toISOString().slice(0, 10));
    setPaymentMethod('cash');
    setVendorName('');
    setReferenceNumber('');
    setNotes('');
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!tenant) {
      setFormError('No active institution session found.');
      return;
    }
    if (!description.trim()) {
      setFormError('Please enter a description.');
      return;
    }
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFormError('Please enter a valid amount greater than 0.');
      return;
    }
    if (!expenseDate) {
      setFormError('Please select a date.');
      return;
    }

    setSubmitting(true);
    try {
      await createExpense({
        tenantId: tenant.id,
        branchId: branch?.id ?? null,
        categoryId: categoryId || null,
        description: description.trim(),
        amount: parsedAmount,
        currency: defaultCurrency,
        expenseDate,
        paymentMethod,
        vendorName: vendorName.trim() || null,
        referenceNumber: referenceNumber.trim() || null,
        notes: notes.trim() || null,
        submittedBy: admin?.user_id ?? null,
      });
      resetForm();
      setShowForm(false);
      await loadData();
    } catch (err) {
      console.error('Error creating expense:', err);
      setFormError(err instanceof Error ? err.message : 'Failed to submit expense');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id: string) => {
    setActioningId(id);
    try {
      await approveExpense(id, admin?.user_id ?? null);
      await loadData();
    } catch (err) {
      console.error('Error approving expense:', err);
      setError(err instanceof Error ? err.message : 'Failed to approve expense');
    } finally {
      setActioningId(null);
    }
  };

  const handleReject = async (id: string) => {
    setActioningId(id);
    try {
      await rejectExpense(id, rejectReason);
      setRejectingId(null);
      setRejectReason('');
      await loadData();
    } catch (err) {
      console.error('Error rejecting expense:', err);
      setError(err instanceof Error ? err.message : 'Failed to reject expense');
    } finally {
      setActioningId(null);
    }
  };

  const handleMarkPaid = async (id: string) => {
    setActioningId(id);
    try {
      await markExpensePaid(id);
      await loadData();
    } catch (err) {
      console.error('Error marking expense paid:', err);
      setError(err instanceof Error ? err.message : 'Failed to update expense');
    } finally {
      setActioningId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this expense record? This cannot be undone.')) return;
    setActioningId(id);
    try {
      await deleteExpense(id);
      await loadData();
    } catch (err) {
      console.error('Error deleting expense:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete expense');
    } finally {
      setActioningId(null);
    }
  };

  const totalVisible = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const pendingCount = expenses.filter((e) => e.status === 'pending').length;
  const approvedOrPaidTotal = expenses
    .filter((e) => e.status === 'approved' || e.status === 'paid')
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  // Category breakdown for the mini bar chart - top 6 categories by spend,
  // computed only from approved/paid records so it reflects real spend
  // rather than pending guesses.
  const categoryBreakdown = useMemo(() => {
    const totals = new Map<string, number>();
    expenses
      .filter((e) => e.status === 'approved' || e.status === 'paid')
      .forEach((e) => {
        const key = e.categoryName || 'Uncategorized';
        totals.set(key, (totals.get(key) || 0) + Number(e.amount || 0));
      });
    const sorted = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const max = sorted.length > 0 ? sorted[0][1] : 0;
    return sorted.map(([name, total], idx) => ({
      name,
      total,
      pct: max > 0 ? (total / max) * 100 : 0,
      color: CHART_PALETTE[idx % CHART_PALETTE.length],
    }));
  }, [expenses]);

  return (
    <div className="space-y-6">
      {/* Header with gradient banner, matching the Dashboard welcome banner */}
      <div className="bg-gradient-to-r from-[#641f60] to-[#4a1646] rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-[#1ebcb2]/20 blur-3xl" />
        <div className="absolute -bottom-16 -left-10 w-48 h-48 rounded-full bg-[#ee7b22]/10 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
                <Receipt className="w-4 h-4" />
              </div>
              <h1 className="text-2xl font-bold">Expenses</h1>
            </div>
            <p className="text-white/70 text-sm">
              Track, submit, and approve operational expenses
              {branch?.name && !seesAllBranches ? ` for ${branch.name}` : ''}.
            </p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg transition-colors shadow-lg shadow-black/10 flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            Record Expense
          </button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-lg bg-[#641f60]/10">
              <Receipt className="w-5 h-5 text-[#641f60]" />
            </div>
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-100 text-slate-600">
              {STATUS_FILTERS.find((s) => s.value === statusFilter)?.label}
            </span>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 truncate">
            {formatMoney(totalVisible, defaultCurrency)}
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            {expenses.length} record{expenses.length === 1 ? '' : 's'} shown
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-lg bg-[#1ebcb2]/10">
              <TrendingUp className="w-5 h-5 text-[#1ebcb2]" />
            </div>
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-[#1ebcb2]/10 text-[#1ebcb2]">
              confirmed
            </span>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 truncate">
            {formatMoney(approvedOrPaidTotal, defaultCurrency)}
          </h3>
          <p className="text-sm text-slate-500 mt-1">approved + paid</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-lg bg-[#ee7b22]/10">
              <Clock className="w-5 h-5 text-[#ee7b22]" />
            </div>
            {pendingCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-[#ee7b22] animate-pulse" />
            )}
          </div>
          <h3 className="text-2xl font-bold text-slate-900">{pendingCount}</h3>
          <p className="text-sm text-slate-500 mt-1">awaiting review</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-lg bg-slate-100">
              <TrendingDown className="w-5 h-5 text-slate-500" />
            </div>
          </div>
          <h3 className="text-lg font-bold text-slate-900 truncate">
            {seesAllBranches && branches.length > 1 ? 'All branches' : branch?.name || 'Current branch'}
          </h3>
          <p className="text-sm text-slate-500 mt-1">scope</p>
        </div>
      </div>

      {/* Category breakdown mini chart */}
      {!loading && categoryBreakdown.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Top Categories (Approved + Paid)</h2>
          <div className="space-y-3">
            {categoryBreakdown.map((c) => (
              <div key={c.name} className="flex items-center gap-3">
                <span className="text-sm text-slate-600 w-36 truncate flex-shrink-0">{c.name}</span>
                <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(c.pct, 4)}%`, backgroundColor: c.color }}
                  />
                </div>
                <span className="text-sm font-semibold text-slate-900 w-20 text-right flex-shrink-0">
                  {formatMoneyCompact(c.total, defaultCurrency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-[#c46040]/10 border border-[#c46040]/30 rounded-xl p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-[#c46040]/15 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-6 h-6 text-[#c46040]" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-[#c46040]">Something went wrong</h3>
            <p className="text-sm text-slate-600">{error}</p>
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
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
        {STATUS_FILTERS.map((f) => {
          const count =
            f.value === 'all'
              ? expenses.length
              : expenses.filter((e) => e.status === f.value).length;
          return (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                statusFilter === f.value
                  ? 'bg-[#641f60] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
              {statusFilter === f.value && (
                <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">
                  {expenses.length}
                </span>
              )}
              {statusFilter !== f.value && count > 0 && (
                <span className="text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Table / card list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="px-5 py-4 flex items-center gap-4 animate-pulse">
                <div className="w-10 h-10 rounded-lg bg-slate-200 flex-shrink-0" />
                <div className="flex-1">
                  <div className="h-4 w-40 bg-slate-200 rounded mb-2" />
                  <div className="h-3 w-24 bg-slate-100 rounded" />
                </div>
                <div className="h-4 w-20 bg-slate-200 rounded" />
                <div className="h-6 w-20 bg-slate-100 rounded-full" />
              </div>
            ))}
          </div>
        ) : expenses.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#641f60]/10 to-[#1ebcb2]/10 flex items-center justify-center mx-auto mb-4">
              <Receipt className="w-8 h-8 text-[#641f60]/40" />
            </div>
            <p className="text-slate-700 font-semibold">No expenses found</p>
            <p className="text-sm text-slate-400 mt-1 max-w-xs mx-auto">
              {statusFilter === 'all'
                ? 'Record your first expense to start tracking spend across the institution.'
                : `No expenses with status "${statusFilter}" right now.`}
            </p>
            {statusFilter === 'all' && (
              <button
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                }}
                className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Record First Expense
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="px-5 py-3">Description</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Method</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.map((exp) => {
                  const badge = statusBadge(exp.status);
                  const catStyle = categoryStyle(exp.categoryName);
                  const isActioning = actioningId === exp.id;
                  return (
                    <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-9 h-9 rounded-lg ${catStyle.bg} ${catStyle.color} flex items-center justify-center flex-shrink-0 mt-0.5`}
                          >
                            {catStyle.icon}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900">{exp.description}</p>
                            {exp.vendor_name && (
                              <p className="text-xs text-slate-500 mt-0.5">{exp.vendor_name}</p>
                            )}
                            {exp.branchName && seesAllBranches && (
                              <p className="text-xs text-slate-400 mt-0.5">{exp.branchName}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{exp.categoryName}</td>
                      <td className="px-5 py-4 text-slate-600 whitespace-nowrap">
                        {new Date(exp.expense_date).toLocaleDateString(undefined, {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        <span className="inline-flex items-center gap-1.5 capitalize">
                          <span className="text-slate-400">{PAYMENT_ICON[exp.payment_method]}</span>
                          {exp.payment_method.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-slate-900 whitespace-nowrap">
                        {formatMoney(exp.amount, exp.currency)}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium capitalize ring-1 ring-inset ${badge.bg} ${badge.text} ${badge.ring}`}
                        >
                          {badge.icon}
                          {exp.status}
                        </span>
                        {exp.status === 'rejected' && exp.rejection_reason && (
                          <p className="text-xs text-[#c46040] mt-1 max-w-[160px]">
                            {exp.rejection_reason}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                          {exp.status === 'pending' && canApprove && (
                            <>
                              <button
                                onClick={() => handleApprove(exp.id)}
                                disabled={isActioning}
                                className="p-1.5 rounded-lg text-[#1ebcb2] hover:bg-[#1ebcb2]/10 transition-colors disabled:opacity-50"
                                aria-label="Approve"
                                title="Approve"
                              >
                                {isActioning ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-4 h-4" />
                                )}
                              </button>
                              <button
                                onClick={() => setRejectingId(exp.id)}
                                disabled={isActioning}
                                className="p-1.5 rounded-lg text-[#c46040] hover:bg-[#c46040]/10 transition-colors disabled:opacity-50"
                                aria-label="Reject"
                                title="Reject"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {exp.status === 'approved' && canApprove && (
                            <button
                              onClick={() => handleMarkPaid(exp.id)}
                              disabled={isActioning}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium text-[#641f60] bg-[#641f60]/5 hover:bg-[#641f60]/10 transition-colors disabled:opacity-50 whitespace-nowrap"
                            >
                              Mark Paid
                            </button>
                          )}
                          {canApprove && (
                            <button
                              onClick={() => handleDelete(exp.id)}
                              disabled={isActioning}
                              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors disabled:opacity-50"
                              aria-label="Delete"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject reason modal */}
      {rejectingId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#c46040]/10 flex items-center justify-center flex-shrink-0">
                <XCircle className="w-5 h-5 text-[#c46040]" />
              </div>
              <h3 className="font-semibold text-slate-900">Reject expense</h3>
            </div>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (optional)"
              rows={3}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => {
                  setRejectingId(null);
                  setRejectReason('');
                }}
                className="flex-1 py-2.5 rounded-lg border border-slate-300 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(rejectingId)}
                disabled={actioningId === rejectingId}
                className="flex-1 py-2.5 rounded-lg bg-[#c46040] hover:bg-[#c46040]/90 text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actioningId === rejectingId && <Loader2 className="w-4 h-4 animate-spin" />}
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create expense modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-[#641f60]/5 to-transparent rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#641f60]/10 flex items-center justify-center">
                  <Receipt className="w-4.5 h-4.5 text-[#641f60]" />
                </div>
                <h3 className="font-semibold text-slate-900 text-lg">Record Expense</h3>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Description *
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Office internet bill - June"
                  disabled={submitting}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent disabled:opacity-60"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Amount ({defaultCurrency}) *
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    disabled={submitting}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Date *</label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    disabled={submitting}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Category</label>
                <div className="grid grid-cols-3 gap-2">
                  {categories.map((c) => {
                    const style = categoryStyle(c.name);
                    const selected = categoryId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCategoryId(selected ? '' : c.id)}
                        disabled={submitting}
                        className={`flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-lg border text-center transition-all disabled:opacity-50 ${
                          selected
                            ? 'border-[#1ebcb2] bg-[#1ebcb2]/10'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-md ${style.bg} ${style.color} flex items-center justify-center`}>
                          {style.icon}
                        </div>
                        <span className="text-[11px] font-medium text-slate-600 leading-tight">
                          {c.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_METHODS.map((m) => {
                    const selected = paymentMethod === m.value;
                    return (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setPaymentMethod(m.value)}
                        disabled={submitting}
                        className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg border text-xs font-medium transition-all disabled:opacity-50 ${
                          selected
                            ? 'border-[#1ebcb2] bg-[#1ebcb2]/10 text-[#641f60]'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {PAYMENT_ICON[m.value]}
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Vendor / Payee
                  </label>
                  <input
                    type="text"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    placeholder="e.g. Safaricom Ltd"
                    disabled={submitting}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Reference No.
                  </label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="Receipt / invoice #"
                    disabled={submitting}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Optional additional context"
                  disabled={submitting}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent disabled:opacity-60"
                />
              </div>

              {formError && (
                <div className="p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {formError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-lg border border-slate-300 text-slate-600 font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-lg bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Submit Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}