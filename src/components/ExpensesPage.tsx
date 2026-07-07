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

function PaymentLogo({ method, className = "h-5 w-auto object-contain" }: { method: ExpensePaymentMethod; className?: string }) {
  switch (method) {
    case 'mpesa':
      return (
        <svg viewBox="0 0 120 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="120" height="40" rx="6" fill="#4CAF50" fillOpacity="0.1"/>
          <text x="10" y="26" fontFamily="sans-serif" fontWeight="900" fontSize="20" fill="#4CAF50">M-</text>
          <text x="36" y="26" fontFamily="sans-serif" fontWeight="900" fontSize="20" fill="#E53935">Pesa</text>
        </svg>
      );
    case 'card':
      return (
        <svg viewBox="0 0 100 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="100" height="40" rx="6" fill="#1A1F71" fillOpacity="0.05"/>
          <circle cx="40" cy="20" r="12" fill="#EB001B" fillOpacity="0.8"/>
          <circle cx="56" cy="20" r="12" fill="#F79E1B" fillOpacity="0.8"/>
        </svg>
      );
    case 'bank_transfer':
      return (
        <svg viewBox="0 0 140 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="140" height="40" rx="6" fill="#0066cc" fillOpacity="0.08"/>
          <path d="M20 28H40V26H20V28ZM30 13L20 18V20H40V18L30 13ZM23 25H26V21H23V25ZM29 25H32V21H29V25ZM35 25H38V21H35V25Z" fill="#0066cc"/>
          <text x="46" y="24" fontFamily="sans-serif" fontWeight="700" fontSize="11" fill="#334155" letterSpacing="0.5">BANK LINK</text>
        </svg>
      );
    case 'cash':
      return (
        <svg viewBox="0 0 100 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="100" height="40" rx="6" fill="#10B981" fillOpacity="0.1"/>
          <rect x="20" y="12" width="60" height="16" rx="2" stroke="#10B981" strokeWidth="2" fill="none"/>
          <circle cx="50" cy="20" r="4" fill="#10B981"/>
        </svg>
      );
    case 'cheque':
      return (
        <svg viewBox="0 0 100 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="100" height="40" rx="6" fill="#0284C7" fillOpacity="0.1"/>
          <path d="M25 14H75V26H25V14ZM30 18V20H45V18H30ZM60 18V22H70V18H60Z" fill="#0284C7"/>
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 100 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="100" height="40" rx="6" fill="#64748B" fillOpacity="0.1"/>
          <circle cx="50" cy="20" r="6" fill="#64748B"/>
        </svg>
      );
  }
}

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
    <div className="space-y-6 px-2 sm:px-0 max-w-full overflow-x-hidden">
      {/* Responsive Header Card */}
      <div className="bg-gradient-to-r from-[#641f60] to-[#4a1646] rounded-2xl p-4 sm:p-6 text-white relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-[#1ebcb2]/20 blur-3xl" />
        <div className="absolute -bottom-16 -left-10 w-48 h-48 rounded-full bg-[#ee7b22]/10 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
                <Receipt className="w-4 h-4" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold">Expenses</h1>
            </div>
            <p className="text-white/70 text-xs sm:text-sm">
              Track, submit, and approve operational expenses
              {branch?.name && !seesAllBranches ? ` for ${branch.name}` : ''}.
            </p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium text-sm sm:text-base rounded-lg transition-colors shadow-lg shadow-black/10 flex-shrink-0 w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            Record Expense
          </button>
        </div>
      </div>

      {/* Grid Layout Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-[#641f60]/10">
              <Receipt className="w-5 h-5 text-[#641f60]" />
            </div>
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-100 text-slate-600">
              {STATUS_FILTERS.find((s) => s.value === statusFilter)?.label}
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">
            {formatMoney(totalVisible, defaultCurrency)}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {expenses.length} record{expenses.length === 1 ? '' : 's'} shown
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-[#1ebcb2]/10">
              <TrendingUp className="w-5 h-5 text-[#1ebcb2]" />
            </div>
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-[#1ebcb2]/10 text-[#1ebcb2]">
              confirmed
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">
            {formatMoney(approvedOrPaidTotal, defaultCurrency)}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">approved + paid</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-[#ee7b22]/10">
              <Clock className="w-5 h-5 text-[#ee7b22]" />
            </div>
            {pendingCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-[#ee7b22] animate-pulse" />
            )}
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900">{pendingCount}</h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">awaiting review</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-slate-100">
              <TrendingDown className="w-5 h-5 text-slate-500" />
            </div>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate">
            {seesAllBranches && branches.length > 1 ? 'All branches' : branch?.name || 'Current branch'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">scope</p>
        </div>
      </div>

      {/* Mini Bar Chart Stack */}
      {!loading && categoryBreakdown.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
          <h2 className="font-semibold text-sm sm:text-base text-slate-900 mb-4">Top Categories (Approved + Paid)</h2>
          <div className="space-y-3">
            {categoryBreakdown.map((c) => (
              <div key={c.name} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                <span className="text-xs sm:text-sm text-slate-600 w-full sm:w-36 truncate flex-shrink-0">{c.name}</span>
                <div className="flex-1 flex items-center gap-3 w-full">
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(c.pct, 4)}%`, backgroundColor: c.color }}
                    />
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-slate-900 w-20 text-right flex-shrink-0">
                    {formatMoneyCompact(c.total, defaultCurrency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-[#c46040]/10 border border-[#c46040]/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-[#c46040]/15 flex items-center justify-center flex-shrink-0 mx-auto sm:mx-0">
            <AlertCircle className="w-6 h-6 text-[#c46040]" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="font-semibold text-[#c46040]">Something went wrong</h3>
            <p className="text-sm text-slate-600">{error}</p>
          </div>
          <button
            onClick={loadData}
            className="w-full sm:w-auto px-4 py-2 bg-[#ee7b22] hover:bg-[#c46040] text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {/* Scrawlable Horizontal Chips Container */}
      <div className="w-full overflow-x-auto pb-2 -mx-2 px-2 scrollbar-none flex items-center gap-2">
        <Filter className="w-4 h-4 text-slate-400 flex-shrink-0 hidden sm:block" />
        {STATUS_FILTERS.map((f) => {
          const count =
            f.value === 'all'
              ? expenses.length
              : expenses.filter((e) => e.status === f.value).length;
          return (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                statusFilter === f.value
                  ? 'bg-[#641f60] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusFilter === f.value ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'}`}>
                {f.value === 'all' ? expenses.length : count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Responsive Layout Wrapper */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="p-4 flex items-center gap-4 animate-pulse">
                <div className="w-10 h-10 rounded-lg bg-slate-200 flex-shrink-0" />
                <div className="flex-1">
                  <div className="h-4 w-40 bg-slate-200 rounded mb-2" />
                  <div className="h-3 w-24 bg-slate-100 rounded" />
                </div>
                <div className="h-4 w-20 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        ) : expenses.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#641f60]/10 to-[#1ebcb2]/10 flex items-center justify-center mx-auto mb-4">
              <Receipt className="w-8 h-8 text-[#641f60]/40" />
            </div>
            <p className="text-slate-700 font-semibold text-sm sm:text-base">No expenses found</p>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xs mx-auto">
              {statusFilter === 'all'
                ? 'Record your first expense to start tracking spend across the institution.'
                : `No expenses with status "${statusFilter}" right now.`}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Presentation View */}
            <div className="hidden md:block overflow-x-auto w-full">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
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
                            <div className={`w-9 h-9 rounded-lg ${catStyle.bg} ${catStyle.color} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                              {catStyle.icon}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 truncate max-w-[200px]" title={exp.description}>{exp.description}</p>
                              {exp.vendor_name && <p className="text-xs text-slate-500 mt-0.5">{exp.vendor_name}</p>}
                              {exp.branchName && seesAllBranches && <p className="text-xs text-slate-400 mt-0.5">{exp.branchName}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-slate-600 whitespace-nowrap">{exp.categoryName}</td>
                        <td className="px-5 py-4 text-slate-600 whitespace-nowrap">
                          {new Date(exp.expense_date).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-5 py-4 text-slate-600 whitespace-nowrap">
                          <div className="flex items-center">
                            <PaymentLogo method={exp.payment_method} className="h-6 w-auto" />
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right font-semibold text-slate-900 whitespace-nowrap">
                          {formatMoney(exp.amount, exp.currency)}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium capitalize ring-1 ring-inset ${badge.bg} ${badge.text} ${badge.ring}`}>
                            {badge.icon}
                            {exp.status}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                            {exp.status === 'pending' && canApprove && (
                              <>
                                <button
                                  onClick={() => handleApprove(exp.id)}
                                  disabled={isActioning}
                                  className="p-1.5 rounded-lg text-[#1ebcb2] hover:bg-[#1ebcb2]/10 transition-colors"
                                  title="Approve"
                                >
                                  {isActioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                </button>
                                <button
                                  onClick={() => setRejectingId(exp.id)}
                                  disabled={isActioning}
                                  className="p-1.5 rounded-lg text-[#c46040] hover:bg-[#c46040]/10 transition-colors"
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
                                className="px-2.5 py-1 rounded-lg text-xs font-medium text-[#641f60] bg-[#641f60]/5 hover:bg-[#641f60]/10 transition-colors"
                              >
                                Mark Paid
                              </button>
                            )}
                            {canApprove && (
                              <button
                                onClick={() => handleDelete(exp.id)}
                                disabled={isActioning}
                                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
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

            {/* Optimized High-Performance Mobile View */}
            <div className="block md:hidden divide-y divide-slate-100">
              {expenses.map((exp) => {
                const badge = statusBadge(exp.status);
                const catStyle = categoryStyle(exp.categoryName);
                const isActioning = actioningId === exp.id;
                return (
                  <div key={exp.id} className="p-4 space-y-3 bg-white">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <div className={`w-9 h-9 rounded-lg ${catStyle.bg} ${catStyle.color} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                          {catStyle.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-900 text-sm break-words leading-snug">{exp.description}</p>
                          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-500 mt-1">
                            <span className="font-medium text-slate-600 truncate max-w-[80px]">{exp.categoryName}</span>
                            <span>•</span>
                            <span className="whitespace-nowrap">{new Date(exp.expense_date).toLocaleDateString()}</span>
                            {exp.branchName && seesAllBranches && (
                              <>
                                <span>•</span>
                                <span className="text-slate-400 truncate max-w-[70px]">{exp.branchName}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 flex flex-col items-end">
                        <p className="font-bold text-slate-900 text-sm">{formatMoney(exp.amount, exp.currency)}</p>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium capitalize mt-1.5 ring-1 ring-inset ${badge.bg} ${badge.text} ${badge.ring}`}>
                          {badge.icon}
                          {exp.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-50 gap-2">
                      <div className="flex items-center min-w-0">
                        <span className="text-[11px] text-slate-400 mr-1.5">Via:</span>
                        <PaymentLogo method={exp.payment_method} className="h-5 w-auto max-w-[70px]" />
                      </div>
                      
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {exp.status === 'pending' && canApprove && (
                          <>
                            <button
                              onClick={() => handleApprove(exp.id)}
                              disabled={isActioning}
                              className="p-1.5 rounded-md text-[#1ebcb2] bg-[#1ebcb2]/5 active:bg-[#1ebcb2]/10"
                            >
                              {isActioning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => setRejectingId(exp.id)}
                              disabled={isActioning}
                              className="p-1.5 rounded-md text-[#c46040] bg-[#c46040]/5 active:bg-[#c46040]/10"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {exp.status === 'approved' && canApprove && (
                          <button
                            onClick={() => handleMarkPaid(exp.id)}
                            disabled={isActioning}
                            className="px-2.5 py-1 rounded-md text-[11px] font-semibold text-[#641f60] bg-[#641f60]/5 active:bg-[#641f60]/10"
                          >
                            Mark Paid
                          </button>
                        )}
                        {canApprove && (
                          <button
                            onClick={() => handleDelete(exp.id)}
                            disabled={isActioning}
                            className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 active:bg-slate-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Reject Reason Modal Popup */}
      {rejectingId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 sm:p-6">
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
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1ebcb2]"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => {
                  setRejectingId(null);
                  setRejectReason('');
                }}
                className="flex-1 py-2.5 text-sm rounded-lg border border-slate-300 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(rejectingId)}
                disabled={actioningId === rejectingId}
                className="flex-1 py-2.5 text-sm rounded-lg bg-[#c46040] hover:bg-[#c46040]/90 text-white font-medium flex items-center justify-center gap-2"
              >
                {actioningId === rejectingId && <Loader2 className="w-4 h-4 animate-spin" />}
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Expense Form Modal Component Sheet */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] sm:max-h-[85vh] overflow-y-auto my-0">
            <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-200 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#641f60]/10 flex items-center justify-center">
                  <Receipt className="w-4.5 h-4.5 text-[#641f60]" />
                </div>
                <h3 className="font-semibold text-slate-900 text-base sm:text-lg">Record Expense</h3>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Description *</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Office internet bill - June"
                  disabled={submitting}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Amount ({defaultCurrency}) *</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    disabled={submitting}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1ebcb2]"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Date *</label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    disabled={submitting}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1ebcb2]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-2">Category</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {categories.map((c) => {
                    const style = categoryStyle(c.name);
                    const selected = categoryId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCategoryId(selected ? '' : c.id)}
                        disabled={submitting}
                        className={`flex flex-col items-center gap-1.5 py-2 px-1.5 rounded-lg border text-center transition-all ${
                          selected ? 'border-[#1ebcb2] bg-[#1ebcb2]/10' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-md ${style.bg} ${style.color} flex items-center justify-center`}>
                          {style.icon}
                        </div>
                        <span className="text-[10px] sm:text-[11px] font-medium text-slate-600 leading-tight truncate w-full px-1">
                          {c.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-2">Payment Method</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PAYMENT_METHODS.map((m) => {
                    const selected = paymentMethod === m.value;
                    return (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setPaymentMethod(m.value)}
                        disabled={submitting}
                        className={`flex flex-col items-center justify-center gap-1 py-1.5 px-2 rounded-lg border transition-all ${
                          selected ? 'border-[#1ebcb2] bg-[#1ebcb2]/5 ring-1 ring-[#1ebcb2]' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <PaymentLogo method={m.value} className="h-5 sm:h-6 w-auto" />
                        <span className="text-[10px] sm:text-[11px] font-medium text-slate-500 mt-0.5">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Vendor / Payee</label>
                  <input
                    type="text"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    placeholder="e.g. Safaricom Ltd"
                    disabled={submitting}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1ebcb2]"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Reference No.</label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="Receipt / invoice #"
                    disabled={submitting}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1ebcb2]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Optional additional context"
                  disabled={submitting}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1ebcb2]"
                />
              </div>

              {formError && (
                <div className="p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-xs sm:text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {formError}
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  disabled={submitting}
                  className="w-full sm:flex-1 py-2.5 text-sm rounded-lg border border-slate-300 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:flex-1 py-2.5 text-sm rounded-lg bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium flex items-center justify-center gap-2"
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