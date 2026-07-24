import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { FloatAccount } from '../types';
import type { Tables } from '../lib/supabase';
import {
  Receipt,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Loader2,
  RefreshCcw,
  Plus,
  Minus,
  X,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  Building2,
  Landmark,
  Banknote,
  Smartphone,
  Lock,
  Shield,
  Coins,
  Wallet,
  CheckCircle,
  ArrowDownRight,
  ArrowUpRight,
  ArrowRightLeft,
  Globe,
  Clock,
  XCircle,
  History,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Transaction row shape as stored on `transactions` - using the generated
// Supabase type directly (rather than a hand-rolled interface) so this stays
// correct if the schema changes.
type LedgerTransaction = Tables<'transactions'>;

// ============================================================================
// Currency flags (shared visual language with TransactionsPage)
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

// Real national flags rendered as inline SVG, clipped to a circle - same
// treatment as TransactionsPage so currency reads consistently across the app.
function FlagGraphic({ code }: { code: string }) {
  switch (code) {
    case 'USD': // United States
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
    case 'KES': // Kenya
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
    case 'SSP': // South Sudan
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
    case 'UGX': // Uganda
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
    case 'TZS': // Tanzania
      return (
        <>
          <path d="M0 0 H40 V40 H0 Z" fill="#1eb53a" />
          <path d="M40 0 V40 H0 Z" fill="#00a3dd" />
          <path d="M0 40 L40 0 v6 L6 40 Z" fill="#fcd116" />
          <path d="M0 40 L40 0 h-6 L0 34 Z" fill="#fcd116" />
          <path d="M0 34 L34 0 h-34 Z M40 6 L6 40 h34 Z" fill="#000" />
        </>
      );
    case 'RWF': // Rwanda
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
    case 'EUR': // European Union
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
    case 'GBP': // United Kingdom
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

function CurrencyBadge({ code, size = 22 }: { code: string; size?: number }) {
  const clipId = `float-flag-clip-${code}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      role="img"
      aria-label={`${code} flag`}
      className="flex-shrink-0"
    >
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

function CurrencySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-2 pl-3 pr-3 py-2.5 border border-slate-300 rounded-lg bg-white text-left hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1ebcb2]"
      >
        <CurrencyBadge code={value} />
        <span className="flex-1 min-w-0 truncate text-slate-900">
          <span className="font-medium">{value}</span>
          <span className="hidden sm:inline text-slate-400"> - {CURRENCY_NAMES[value] || value}</span>
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {CURRENCIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                c === value ? 'bg-[#1ebcb2]/10' : ''
              }`}
            >
              <CurrencyBadge code={c} size={20} />
              <span className={c === value ? 'text-[#641f60] font-medium' : 'text-slate-700'}>{c}</span>
              <span className="text-slate-400 truncate">{CURRENCY_NAMES[c] || ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Float-account constants & helpers
// ============================================================================

const FLOAT_TYPES: { value: string; label: string; Icon: LucideIcon }[] = [
  { value: 'cash', label: 'Cash', Icon: Banknote },
  { value: 'mpesa', label: 'M-Pesa Till', Icon: Smartphone },
  { value: 'mtn_momo', label: 'MoMo', Icon: Smartphone },
  { value: 'bank', label: 'Bank', Icon: Landmark },
  { value: 'safe', label: 'Safe', Icon: Lock },
  { value: 'vault', label: 'Vault', Icon: Shield },
  { value: 'other', label: 'Other', Icon: Coins },
];

const STATUS_OPTIONS: FloatAccount['status'][] = ['active', 'inactive', 'frozen'];

// Funding sources for a tracked top-up - mirrors the payment-source options
// used on the "Add Funds (Float)" transaction type in Transactions, so a
// capital injection looks the same regardless of where it was started.
type FundingSource = 'cash' | 'momo' | 'mpesa' | 'bank';
const FUNDING_SOURCES: { value: FundingSource; label: string; Icon: LucideIcon }[] = [
  { value: 'cash', label: 'Cash', Icon: Banknote },
  { value: 'momo', label: 'MoMo', Icon: Smartphone },
  { value: 'mpesa', label: 'M-Pesa', Icon: Smartphone },
  { value: 'bank', label: 'Bank', Icon: Landmark },
];

function getFloatIcon(type: string): LucideIcon {
  return FLOAT_TYPES.find((t) => t.value === type)?.Icon || Coins;
}

// Renders the lucide icon for a given float type.
function FloatTypeIcon({ type, className }: { type: string; className?: string }) {
  const Icon = getFloatIcon(type);
  return <Icon className={className} />;
}

function floatTypeLabel(type: string) {
  return FLOAT_TYPES.find((t) => t.value === type)?.label || type.replace(/_/g, ' ');
}

function formatMoney(amount: number) {
  return Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });
}

function statusBadgeStyle(status: string) {
  switch (status) {
    case 'active':
      return 'bg-[#1ebcb2]/10 text-[#1ebcb2]';
    case 'frozen':
      return 'bg-[#c46040]/10 text-[#c46040]';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

// ============================================================================
// Float account activity ledger - resolves which customers' transactions
// actually moved through a given float account, so Float isn't just a
// balance number in isolation.
// ============================================================================

// Same debit/credit classification TransactionsPage uses for float
// verification, kept local here purely for the +/- display sign.
const FLOAT_DEBIT_TX_TYPES = new Set([
  'withdrawal',
  'transfer',
  'forex_buy',
  'forex_sell',
  'loan_disbursement',
  'savings_withdrawal',
]);

function isDebitTx(type: string): boolean {
  return FLOAT_DEBIT_TX_TYPES.has(type);
}

function ledgerTxIcon(type: string) {
  if (type.includes('deposit') || type.includes('repayment')) return ArrowDownRight;
  if (type.includes('withdrawal') || type.includes('disbursement')) return ArrowUpRight;
  if (type.includes('forex')) return Globe;
  if (type === 'float_allocation') return Wallet;
  return ArrowRightLeft;
}

function ledgerTxIconClasses(type: string): { bg: string; color: string } {
  if (type.includes('deposit') || type.includes('repayment')) return { bg: 'bg-[#1ebcb2]/10', color: 'text-[#1ebcb2]' };
  if (type.includes('withdrawal') || type.includes('disbursement')) return { bg: 'bg-[#ee7b22]/10', color: 'text-[#ee7b22]' };
  if (type.includes('forex')) return { bg: 'bg-[#641f60]/10', color: 'text-[#641f60]' };
  return { bg: 'bg-slate-100', color: 'text-slate-500' };
}

// Prefers the transaction's own stored sender/receiver name (set at the
// point of entry, e.g. via phone lookup on a transfer); falls back to a
// resolved customer record for types that only stored a customer id
// (deposits, withdrawals, loan movements, forex).
function ledgerCustomerLabel(t: LedgerTransaction, customerNames: Record<string, string>): string {
  if (t.sender_name && t.receiver_name) return `${t.sender_name} \u2192 ${t.receiver_name}`;
  if (t.sender_name) return t.sender_name;
  if (t.receiver_name) return t.receiver_name;
  const fromName = t.from_customer_id ? customerNames[t.from_customer_id] : undefined;
  const toName = t.to_customer_id ? customerNames[t.to_customer_id] : undefined;
  if (fromName && toName) return `${fromName} \u2192 ${toName}`;
  if (fromName) return fromName;
  if (toName) return toName;
  return t.transaction_type === 'float_allocation' ? 'Capital injection (no customer)' : 'No customer linked';
}

// Which wallet the money left and which it entered. A float account is the
// till; the wallet is the member's balance on the other side of the counter.
// Showing only customer names leaves an operator unable to answer "which of
// this member's three wallets was debited".
function ledgerWalletLabel(
  t: LedgerTransaction,
  walletLabels: Record<string, string>
): string | null {
  const from = t.from_wallet_id ? walletLabels[t.from_wallet_id] : undefined;
  const to = t.to_wallet_id ? walletLabels[t.to_wallet_id] : undefined;
  if (from && to) return `${from} \u2192 ${to}`;
  if (from) return `From ${from}`;
  if (to) return `To ${to}`;
  return null;
}

function ledgerStatusBadge(status: string) {
  const map: Record<string, { cls: string; Icon: LucideIcon }> = {
    pending: { cls: 'bg-[#ee7b22]/10 text-[#ee7b22]', Icon: Clock },
    approved: { cls: 'bg-[#1ebcb2]/10 text-[#1ebcb2]', Icon: CheckCircle },
    processing: { cls: 'bg-[#641f60]/10 text-[#641f60]', Icon: Loader2 },
    completed: { cls: 'bg-[#1ebcb2]/10 text-[#1ebcb2]', Icon: CheckCircle },
    failed: { cls: 'bg-[#c46040]/10 text-[#c46040]', Icon: XCircle },
    reversed: { cls: 'bg-slate-100 text-slate-600', Icon: RefreshCcw },
    cancelled: { cls: 'bg-slate-100 text-slate-600', Icon: XCircle },
  };
  const s = map[status] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${s.cls}`}>
      <s.Icon className="w-3 h-3" />
      {status}
    </span>
  );
}

// ============================================================================

interface FloatFormData {
  float_type: string;
  currency: string;
  balance: number;
  min_threshold: number | null;
  max_threshold: number | null;
  status: FloatAccount['status'];
  scope: 'branch' | 'tenant_wide';
}

function emptyFloatForm(): FloatFormData {
  return {
    float_type: 'cash',
    currency: 'KES',
    balance: 0,
    min_threshold: null,
    max_threshold: null,
    status: 'active',
    scope: 'branch',
  };
}

function accountToFormData(a: FloatAccount): FloatFormData {
  return {
    float_type: a.float_type,
    currency: a.currency,
    balance: Number(a.balance) || 0,
    min_threshold: a.min_threshold,
    max_threshold: a.max_threshold,
    status: a.status,
    scope: a.branch_id ? 'branch' : 'tenant_wide',
  };
}

interface TopUpForm {
  amount: string;
  source: FundingSource;
  notes: string;
}

function emptyTopUpForm(): TopUpForm {
  return { amount: '', source: 'cash', notes: '' };
}

// ============================================================================
// Small building blocks
// ============================================================================

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label} {required && <span className="text-[#c46040]">*</span>}
      </label>
      {children}
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-semibold text-slate-900">{value}</p>
    </div>
  );
}

// ============================================================================
// Main component
// ============================================================================

export function FloatPage() {
  const { tenant, branch, admin } = useAuth();

  const [accounts, setAccounts] = useState<FloatAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Default to "this branch" only when a branch context exists; otherwise show everything.
  const [scope, setScope] = useState<'branch' | 'all'>(branch ? 'branch' : 'all');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FloatFormData>(emptyFloatForm());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [selectedAccount, setSelectedAccount] = useState<FloatAccount | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Delete failures are shown inside the details panel rather than the
  // page-level banner, which sits behind the modal overlay and is invisible
  // while the panel is open - the reason a rejected delete looked like a
  // dead button.
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Activity ledger for whichever account is currently open in the detail
  // panel - which customers' transactions actually moved through it.
  const [accountTransactions, setAccountTransactions] = useState<LedgerTransaction[]>([]);
  const [ledgerWalletLabels, setLedgerWalletLabels] = useState<Record<string, string>>({});
  const [ledgerCustomerNames, setLedgerCustomerNames] = useState<Record<string, string>>({});
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);

  // Tracked "Add Funds" (capital injection) - the only way to increase an
  // EXISTING account's balance. Every top-up writes a real transaction row
  // (transaction_type: 'float_allocation') so the movement is traceable,
  // instead of letting the edit form silently overwrite the balance number.
  const [topUpAccount, setTopUpAccount] = useState<FloatAccount | null>(null);
  const [topUpForm, setTopUpForm] = useState<TopUpForm>(emptyTopUpForm());
  const [topUpSubmitting, setTopUpSubmitting] = useState(false);
  const [topUpError, setTopUpError] = useState<string | null>(null);

  // Withdraw: taking cash out of a till (banking surplus, returning capital).
  const [withdrawAccount, setWithdrawAccount] = useState<FloatAccount | null>(null);
  const [withdrawForm, setWithdrawForm] = useState<TopUpForm>(emptyTopUpForm());
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  // Transfer: moving float between two tills, e.g. cash drawer -> M-Pesa till.
  const [transferFrom, setTransferFrom] = useState<FloatAccount | null>(null);
  const [transferToId, setTransferToId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  useEffect(() => {
    if (tenant) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant]);

  // Resilient fetch: scoped to the tenant only. Branch-level filtering happens
  // client-side (see `filteredAccounts`) so accounts with a null branch_id
  // (tenant-wide float, e.g. head office reserves) or a different branch_id
  // never silently disappear from the page.
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('float_accounts')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .order('currency', { ascending: true })
        .order('float_type', { ascending: true });

      if (fetchError) throw fetchError;
      setAccounts((data || []) as FloatAccount[]);
    } catch (err) {
      console.error('Error loading float accounts:', err);
      setError(err instanceof Error ? err.message : 'Failed to load float accounts');
    } finally {
      setLoading(false);
    }
  };

  // Loads recent transactions tied to a float account (via float_account_id)
  // and resolves any linked customer ids to display names, so the ledger
  // reads "Jane Wanjiru -> John Otieno" instead of raw uuids.
  const loadAccountLedger = useCallback(
    async (accountId: string) => {
      if (!tenant) return;
      setLoadingLedger(true);
      setLedgerError(null);
      try {
        const { data, error: txError } = await supabase
          .from('transactions')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('float_account_id', accountId)
          .order('created_at', { ascending: false })
          .limit(50);
        if (txError) throw txError;

        const rows = (data ?? []) as LedgerTransaction[];
        setAccountTransactions(rows);

        const idsNeeded = new Set<string>();
        rows.forEach((t) => {
          if (t.from_customer_id) idsNeeded.add(t.from_customer_id);
          if (t.to_customer_id) idsNeeded.add(t.to_customer_id);
        });

        if (idsNeeded.size > 0) {
          const { data: custRows, error: custError } = await supabase
            .from('customers')
            .select('id, first_name, last_name, business_name, customer_type')
            .in('id', Array.from(idsNeeded));
          if (custError) throw custError;
          const map: Record<string, string> = {};
          (custRows ?? []).forEach((c) => {
            map[c.id] =
              c.customer_type !== 'individual'
                ? c.business_name || 'Unnamed business'
                : `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unnamed';
          });
          setLedgerCustomerNames(map);
        } else {
          setLedgerCustomerNames({});
        }

        // Wallets referenced by these movements. Resolved separately from
        // customers because a transaction can name a wallet without naming a
        // customer id, and vice versa.
        const walletIds = new Set<string>();
        rows.forEach((t) => {
          if (t.from_wallet_id) walletIds.add(t.from_wallet_id);
          if (t.to_wallet_id) walletIds.add(t.to_wallet_id);
        });

        if (walletIds.size > 0) {
          const { data: walletRows, error: walletError } = await supabase
            .from('wallets')
            .select('id, account_number, wallet_type, currency')
            .in('id', Array.from(walletIds));
          if (walletError) throw walletError;
          const wmap: Record<string, string> = {};
          (walletRows ?? []).forEach((w: {
            id: string;
            account_number?: string | null;
            wallet_type?: string | null;
            currency?: string | null;
          }) => {
            // Prefer the account number a member would recognise; fall back to
            // the type so the label is never an empty string.
            const label =
              w.account_number || (w.wallet_type ? w.wallet_type.replace(/_/g, ' ') : 'wallet');
            wmap[w.id] = w.currency ? `${label} (${w.currency})` : label;
          });
          setLedgerWalletLabels(wmap);
        } else {
          setLedgerWalletLabels({});
        }
      } catch (err) {
        console.error('Error loading float account activity:', err);
        setLedgerError(err instanceof Error ? err.message : 'Failed to load recent activity');
        setAccountTransactions([]);
        setLedgerCustomerNames({});
        setLedgerWalletLabels({});
      } finally {
        setLoadingLedger(false);
      }
    },
    [tenant]
  );

  useEffect(() => {
    if (selectedAccount) {
      loadAccountLedger(selectedAccount.id);
    } else {
      setAccountTransactions([]);
      setLedgerCustomerNames({});
      setLedgerWalletLabels({});
      setLedgerError(null);
      setDeleteError(null);
      setConfirmDeleteId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccount?.id]);

  const filteredAccounts = useMemo(() => {
    if (scope === 'all' || !branch) return accounts;
    // Tenant-wide accounts (branch_id null) always surface alongside the
    // current branch's own accounts.
    return accounts.filter((a) => a.branch_id === branch.id || a.branch_id === null);
  }, [accounts, scope, branch]);

  // Per-currency totals instead of one blended figure.
  const currencyTotals = useMemo(() => {
    const map = new Map<string, { balance: number; count: number; lowCount: number }>();
    for (const a of filteredAccounts) {
      const entry = map.get(a.currency) || { balance: 0, count: 0, lowCount: 0 };
      entry.balance += Number(a.balance) || 0;
      entry.count += 1;
      if (a.min_threshold != null && Number(a.balance) < Number(a.min_threshold)) entry.lowCount += 1;
      map.set(a.currency, entry);
    }
    return Array.from(map.entries()).map(([currency, v]) => ({ currency, ...v }));
  }, [filteredAccounts]);

  const totalLowAlerts = filteredAccounts.filter(
    (a) => a.min_threshold != null && Number(a.balance) < Number(a.min_threshold)
  ).length;
  const activeCount = filteredAccounts.filter((a) => a.status === 'active').length;

  // --- Form handlers ---------------------------------------------------------

  const openCreateForm = () => {
    setEditingId(null);
    setFormData(emptyFloatForm());
    setFormError(null);
    setShowForm(true);
  };

  const openEditForm = (a: FloatAccount) => {
    setEditingId(a.id);
    setFormData(accountToFormData(a));
    setFormError(null);
    setShowForm(true);
    setSelectedAccount(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (formData.balance < 0) {
      setFormError('Opening balance cannot be negative');
      return;
    }
    if (
      formData.min_threshold != null &&
      formData.max_threshold != null &&
      formData.max_threshold < formData.min_threshold
    ) {
      setFormError('Max threshold cannot be lower than min threshold');
      return;
    }
    if (formData.scope === 'branch' && !branch) {
      setFormError('No branch context available - choose "Tenant-wide" instead');
      return;
    }

    setSubmitting(true);
    try {
      if (!tenant) throw new Error('Missing tenant');

      if (editingId) {
        // Editing NEVER touches balance - that's only ever moved through a
        // tracked transaction (see handleTopUp). This form only edits the
        // account's configuration (type, currency, thresholds, status).
        const { data, error: updateError } = await supabase
          .from('float_accounts')
          .update({
            float_type: formData.float_type,
            currency: formData.currency,
            min_threshold: formData.min_threshold,
            max_threshold: formData.max_threshold,
            status: formData.status,
          } as never)
          .eq('id', editingId)
          .eq('tenant_id', tenant.id)
          .select('id');
        if (updateError) throw updateError;
        // A silent RLS rejection returns success with no rows. Without this
        // check the modal closes as if the edit saved.
        if (!data || data.length === 0) {
          throw new Error(
            'The update was rejected. Your role may not have permission to edit float accounts.'
          );
        }
      } else {
        // Creating a brand-new account is the one place a balance number can
        // be entered directly - it's an opening balance, the same way Daily
        // Opening records a starting position, not a balance overwrite.
        const payload = {
          tenant_id: tenant.id,
          branch_id: formData.scope === 'branch' ? branch!.id : null,
          float_type: formData.float_type,
          currency: formData.currency,
          balance: formData.balance,
          min_threshold: formData.min_threshold,
          max_threshold: formData.max_threshold,
          status: formData.status,
        };
        const { data, error: insertError } = await supabase
          .from('float_accounts')
          .insert(payload as never)
          .select('id');
        if (insertError) throw insertError;
        if (!data || data.length === 0) {
          throw new Error(
            'The account was not created. Your role may not have permission to add float accounts.'
          );
        }
      }

      await loadData();
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save float account');
    } finally {
      setSubmitting(false);
    }
  };

  // --- Delete ----------------------------------------------------------------
  //
  // Deleting a till is destructive and easy to do by accident next to "Edit",
  // so it asks for confirmation first. The delete itself requests the removed
  // row back with `.select()`: without that, an RLS policy that forbids the
  // delete returns `{ data: null, error: null }` - success with nothing
  // deleted - and the account quietly reappears on the next load, which is
  // exactly what a broken button looks like.

  const requestDelete = (id: string) => {
    setDeleteError(null);
    setConfirmDeleteId(id);
  };

  const cancelDelete = () => {
    setConfirmDeleteId(null);
  };

  const handleDelete = async (id: string) => {
    if (!tenant) return;

    const account = accounts.find((a) => a.id === id);

    // A till holding money should be emptied through a tracked withdrawal or
    // transfer, not deleted with the balance still on it - otherwise the
    // money vanishes from the books with no corresponding movement.
    if (account && Number(account.balance || 0) !== 0) {
      setDeleteError(
        `This till still holds ${account.currency} ${formatMoney(
          Number(account.balance)
        )}. Withdraw or transfer the balance to zero before deleting it.`
      );
      setConfirmDeleteId(null);
      return;
    }

    setDeleteError(null);
    setDeletingId(id);
    try {
      const { data, error: deleteError } = await supabase
        .from('float_accounts')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenant.id)
        .select('id');

      if (deleteError) {
        // 23503: transactions still reference this float account. The history
        // is worth more than the tidy list, so deactivating is the answer.
        if ((deleteError as { code?: string }).code === '23503') {
          throw new Error(
            'This account has transaction history and cannot be deleted. Set its status to Inactive instead, which hides it without losing the records.'
          );
        }
        throw deleteError;
      }

      if (!data || data.length === 0) {
        throw new Error(
          'The delete was rejected by the database. Your role may not have permission to remove float accounts.'
        );
      }

      await loadData();
      setConfirmDeleteId(null);
      setSelectedAccount(null);
    } catch (err) {
      console.error('Error deleting float account:', err);
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete float account');
      setConfirmDeleteId(null);
    } finally {
      setDeletingId(null);
    }
  };

  // --- Tracked "Add Funds" (capital injection) -------------------------------

  const openTopUp = (a: FloatAccount) => {
    setTopUpAccount(a);
    setTopUpForm(emptyTopUpForm());
    setTopUpError(null);
    setShowForm(false);
    setSelectedAccount(null);
  };

  const closeTopUp = () => {
    setTopUpAccount(null);
    setTopUpForm(emptyTopUpForm());
    setTopUpError(null);
  };

  const handleTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setTopUpError(null);

    if (!tenant || !admin || !topUpAccount) {
      setTopUpError('Missing institution or admin context. Please sign in again.');
      return;
    }
    const amount = parseFloat(topUpForm.amount);
    if (!topUpForm.amount || Number.isNaN(amount) || amount <= 0) {
      setTopUpError('Enter a valid amount to add.');
      return;
    }

    setTopUpSubmitting(true);
    try {
      // Atomic: float_topup() locks the row, adds the amount and writes the
      // ledger entry in ONE database transaction.
      //
      // This replaces a read-then-write that could silently destroy money:
      // two tellers topping up at the same moment would both read the old
      // balance and the second write would erase the first. It also removes
      // the case where the balance moved but the audit record failed to
      // save, which previously left the UI asking the user to note it by
      // hand. Now either both land or neither does.
      const { data: result, error: rpcError } = await supabase.rpc('float_topup', {
        p_float_account_id: topUpAccount.id,
        p_amount: amount,
        p_payment_source: topUpForm.source,
        p_notes:
          topUpForm.notes.trim() ||
          `Capital injection into ${floatTypeLabel(topUpAccount.float_type)}`,
      } as never);
      // Database-side guards (insufficient float, inactive account, wrong
      // institution) come back as errors here and are shown verbatim, since
      // they say exactly what went wrong.
      if (rpcError) throw rpcError;
      void result;

      await loadData();
      closeTopUp();
    } catch (err) {
      console.error('Error adding funds:', err);
      setTopUpError(err instanceof Error ? err.message : 'Failed to add funds');
    } finally {
      setTopUpSubmitting(false);
    }
  };

  const openWithdraw = (account: FloatAccount) => {
    setWithdrawAccount(account);
    setWithdrawForm(emptyTopUpForm());
    setWithdrawError(null);
  };

  const closeWithdraw = () => {
    setWithdrawAccount(null);
    setWithdrawForm(emptyTopUpForm());
    setWithdrawError(null);
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError(null);

    if (!tenant || !admin || !withdrawAccount) {
      setWithdrawError('Missing institution or admin context. Please sign in again.');
      return;
    }
    const amount = parseFloat(withdrawForm.amount);
    if (!withdrawForm.amount || Number.isNaN(amount) || amount <= 0) {
      setWithdrawError('Enter a valid amount to withdraw.');
      return;
    }
    // Checked here for a fast, clear message; the database enforces it too,
    // so a stale balance on screen cannot let an overdraft through.
    if (amount > Number(withdrawAccount.balance || 0)) {
      setWithdrawError(
        `Only ${formatMoney(Number(withdrawAccount.balance || 0))} ${withdrawAccount.currency} is available in this till.`
      );
      return;
    }

    setWithdrawSubmitting(true);
    try {
      const { error: rpcError } = await supabase.rpc('float_withdraw', {
        p_float_account_id: withdrawAccount.id,
        p_amount: amount,
        p_payment_source: withdrawForm.source,
        p_notes:
          withdrawForm.notes.trim() ||
          `Withdrawal from ${floatTypeLabel(withdrawAccount.float_type)}`,
      } as never);
      if (rpcError) throw rpcError;

      await loadData();
      closeWithdraw();
    } catch (err) {
      console.error('Error withdrawing funds:', err);
      setWithdrawError(err instanceof Error ? err.message : 'Failed to withdraw funds');
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  const openTransfer = (account: FloatAccount) => {
    setTransferFrom(account);
    setTransferToId('');
    setTransferAmount('');
    setTransferNotes('');
    setTransferError(null);
  };

  const closeTransfer = () => {
    setTransferFrom(null);
    setTransferToId('');
    setTransferAmount('');
    setTransferNotes('');
    setTransferError(null);
  };

  // Only tills in the same currency can receive a transfer: moving KES into a
  // USD till would need a conversion, which is a forex deal, not a transfer.
  const transferTargets = useMemo(() => {
    if (!transferFrom) return [];
    return accounts.filter(
      (a) =>
        a.id !== transferFrom.id &&
        a.currency === transferFrom.currency &&
        a.status === 'active'
    );
  }, [accounts, transferFrom]);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransferError(null);

    if (!tenant || !admin || !transferFrom) {
      setTransferError('Missing institution or admin context. Please sign in again.');
      return;
    }
    if (!transferToId) {
      setTransferError('Choose a destination till.');
      return;
    }
    const amount = parseFloat(transferAmount);
    if (!transferAmount || Number.isNaN(amount) || amount <= 0) {
      setTransferError('Enter a valid amount to transfer.');
      return;
    }
    if (amount > Number(transferFrom.balance || 0)) {
      setTransferError(
        `Only ${formatMoney(Number(transferFrom.balance || 0))} ${transferFrom.currency} is available in this till.`
      );
      return;
    }

    setTransferSubmitting(true);
    try {
      // Both legs move inside one database transaction, so money can never
      // leave one till without arriving in the other.
      const { error: rpcError } = await supabase.rpc('float_transfer', {
        p_from_account_id: transferFrom.id,
        p_to_account_id: transferToId,
        p_amount: amount,
        p_notes: transferNotes.trim() || 'Float transfer between tills',
      } as never);
      if (rpcError) throw rpcError;

      await loadData();
      closeTransfer();
    } catch (err) {
      console.error('Error transferring float:', err);
      setTransferError(err instanceof Error ? err.message : 'Failed to transfer float');
    } finally {
      setTransferSubmitting(false);
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#641f60]">Float Management</h1>
          <p className="text-slate-600 mt-1">Track and manage your branch float positions</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {branch && (
            <div className="flex rounded-lg border border-[#dae1e1] overflow-hidden">
              <button
                onClick={() => setScope('branch')}
                className={`px-3 py-2 text-sm font-medium ${
                  scope === 'branch' ? 'bg-[#641f60] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                This Branch
              </button>
              <button
                onClick={() => setScope('all')}
                className={`px-3 py-2 text-sm font-medium ${
                  scope === 'all' ? 'bg-[#641f60] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                All Branches
              </button>
            </div>
          )}
          <button
            onClick={loadData}
            className="px-4 py-2 border border-[#dae1e1] rounded-lg hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <RefreshCcw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={openCreateForm}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg transition-all"
          >
            <Plus className="w-5 h-5" />
            Add Float Account
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Per-currency totals - horizontally scrollable on small screens so
          an arbitrary number of currencies never breaks the layout */}
      <div className="flex gap-4 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:overflow-visible">
        {currencyTotals.length > 0 ? (
          currencyTotals.map((c) => (
            <div
              key={c.currency}
              className="bg-white rounded-xl border border-[#dae1e1] p-5 flex-shrink-0 w-64 sm:w-auto snap-start"
            >
              <div className="flex items-center gap-3">
                <CurrencyBadge code={c.currency} size={36} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-500">{c.currency} Float</p>
                  <p className="text-2xl font-bold text-slate-900 truncate">{formatMoney(c.balance)}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                <span>{c.count} account{c.count === 1 ? '' : 's'}</span>
                {c.lowCount > 0 && (
                  <span className="text-[#c46040] flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {c.lowCount} below min
                  </span>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white rounded-xl border border-[#dae1e1] p-5 w-full text-center text-slate-400 text-sm">
            No float balances to summarize yet
          </div>
        )}
      </div>

      {/* Secondary stats */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-[#dae1e1] p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[#1ebcb2]/10">
              <TrendingUp className="w-6 h-6 text-[#1ebcb2]" />
            </div>
            <StatPill label="Active Accounts" value={activeCount} />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[#dae1e1] p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[#c46040]/10">
              <AlertCircle className="w-6 h-6 text-[#c46040]" />
            </div>
            <StatPill label="Low Balance Alerts" value={totalLowAlerts} />
          </div>
        </div>
      </div>

      {/* Float Accounts list */}
      <div className="bg-white rounded-xl border border-[#dae1e1] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#1ebcb2]" />
          </div>
        ) : filteredAccounts.length > 0 ? (
          <div className="divide-y divide-[#dae1e1]">
            {filteredAccounts.map((account) => {
              const isLow = account.min_threshold != null && Number(account.balance) < Number(account.min_threshold);
              return (
                <div
                  key={account.id}
                  className="px-4 sm:px-6 py-4 sm:py-6 hover:bg-slate-50 transition-colors flex items-center gap-3 sm:gap-4"
                >
                  <button
                    onClick={() => setSelectedAccount(account)}
                    className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 text-left"
                  >
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[#ee7b22] text-white flex items-center justify-center flex-shrink-0">
                      <FloatTypeIcon type={account.float_type} className="w-6 h-6 sm:w-7 sm:h-7" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <h3 className="font-semibold text-slate-900 capitalize truncate">
                              {floatTypeLabel(account.float_type)}
                            </h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadgeStyle(account.status)}`}>
                              {account.status}
                            </span>
                            {!account.branch_id && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-[#641f60]/10 text-[#641f60] flex items-center gap-1">
                                <Building2 className="w-3 h-3" /> Tenant-wide
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <CurrencyBadge code={account.currency} size={16} />
                            <p className="text-sm text-slate-500">{account.currency}</p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-lg sm:text-xl font-bold text-slate-900 whitespace-nowrap">
                            {account.currency} {formatMoney(account.balance)}
                          </p>
                          {isLow && (
                            <p className="text-xs text-[#c46040] flex items-center justify-end gap-1">
                              <AlertCircle className="w-3 h-3" /> Below minimum
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        {account.min_threshold != null && (
                          <span>Min: {account.currency} {formatMoney(account.min_threshold)}</span>
                        )}
                        {account.max_threshold != null && (
                          <span>Max: {account.currency} {formatMoney(account.max_threshold)}</span>
                        )}
                      </div>
                    </div>
                  </button>
                  <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => openTopUp(account)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#1ebcb2]/10 hover:bg-[#1ebcb2]/20 text-[#1ebcb2] text-sm font-medium rounded-lg transition-colors"
                      title="Add capital to this till"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </button>
                    <button
                      onClick={() => openWithdraw(account)}
                      disabled={Number(account.balance || 0) <= 0}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#ee7b22]/10 hover:bg-[#ee7b22]/20 text-[#ee7b22] text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      title={
                        Number(account.balance || 0) <= 0
                          ? 'Nothing to withdraw'
                          : 'Take cash out of this till'
                      }
                    >
                      <Minus className="w-4 h-4" />
                      Withdraw
                    </button>
                    <button
                      onClick={() => openTransfer(account)}
                      disabled={Number(account.balance || 0) <= 0}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#641f60]/10 hover:bg-[#641f60]/20 text-[#641f60] text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      title={
                        Number(account.balance || 0) <= 0
                          ? 'Nothing to transfer'
                          : 'Move float to another till'
                      }
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                      Move
                    </button>
                  </div>
                  <ChevronRight
                    className="w-5 h-5 text-slate-300 flex-shrink-0 hidden sm:block cursor-pointer"
                    onClick={() => setSelectedAccount(account)}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center px-4">
            <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No float accounts found for this view</p>
            <p className="text-sm text-slate-400">
              {scope === 'branch' ? 'Try "All Branches", or ' : ''}Add one manually or complete daily opening to
              initialize float accounts.
            </p>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl shadow-2xl flex flex-col h-full sm:h-auto sm:max-h-[90vh] overflow-hidden">
            {/* Fixed header */}
            <div className="px-4 sm:px-6 py-4 border-b border-[#dae1e1] flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg sm:text-xl font-bold text-[#641f60]">
                {editingId ? 'Edit Float Account' : 'Add Float Account'}
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable body */}
            <form
              id="float-account-form"
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-5 space-y-4"
            >
              <Field label="Float Type" required>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {FLOAT_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, float_type: t.value }))}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                        formData.float_type === t.value
                          ? 'border-[#1ebcb2] bg-[#1ebcb2]/10 text-[#641f60]'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <t.Icon className="w-4 h-4 flex-shrink-0" />
                      {t.label}
                    </button>
                  ))}
                </div>
              </Field>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Currency" required>
                  <CurrencySelect
                    value={formData.currency}
                    onChange={(v) => setFormData((prev) => ({ ...prev, currency: v }))}
                  />
                </Field>
                {editingId ? (
                  <Field label="Balance">
                    <div className="px-3 py-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-between gap-2">
                      <span className="font-medium">
                        {formData.currency} {formatMoney(formData.balance)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const account = accounts.find((a) => a.id === editingId);
                          if (account) openTopUp(account);
                        }}
                        className="text-xs font-medium text-[#1ebcb2] hover:underline whitespace-nowrap"
                      >
                        Add Funds instead
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Balance only changes through a tracked transaction - use "Add Funds" to top it up.
                    </p>
                  </Field>
                ) : (
                  <Field label="Opening Balance" required>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.balance || ''}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, balance: parseFloat(e.target.value) || 0 }))
                        }
                        className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1ebcb2]"
                      />
                    </div>
                  </Field>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Min Threshold">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.min_threshold ?? ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        min_threshold: e.target.value === '' ? null : parseFloat(e.target.value),
                      }))
                    }
                    placeholder="Optional"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1ebcb2]"
                  />
                </Field>
                <Field label="Max Threshold">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.max_threshold ?? ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        max_threshold: e.target.value === '' ? null : parseFloat(e.target.value),
                      }))
                    }
                    placeholder="Optional"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1ebcb2]"
                  />
                </Field>
              </div>

              <Field label="Assignment" required>
                <div className="flex flex-col sm:flex-row gap-3">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="float_scope"
                      checked={formData.scope === 'branch'}
                      disabled={!branch || !!editingId}
                      onChange={() => setFormData((prev) => ({ ...prev, scope: 'branch' }))}
                      className="text-[#641f60] focus:ring-[#1ebcb2]"
                    />
                    <Landmark className="w-4 h-4 text-slate-400" />
                    This Branch{branch ? ` (${branch.name})` : ''}
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="float_scope"
                      checked={formData.scope === 'tenant_wide'}
                      disabled={!!editingId}
                      onChange={() => setFormData((prev) => ({ ...prev, scope: 'tenant_wide' }))}
                      className="text-[#641f60] focus:ring-[#1ebcb2]"
                    />
                    <Building2 className="w-4 h-4 text-slate-400" />
                    Tenant-wide (no branch)
                  </label>
                </div>
                {editingId && (
                  <p className="text-xs text-slate-400 mt-1">
                    Scope can't be changed after creation - create a new account to move to a different branch.
                  </p>
                )}
              </Field>

              {editingId && (
                <Field label="Status">
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, status: e.target.value as FloatAccount['status'] }))
                    }
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1ebcb2]"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              {formError && (
                <div className="p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  {formError}
                </div>
              )}
            </form>

            {/* Fixed footer */}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-3 px-4 sm:px-6 py-4 border-t border-[#dae1e1] flex-shrink-0 bg-white">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="float-account-form"
                disabled={submitting}
                className="px-6 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>{editingId ? 'Save Changes' : 'Create Float Account'}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Funds modal - the only path that increases an existing
          account's balance, and it's always backed by a transaction row. */}
      {topUpAccount && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#641f60] flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                Add Funds
              </h2>
              <button
                type="button"
                onClick={closeTopUp}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTopUp} className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#ee7b22] text-white flex items-center justify-center flex-shrink-0">
                  <FloatTypeIcon type={topUpAccount.float_type} className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {floatTypeLabel(topUpAccount.float_type)}
                  </p>
                  <p className="text-xs text-slate-500">
                    Current balance: {topUpAccount.currency} {formatMoney(topUpAccount.balance)}
                  </p>
                </div>
              </div>

              <Field label="Amount to Add" required>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">
                    {topUpAccount.currency}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    autoFocus
                    value={topUpForm.amount}
                    onChange={(e) => setTopUpForm((prev) => ({ ...prev, amount: e.target.value }))}
                    className="w-full pl-14 pr-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1ebcb2]"
                    placeholder="0.00"
                  />
                </div>
              </Field>

              <Field label="Funding Source" required>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {FUNDING_SOURCES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setTopUpForm((prev) => ({ ...prev, source: s.value }))}
                      className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg border-2 text-xs font-medium transition-all ${
                        topUpForm.source === s.value
                          ? 'border-[#1ebcb2] bg-[#1ebcb2]/10 text-[#641f60]'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <s.Icon className="w-4 h-4" />
                      {s.label}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Notes">
                <textarea
                  rows={2}
                  value={topUpForm.notes}
                  onChange={(e) => setTopUpForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="e.g. Weekly capital top-up from head office"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1ebcb2]"
                />
              </Field>

              {topUpError && (
                <div className="p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  {topUpError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeTopUp}
                  className="px-4 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={topUpSubmitting}
                  className="px-6 py-2.5 bg-[#1ebcb2] hover:bg-[#159089] text-white font-medium rounded-lg shadow-lg disabled:opacity-50 flex items-center gap-2"
                >
                  {topUpSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <CheckCircle className="w-5 h-5" />
                  )}
                  Confirm &amp; Add Funds
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Withdraw modal */}
      {withdrawAccount && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#641f60] flex items-center gap-2">
                <Minus className="w-5 h-5" />
                Withdraw Funds
              </h2>
              <button
                type="button"
                onClick={closeWithdraw}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleWithdraw} className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-sm text-slate-500">{floatTypeLabel(withdrawAccount.float_type)}</p>
                <p className="text-lg font-bold text-slate-900">
                  {withdrawAccount.currency} {formatMoney(Number(withdrawAccount.balance || 0))}
                </p>
                <p className="text-xs text-slate-400">Currently in this till</p>
              </div>

              <Field label="Amount to withdraw *">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={Number(withdrawAccount.balance || 0)}
                  required
                  value={withdrawForm.amount}
                  onChange={(e) => setWithdrawForm((p) => ({ ...p, amount: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1ebcb2]"
                />
              </Field>

              <Field label="Destination">
                <div className="grid grid-cols-2 gap-2">
                  {FUNDING_SOURCES.map((src) => {
                    const active = withdrawForm.source === src.value;
                    return (
                      <button
                        key={src.value}
                        type="button"
                        onClick={() => setWithdrawForm((p) => ({ ...p, source: src.value }))}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                          active
                            ? 'border-[#1ebcb2] bg-[#1ebcb2]/10 text-[#641f60] font-medium'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <src.Icon className="w-4 h-4" />
                        {src.label}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field label="Notes">
                <textarea
                  rows={2}
                  value={withdrawForm.notes}
                  onChange={(e) => setWithdrawForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="e.g. banked surplus cash"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1ebcb2]"
                />
              </Field>

              {withdrawError && (
                <div className="p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {withdrawError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeWithdraw}
                  className="px-4 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={withdrawSubmitting}
                  className="px-6 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg disabled:opacity-50 flex items-center gap-2"
                >
                  {withdrawSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Withdrawing...
                    </>
                  ) : (
                    <>
                      <Minus className="w-5 h-5" />
                      Withdraw
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer between tills */}
      {transferFrom && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#641f60] flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5" />
                Move Float
              </h2>
              <button
                type="button"
                onClick={closeTransfer}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTransfer} className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-sm text-slate-500">From: {floatTypeLabel(transferFrom.float_type)}</p>
                <p className="text-lg font-bold text-slate-900">
                  {transferFrom.currency} {formatMoney(Number(transferFrom.balance || 0))}
                </p>
              </div>

              <Field label="Destination till *">
                {transferTargets.length > 0 ? (
                  <select
                    required
                    value={transferToId}
                    onChange={(e) => setTransferToId(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1ebcb2]"
                  >
                    <option value="">Choose a till</option>
                    {transferTargets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {floatTypeLabel(a.float_type)} - {a.currency}{' '}
                        {formatMoney(Number(a.balance || 0))}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-slate-500 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    No other active {transferFrom.currency} till to move funds into. Transfers
                    between different currencies are a forex deal, not a float move.
                  </p>
                )}
              </Field>

              <Field label="Amount *">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={Number(transferFrom.balance || 0)}
                  required
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1ebcb2]"
                />
              </Field>

              <Field label="Notes">
                <textarea
                  rows={2}
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  placeholder="e.g. topping up the M-Pesa till from the drawer"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1ebcb2]"
                />
              </Field>

              {transferError && (
                <div className="p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {transferError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeTransfer}
                  className="px-4 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferSubmitting || transferTargets.length === 0}
                  className="px-6 py-2.5 bg-[#641f60] hover:bg-[#4a1646] text-white font-medium rounded-lg shadow-lg disabled:opacity-50 flex items-center gap-2"
                >
                  {transferSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Moving...
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft className="w-5 h-5" />
                      Move Funds
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Account Details Panel */}
      {selectedAccount && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl shadow-2xl flex flex-col h-full sm:h-auto sm:max-h-[85vh] overflow-hidden">
            {/* Fixed header */}
            <div className="px-4 sm:px-6 py-4 border-b border-[#dae1e1] flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-bold text-[#641f60] flex items-center gap-2">
                <span className="w-9 h-9 rounded-lg bg-[#ee7b22] text-white flex items-center justify-center flex-shrink-0">
                  <FloatTypeIcon type={selectedAccount.float_type} className="w-5 h-5" />
                </span>
                {floatTypeLabel(selectedAccount.float_type)}
              </h2>
              <button
                type="button"
                onClick={() => setSelectedAccount(null)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-5 space-y-4">
              <div className="text-center py-4 bg-slate-50 rounded-xl">
                <div className="flex items-center justify-center gap-2">
                  <CurrencyBadge code={selectedAccount.currency} size={28} />
                  <p className="text-sm text-slate-500">Current Balance</p>
                </div>
                <p className="text-3xl font-bold text-slate-900 mt-1">
                  {selectedAccount.currency} {formatMoney(selectedAccount.balance)}
                </p>
                <span className={`inline-block mt-2 text-xs px-2.5 py-1 rounded-full font-medium ${statusBadgeStyle(selectedAccount.status)}`}>
                  {selectedAccount.status}
                </span>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => openTopUp(selectedAccount)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1ebcb2] hover:bg-[#159089] text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Funds
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Currency</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <CurrencyBadge code={selectedAccount.currency} size={16} />
                    <p className="font-medium text-slate-900">{selectedAccount.currency}</p>
                  </div>
                </div>
                <div>
                  <p className="text-slate-500">Scope</p>
                  <p className="font-medium text-slate-900">
                    {selectedAccount.branch_id ? 'This Branch' : 'Tenant-wide'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Min Threshold</p>
                  <p className="font-medium text-slate-900">
                    {selectedAccount.min_threshold != null
                      ? `${selectedAccount.currency} ${formatMoney(selectedAccount.min_threshold)}`
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Max Threshold</p>
                  <p className="font-medium text-slate-900">
                    {selectedAccount.max_threshold != null
                      ? `${selectedAccount.currency} ${formatMoney(selectedAccount.max_threshold)}`
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Created</p>
                  <p className="font-medium text-slate-900">
                    {new Date(selectedAccount.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Last Updated</p>
                  <p className="font-medium text-slate-900">
                    {new Date(selectedAccount.updated_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {selectedAccount.min_threshold != null &&
                Number(selectedAccount.balance) < Number(selectedAccount.min_threshold) && (
                  <div className="p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    Balance is below the configured minimum threshold.
                  </div>
                )}

              {/* Recent Activity - which customers' transactions actually
                  moved through this float account. */}
              <div className="border-t border-slate-200 pt-4">
                <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-400" />
                  Recent Activity
                </h3>

                {loadingLedger ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-[#641f60]" />
                  </div>
                ) : ledgerError ? (
                  <div className="p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {ledgerError}
                    </span>
                    <button
                      type="button"
                      onClick={() => loadAccountLedger(selectedAccount.id)}
                      className="text-xs font-medium underline flex-shrink-0"
                    >
                      Retry
                    </button>
                  </div>
                ) : accountTransactions.length > 0 ? (
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-72 overflow-y-auto">
                    {accountTransactions.map((t) => {
                      const Icon = ledgerTxIcon(t.transaction_type);
                      const iconClasses = ledgerTxIconClasses(t.transaction_type);
                      const debit = isDebitTx(t.transaction_type);
                      const walletLine = ledgerWalletLabel(t, ledgerWalletLabels);
                      return (
                        <div
                          key={t.id}
                          className="group px-3 py-3 flex items-start gap-2.5 transition-colors duration-150 hover:bg-slate-50"
                        >
                          <div
                            className={`w-8 h-8 rounded-lg ${iconClasses.bg} flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105`}
                          >
                            <Icon className={`w-4 h-4 ${iconClasses.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 capitalize truncate">
                              {t.transaction_type.replace(/_/g, ' ')}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              {ledgerCustomerLabel(t, ledgerCustomerNames)}
                            </p>
                            {/* Only rendered when the movement actually named a
                                wallet. A cash deposit at the counter touches a
                                till and a customer but no wallet, and an empty
                                line there would read as missing data. */}
                            {walletLine && (
                              <p className="text-[11px] text-slate-400 truncate mt-0.5 flex items-center gap-1">
                                <Wallet className="w-3 h-3 flex-shrink-0" />
                                {walletLine}
                              </p>
                            )}
                            {t.reference && (
                              <p className="text-[11px] text-slate-300 font-mono truncate mt-0.5">
                                {t.reference}
                              </p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`text-sm font-semibold whitespace-nowrap tabular-nums ${debit ? 'text-[#c46040]' : 'text-[#1ebcb2]'}`}>
                              {debit ? '\u2212' : '+'}
                              {t.currency} {formatMoney(t.amount)}
                            </p>
                            <div className="flex items-center justify-end gap-1.5 mt-1">
                              <span className="text-[11px] text-slate-400">
                                {new Date(t.created_at).toLocaleDateString()}
                              </span>
                              {ledgerStatusBadge(t.status)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 text-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg">
                    No transactions have moved through this account yet.
                  </div>
                )}
              </div>
            </div>

            {/* Fixed footer. The delete error renders HERE rather than in the
                page-level banner, which sits behind this overlay and would be
                invisible while the panel is open. */}
            <div className="border-t border-[#dae1e1] flex-shrink-0 bg-white">
              {deleteError && (
                <div className="mx-4 sm:mx-6 mt-4 p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span className="flex-1">{deleteError}</span>
                  <button
                    type="button"
                    onClick={() => setDeleteError(null)}
                    className="flex-shrink-0 hover:opacity-70"
                    aria-label="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {confirmDeleteId === selectedAccount.id ? (
                // Two-step confirm: deleting a till sits right next to Edit,
                // and a misclick would otherwise remove it outright.
                <div className="px-4 sm:px-6 py-4 space-y-3">
                  <p className="text-sm text-slate-700">
                    Delete this {floatTypeLabel(selectedAccount.float_type)} till permanently? This
                    cannot be undone.
                  </p>
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={cancelDelete}
                      disabled={deletingId === selectedAccount.id}
                      className="px-4 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50"
                    >
                      Keep it
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(selectedAccount.id)}
                      disabled={deletingId === selectedAccount.id}
                      className="px-6 py-2.5 bg-[#c46040] hover:bg-[#a54d33] text-white font-medium rounded-lg shadow-lg disabled:opacity-50 flex items-center gap-2"
                    >
                      {deletingId === selectedAccount.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          Yes, delete
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4">
                  <button
                    type="button"
                    onClick={() => requestDelete(selectedAccount.id)}
                    disabled={deletingId === selectedAccount.id}
                    className="px-4 py-2.5 border border-[#c46040]/30 text-[#c46040] font-medium rounded-lg hover:bg-[#c46040]/10 disabled:opacity-50 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditForm(selectedAccount)}
                    className="px-6 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg flex items-center gap-2"
                  >
                    <Pencil className="w-4 h-4" />
                    Edit
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}