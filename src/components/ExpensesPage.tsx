import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  ensureDefaultExpenseCategories,
  fetchExpenseCategories,
  fetchExpenses,
  createExpense,
  approveExpense,
  rejectExpense,
  markExpensePaid,
  fetchPayableFloatAccounts,
  type PayableFloatAccount,
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
  ChevronDown,
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

// ============================================================================
// Currency flags (shared visual language with the rest of the app) — real
// inline SVG flags rather than emoji, which render as plain text codes on
// Windows / some Android browsers.
// ============================================================================

const CURRENCIES = ['KES', 'USD', 'SSP', 'UGX', 'TZS', 'RWF', 'EUR', 'GBP'];

const CURRENCY_NAMES: Record<string, string> = {
  USD: 'US Dollar',
  KES: 'Kenyan Shilling',
  SSP: 'South Sudanese Pound',
  UGX: 'Ugandan Shilling',
  TZS: 'Tanzanian Shilling',
  RWF: 'Rwandan Franc',
  EUR: 'Euro',
  GBP: 'British Pound',
};

function FlagGraphic({ code }: { code: string }) {
  switch (code) {
    case 'USD':
      return (
        <>
          <rect width="40" height="40" fill="#b22234" />
          <rect y="3.08" width="40" height="3.08" fill="#fff" />
          <rect y="9.23" width="40" height="3.08" fill="#fff" />
          <rect y="15.38" width="40" height="3.08" fill="#fff" />
          <rect y="21.54" width="40" height="3.08" fill="#fff" />
          <rect y="27.69" width="40" height="3.08" fill="#fff" />
          <rect y="33.85" width="40" height="3.08" fill="#fff" />
          <rect width="18" height="21.54" fill="#3c3b6e" />
          <g fill="#fff">
            {[4, 10, 16].map((y) =>
              [3, 7, 11, 15].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1" />)
            )}
          </g>
        </>
      );
    case 'KES':
      return (
        <>
          <rect width="40" height="10" fill="#000" />
          <rect y="10" width="40" height="4" fill="#fff" />
          <rect y="14" width="40" height="12" fill="#bb0000" />
          <rect y="26" width="40" height="4" fill="#fff" />
          <rect y="30" width="40" height="10" fill="#006600" />
          <ellipse cx="20" cy="20" rx="4.5" ry="8" fill="#fff" />
          <ellipse cx="20" cy="20" rx="3" ry="6.5" fill="#bb0000" />
          <path d="M20 11 L21.5 20 L20 29 L18.5 20 Z" fill="#000" />
        </>
      );
    case 'SSP':
      return (
        <>
          <rect width="40" height="12" fill="#000" />
          <rect y="12" width="40" height="2" fill="#fff" />
          <rect y="14" width="40" height="12" fill="#bb0000" />
          <rect y="26" width="40" height="2" fill="#fff" />
          <rect y="28" width="40" height="12" fill="#009543" />
          <path d="M0 0 L20 20 L0 40 Z" fill="#0f47af" />
          <path d="M4 20 l5.5 -1.8 -3.4 4.7 0 -5.8 3.4 4.7 z" fill="#fcdd09" />
        </>
      );
    case 'UGX':
      return (
        <>
          <rect width="40" height="6.67" fill="#000" />
          <rect y="6.67" width="40" height="6.67" fill="#fcdc04" />
          <rect y="13.33" width="40" height="6.67" fill="#d90000" />
          <rect y="20" width="40" height="6.67" fill="#000" />
          <rect y="26.67" width="40" height="6.67" fill="#fcdc04" />
          <rect y="33.33" width="40" height="6.67" fill="#d90000" />
          <circle cx="20" cy="20" r="6" fill="#fff" />
          <circle cx="20" cy="20" r="5.4" fill="none" stroke="#000" strokeWidth="0.4" />
        </>
      );
    case 'TZS':
      return (
        <>
          <path d="M0 0 H40 V40 H0 Z" fill="#1eb53a" />
          <path d="M40 0 V40 H0 Z" fill="#00a3dd" />
          <path d="M0 40 L40 0 v6 L6 40 Z" fill="#fcd116" />
          <path d="M0 40 L40 0 h-6 L0 34 Z" fill="#fcd116" />
          <path d="M0 34 L34 0 h-34 Z M40 6 L6 40 h34 Z" fill="#000" />
        </>
      );
    case 'RWF':
      return (
        <>
          <rect width="40" height="40" fill="#20603d" />
          <rect width="40" height="26.67" fill="#00a1de" />
          <rect y="20" width="40" height="6.67" fill="#fad201" />
          <circle cx="31" cy="9" r="5" fill="#fad201" />
          {Array.from({ length: 24 }).map((_, i) => {
            const angle = (i * 15 * Math.PI) / 180;
            const x1 = 31 + 4 * Math.sin(angle);
            const y1 = 9 - 4 * Math.cos(angle);
            const x2 = 31 + 5 * Math.sin(angle);
            const y2 = 9 - 5 * Math.cos(angle);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e5be01" strokeWidth="0.6" />;
          })}
        </>
      );
    case 'EUR':
      return (
        <>
          <rect width="40" height="40" fill="#003399" />
          <g fill="#ffcc00">
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = (i * 30 * Math.PI) / 180;
              const cx = 20 + 11 * Math.sin(angle);
              const cy = 20 - 11 * Math.cos(angle);
              return <circle key={i} cx={cx} cy={cy} r="1.6" />;
            })}
          </g>
        </>
      );
    case 'GBP':
      return (
        <>
          <rect width="40" height="40" fill="#012169" />
          <path d="M0 0 L40 40 M40 0 L0 40" stroke="#fff" strokeWidth="6" />
          <path d="M0 0 L40 40 M40 0 L0 40" stroke="#c8102e" strokeWidth="3" />
          <path d="M20 0 V40 M0 20 H40" stroke="#fff" strokeWidth="10" />
          <path d="M20 0 V40 M0 20 H40" stroke="#c8102e" strokeWidth="6" />
        </>
      );
    default:
      return (
        <>
          <rect width="40" height="40" fill="#64748b" />
          <text
            x="20"
            y="21"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="14"
            fontWeight="700"
            fill="#fff"
            fontFamily="system-ui, sans-serif"
          >
            {code.slice(0, 2)}
          </text>
        </>
      );
  }
}

function CurrencyBadge({ code, size = 16 }: { code: string; size?: number }) {
  const clipId = `expense-flag-${code}`;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" role="img" aria-label={`${code} flag`} className="inline-block flex-shrink-0 align-middle">
      <defs>
        <clipPath id={clipId}>
          <circle cx="20" cy="20" r="20" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <FlagGraphic code={code} />
      </g>
      <circle cx="20" cy="20" r="19" fill="none" stroke="#00000022" strokeWidth="2" />
    </svg>
  );
}

function CurrencySelect({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((p) => !p)}
        className={`w-full flex items-center gap-2 pl-3 pr-3 py-2 border rounded-lg text-left text-sm transition-colors ${
          disabled ? 'bg-slate-50 text-slate-400 border-slate-200' : 'border-slate-300 bg-white hover:border-slate-400'
        }`}
      >
        <CurrencyBadge code={value} />
        <span className="flex-1 min-w-0 truncate">
          <span className="font-medium">{value}</span>
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
      </button>
      {open && !disabled && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {CURRENCIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 ${c === value ? 'bg-[#1ebcb2]/10' : ''}`}
            >
              <CurrencyBadge code={c} />
              <span className={c === value ? 'text-[#641f60] font-medium' : 'text-slate-700'}>{c}</span>
              <span className="text-slate-400 truncate">{CURRENCY_NAMES[c] || ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Expenses can now be recorded in any currency, not just the tenant default,
// so a blended "sum everything" total would be misleading once more than one
// currency shows up in the visible set. This renders either a single big
// figure (the common case — one currency) or a compact per-currency stack.
function MoneyStat({ totals, compact }: { totals: [string, number][]; compact?: boolean }) {
  if (totals.length <= 1) {
    const [currency, value] = totals[0] ?? ['KES', 0];
    return (
      <h3 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">
        {compact ? formatMoneyCompact(value, currency) : formatMoney(value, currency)}
      </h3>
    );
  }
  return (
    <div className="space-y-0.5">
      {totals.map(([currency, value]) => (
        <div key={currency} className="flex items-center gap-1.5 text-sm sm:text-base font-bold text-slate-900">
          <CurrencyBadge code={currency} size={14} />
          {compact ? formatMoneyCompact(value, currency) : formatMoney(value, currency)}
        </div>
      ))}
    </div>
  );
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
  'head_office_admin',
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

  const defaultCurrency =
    (tenant?.settings as { default_currency?: string } | null)?.default_currency || 'KES';

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [categoryId, setCategoryId] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<ExpensePaymentMethod>('cash');
  const [vendorName, setVendorName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

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
    setCurrency(defaultCurrency);
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
        currency,
        expenseDate,
        paymentMethod,
        vendorName: vendorName.trim() || null,
        referenceNumber: referenceNumber.trim() || null,
        notes: notes.trim() || null,
        submittedBy: admin?.id ?? null,
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
      await approveExpense(id, admin?.id ?? null);
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

  // Paying an expense now moves real money, so it needs to know WHICH till.
  // Previously this only flipped a status flag and the float never changed,
  // which meant the books showed the money gone while the drawer still held
  // it. Opening a dialog is the cost of that being correct.
  const [payingExpense, setPayingExpense] = useState<ExpenseRow | null>(null);
  const [payFloatAccounts, setPayFloatAccounts] = useState<PayableFloatAccount[]>([]);
  const [payFloatId, setPayFloatId] = useState('');
  const [payLoadingTills, setPayLoadingTills] = useState(false);
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const openPayDialog = async (exp: ExpenseRow) => {
    setPayingExpense(exp);
    setPayFloatId('');
    setPayError(null);
    setPayLoadingTills(true);
    try {
      if (!tenant) throw new Error('No institution context.');
      // Only tills that could actually settle this: same currency, active,
      // and holding at least the amount. Offering one that would then be
      // refused by the database would waste the operator's time.
      const tills = await fetchPayableFloatAccounts(tenant.id, exp.currency, exp.amount);
      setPayFloatAccounts(tills);
      if (tills.length === 1) setPayFloatId(tills[0].id);
    } catch (err) {
      console.error('Error loading tills:', err);
      setPayError(err instanceof Error ? err.message : 'Could not load tills');
      setPayFloatAccounts([]);
    } finally {
      setPayLoadingTills(false);
    }
  };

  const closePayDialog = () => {
    setPayingExpense(null);
    setPayFloatAccounts([]);
    setPayFloatId('');
    setPayError(null);
  };

  const handleConfirmPay = async () => {
    if (!payingExpense) return;
    if (!payFloatId) {
      setPayError('Choose which till this is being paid from.');
      return;
    }
    setPaySubmitting(true);
    setPayError(null);
    try {
      // Debits the till, writes the ledger entry and marks the expense paid
      // in one database transaction.
      await markExpensePaid(payingExpense.id, payFloatId);
      await loadData();
      closePayDialog();
    } catch (err) {
      console.error('Error marking expense paid:', err);
      // Database guards ("Insufficient float. Balance is 5000, expense is
      // 8000.") are shown as-is: they name the actual problem.
      setPayError(err instanceof Error ? err.message : 'Failed to pay expense');
    } finally {
      setPaySubmitting(false);
    }
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setActioningId(id);
    try {
      await deleteExpense(id);
      setConfirmDeleteId(null);
      await loadData();
    } catch (err) {
      console.error('Error deleting expense:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete expense');
    } finally {
      setActioningId(null);
    }
  };

  const pendingCount = expenses.filter((e) => e.status === 'pending').length;

  // Expenses can be recorded in any currency now, so a single blended sum
  // would be misleading the moment more than one currency shows up in the
  // visible set. Group by currency instead; MoneyStat renders a single big
  // figure when there's only one, or a compact stack when there's more.
  const totalsByCurrency = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach((e) => {
      const cur = e.currency || defaultCurrency;
      map.set(cur, (map.get(cur) || 0) + Number(e.amount || 0));
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [expenses, defaultCurrency]);

  const approvedPaidTotalsByCurrency = useMemo(() => {
    const map = new Map<string, number>();
    expenses
      .filter((e) => e.status === 'approved' || e.status === 'paid')
      .forEach((e) => {
        const cur = e.currency || defaultCurrency;
        map.set(cur, (map.get(cur) || 0) + Number(e.amount || 0));
      });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [expenses, defaultCurrency]);

  // The category bar chart compares totals by relative bar length, which
  // only makes sense within a single currency — scoped to the tenant's
  // default currency, with a caption below making that explicit rather than
  // silently mixing currencies into one misleading bar.
  const categoryBreakdown = useMemo(() => {
    const totals = new Map<string, number>();
    expenses
      .filter((e) => (e.status === 'approved' || e.status === 'paid') && (e.currency || defaultCurrency) === defaultCurrency)
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
  }, [expenses, defaultCurrency]);

  const hasOtherCurrencyExpenses = useMemo(
    () => expenses.some((e) => (e.currency || defaultCurrency) !== defaultCurrency),
    [expenses, defaultCurrency]
  );

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
        <div className="bg-white rounded-xl border border-slate-200 border-t-4 border-t-[#641f60] p-4 sm:p-5 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#641f60]/10 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-[#641f60]" />
            </div>
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-100 text-slate-600">
              {STATUS_FILTERS.find((s) => s.value === statusFilter)?.label}
            </span>
          </div>
          <MoneyStat totals={totalsByCurrency} />
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {expenses.length} record{expenses.length === 1 ? '' : 's'} shown
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 border-t-4 border-t-[#1ebcb2] p-4 sm:p-5 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#1ebcb2]/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-[#1ebcb2]" />
            </div>
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-[#1ebcb2]/10 text-[#1ebcb2]">
              confirmed
            </span>
          </div>
          <MoneyStat totals={approvedPaidTotalsByCurrency} />
          <p className="text-xs sm:text-sm text-slate-500 mt-1">approved + paid</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 border-t-4 border-t-[#ee7b22] p-4 sm:p-5 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#ee7b22]/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-[#ee7b22]" />
            </div>
            {pendingCount > 0 && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-[#ee7b22] opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#ee7b22]" />
              </span>
            )}
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900">{pendingCount}</h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">awaiting review</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 border-t-4 border-t-slate-300 p-4 sm:p-5 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-slate-500" />
            </div>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate">
            {seesAllBranches && (branches?.length ?? 0) > 1 ? 'All branches' : branch?.name || 'Current branch'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">scope</p>
        </div>
      </div>

      {/* Mini Bar Chart Stack */}
      {!loading && categoryBreakdown.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="font-semibold text-sm sm:text-base text-slate-900">Top Categories (Approved + Paid)</h2>
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 flex-shrink-0">
              <CurrencyBadge code={defaultCurrency} size={13} />
              in {defaultCurrency}
            </span>
          </div>
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
          {hasOtherCurrencyExpenses && (
            <p className="text-[11px] text-slate-400 mt-3">
              Expenses recorded in other currencies aren&rsquo;t included in this chart.
            </p>
          )}
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
                          <div className="flex items-center justify-end gap-1.5">
                            {exp.status === 'pending' && canApprove && (
                              <>
                                <button
                                  onClick={() => handleApprove(exp.id)}
                                  disabled={isActioning}
                                  className="p-1.5 rounded-lg text-[#1ebcb2] bg-[#1ebcb2]/10 hover:bg-[#1ebcb2]/20 transition-colors disabled:opacity-50"
                                  title="Approve"
                                >
                                  {isActioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                </button>
                                <button
                                  onClick={() => setRejectingId(exp.id)}
                                  disabled={isActioning}
                                  className="p-1.5 rounded-lg text-[#c46040] bg-[#c46040]/10 hover:bg-[#c46040]/20 transition-colors disabled:opacity-50"
                                  title="Reject"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            {exp.status === 'approved' && canApprove && (
                              <button
                                onClick={() => openPayDialog(exp)}
                                disabled={isActioning}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#641f60] hover:bg-[#4a1646] transition-colors disabled:opacity-50"
                              >
                                Mark Paid
                              </button>
                            )}
                            {canApprove && (
                              <button
                                onClick={() => setConfirmDeleteId(exp.id)}
                                disabled={isActioning}
                                className="p-1.5 rounded-lg text-[#c46040] bg-[#c46040]/5 hover:bg-[#c46040]/15 transition-colors disabled:opacity-50"
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
                            onClick={() => openPayDialog(exp)}
                            disabled={isActioning}
                            className="px-2.5 py-1 rounded-md text-[11px] font-semibold text-[#641f60] bg-[#641f60]/5 active:bg-[#641f60]/10"
                          >
                            Mark Paid
                          </button>
                        )}
                        {canApprove && (
                          <button
                            onClick={() => setConfirmDeleteId(exp.id)}
                            disabled={isActioning}
                            className="p-1.5 rounded-md text-[#c46040] bg-[#c46040]/5 active:bg-[#c46040]/15"
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

      {/* Delete Confirmation Modal — replaces window.confirm(), which can be
          silently blocked in sandboxed/embedded browser contexts and looks
          identical to "nothing happened" when that occurs. */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#c46040]/10 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-[#c46040]" />
              </div>
              <h3 className="font-semibold text-slate-900">Delete this expense?</h3>
            </div>
            <p className="text-sm text-slate-600">
              {(() => {
                const target = expenses.find((e) => e.id === confirmDeleteId);
                return target ? (
                  <>
                    <span className="font-medium text-slate-800">{target.description}</span> &middot;{' '}
                    {formatMoney(target.amount, target.currency)}. This cannot be undone.
                  </>
                ) : (
                  'This cannot be undone.'
                );
              })()}
            </p>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setConfirmDeleteId(null)}
                disabled={actioningId === confirmDeleteId}
                className="flex-1 py-2.5 text-sm rounded-lg border border-slate-300 text-slate-600 font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={actioningId === confirmDeleteId}
                className="flex-1 py-2.5 text-sm rounded-lg bg-[#c46040] hover:bg-[#c46040]/90 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {actioningId === confirmDeleteId && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
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

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Amount *</label>
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
                <div className="col-span-1">
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Currency</label>
                  <CurrencySelect value={currency} onChange={setCurrency} disabled={submitting} />
                </div>
                <div className="col-span-2 sm:col-span-1">
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

      {/* Pay expense — choose the till the cash actually leaves */}
      {payingExpense && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#641f60] flex items-center gap-2">
                <Banknote className="w-5 h-5" />
                Pay Expense
              </h2>
              <button
                type="button"
                onClick={closePayDialog}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-sm font-medium text-slate-900">{payingExpense.description}</p>
                {payingExpense.vendor_name && (
                  <p className="text-xs text-slate-500 mt-0.5">{payingExpense.vendor_name}</p>
                )}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200">
                  <span className="text-xs text-slate-500">Amount</span>
                  <span className="text-lg font-bold text-slate-900">
                    {payingExpense.currency}{' '}
                    {Number(payingExpense.amount).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Pay from which till? *
                </label>
                {payLoadingTills ? (
                  <div className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading tills...
                  </div>
                ) : payFloatAccounts.length > 0 ? (
                  <select
                    value={payFloatId}
                    onChange={(e) => setPayFloatId(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1ebcb2]"
                  >
                    <option value="">Choose a till</option>
                    {payFloatAccounts.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.float_type.replace(/_/g, ' ')} — {f.currency}{' '}
                        {Number(f.balance).toLocaleString()}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-[#c46040] px-4 py-2.5 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg">
                    No active {payingExpense.currency} till holds enough to cover this expense. Top
                    up a till first, or pay it from a different account.
                  </p>
                )}
                <p className="text-xs text-slate-400 mt-1">
                  The till is debited and the expense marked paid together, so cash on hand always
                  matches the books.
                </p>
              </div>

              {payError && (
                <div className="p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {payError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closePayDialog}
                  className="px-4 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPay}
                  disabled={paySubmitting || !payFloatId || payFloatAccounts.length === 0}
                  className="px-6 py-2.5 bg-[#1ebcb2] hover:bg-[#159089] text-white font-medium rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {paySubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Paying...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Confirm Payment
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}