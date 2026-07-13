import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { InsertTables, Tables } from '../lib/supabase';
import type { Wallet, Customer } from '../types';
import { useCurrency } from '../lib/currency';
import {
  Plus,
  Search,
  Wallet as WalletIcon,
  Banknote,
  Smartphone,
  Landmark,
  CreditCard,
  Coins,
  Eye,
  X,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Ban,
  Phone,
  User,
  Building,
  Building2,
  ChevronDown,
  History,
  ArrowDownRight,
  ArrowUpRight,
  ArrowRightLeft,
  Globe,
  Clock,
  XCircle,
  RotateCcw,
  ShieldCheck,
  Pencil,
  Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ============================================================================
// Currency flags (shared visual language with TransactionsPage / FloatPage)
// ============================================================================

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

function CurrencyBadge({ code, size = 22 }: { code: string; size?: number }) {
  const clipId = `wallet-flag-clip-${code}`;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" role="img" aria-label={`${code} flag`} className="flex-shrink-0">
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

// Generalized to accept an options list, since wallet currencies come from
// the tenant's enabled-currencies config rather than one fixed array.
function CurrencySelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
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
          <span className="hidden sm:inline text-slate-400"> · {CURRENCY_NAMES[value] || value}</span>
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {options.map((c) => (
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

// Searchable customer picker — replaces a plain <option>-per-customer native
// select, which becomes unusable once a tenant has more than a couple dozen
// customers. Shows KYC status inline so staff can see at a glance whether a
// customer is verified before creating a wallet for them.
interface CustomerOption {
  value: string;
  label: string;
  sublabel: string;
  kycStatus: string;
}

function CustomerSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: CustomerOption[];
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = options.find((o) => o.value === value);
  const filtered = options.filter(
    (o) =>
      o.label.toLowerCase().includes(query.toLowerCase()) ||
      o.sublabel.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-left hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] bg-white"
      >
        <span className={`truncate ${selected ? 'text-slate-900' : 'text-slate-400'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0 ml-2" />
      </button>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />

      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          <div className="p-2 border-b border-slate-100 sticky top-0 bg-white">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search customers..."
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1ebcb2]"
            />
          </div>
          {filtered.length > 0 ? (
            filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                  setQuery('');
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between gap-2 ${
                  o.value === value ? 'bg-[#1ebcb2]/10 text-[#641f60] font-medium' : 'text-slate-700'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate">{o.label}</span>
                  <span className="block text-xs text-slate-400 truncate">{o.sublabel}</span>
                </span>
                {o.kycStatus === 'verified' ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#1ebcb2] bg-[#1ebcb2]/10 px-1.5 py-0.5 rounded-full flex-shrink-0">
                    <ShieldCheck className="w-3 h-3" />
                    KYC
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-[#ee7b22] bg-[#ee7b22]/10 px-1.5 py-0.5 rounded-full flex-shrink-0 capitalize">
                    {o.kycStatus}
                  </span>
                )}
              </button>
            ))
          ) : (
            <div className="px-3 py-3 text-sm text-slate-400 text-center">No customers found</div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Wallet constants & helpers
// ============================================================================

type WalletWithCustomer = Wallet & { customer?: Customer | null };
type LedgerTransaction = Tables<'transactions'>;

interface WalletForm {
  customer_id: string;
  wallet_type: string;
  currency: string;
  scope: 'branch' | 'tenant_wide';
}

const WALLET_TYPES: { value: string; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank Account' },
  { value: 'mpesa', label: 'M-Pesa' },
  { value: 'mtn_momo', label: 'MTN Mobile Money' },
  { value: 'digital', label: 'Digital Wallet' },
];

function emptyForm(defaultCurrency: string): WalletForm {
  return {
    customer_id: '',
    wallet_type: 'cash',
    currency: defaultCurrency,
    scope: 'branch',
  };
}

function walletTypeIcon(type: string) {
  switch (type) {
    case 'mpesa':
    case 'mtn_momo':
      return <Smartphone className="w-6 h-6" />;
    case 'bank':
      return <Landmark className="w-6 h-6" />;
    case 'digital':
      return <CreditCard className="w-6 h-6" />;
    case 'cash':
      return <Banknote className="w-6 h-6" />;
    default:
      return <Coins className="w-6 h-6" />;
  }
}

// Distinct brand-color accent per wallet type instead of every card looking
// the same — cash = teal, mobile money = orange, bank = purple, digital/
// other = neutral. Same visual language as the Daily Opening/Closing cards.
function walletAccent(type: string): { border: string; iconBg: string; iconColor: string } {
  if (type === 'cash') return { border: 'border-t-[#1ebcb2]', iconBg: 'bg-[#1ebcb2]/10', iconColor: 'text-[#1ebcb2]' };
  if (type === 'mpesa' || type === 'mtn_momo') return { border: 'border-t-[#ee7b22]', iconBg: 'bg-[#ee7b22]/10', iconColor: 'text-[#ee7b22]' };
  if (type === 'bank') return { border: 'border-t-[#641f60]', iconBg: 'bg-[#641f60]/10', iconColor: 'text-[#641f60]' };
  return { border: 'border-t-slate-300', iconBg: 'bg-slate-100', iconColor: 'text-slate-500' };
}

function customerName(c: Customer | undefined | null): string {
  if (!c) return 'Unknown customer';
  if (c.customer_type !== 'individual') return c.business_name || 'Unnamed business';
  return `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unnamed';
}

function getKycBadge(status: string | undefined) {
  if (!status) return null;
  const map: Record<string, string> = {
    verified: 'bg-[#1ebcb2]/10 text-[#1ebcb2]',
    pending: 'bg-[#ee7b22]/10 text-[#ee7b22]',
    rejected: 'bg-[#c46040]/10 text-[#c46040]',
    expired: 'bg-[#ee7b22]/10 text-[#ee7b22]',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${map[status] || map.pending}`}>
      <ShieldCheck className="w-3 h-3" />
      {status}
    </span>
  );
}

// --- Wallet activity ledger helpers (same treatment as FloatPage) ----------

function ledgerTxIcon(type: string) {
  if (type.includes('deposit') || type.includes('repayment')) return ArrowDownRight;
  if (type.includes('withdrawal') || type.includes('disbursement')) return ArrowUpRight;
  if (type.includes('forex')) return Globe;
  return ArrowRightLeft;
}

function ledgerTxIconClasses(type: string): { bg: string; color: string } {
  if (type.includes('deposit') || type.includes('repayment')) return { bg: 'bg-[#1ebcb2]/10', color: 'text-[#1ebcb2]' };
  if (type.includes('withdrawal') || type.includes('disbursement')) return { bg: 'bg-[#ee7b22]/10', color: 'text-[#ee7b22]' };
  if (type.includes('forex')) return { bg: 'bg-[#641f60]/10', color: 'text-[#641f60]' };
  return { bg: 'bg-slate-100', color: 'text-slate-500' };
}

// Whether this wallet was the money-out side of the transaction — used only
// for the +/- display sign, matching from_wallet_id/to_wallet_id on the row.
function isOutflowForWallet(t: LedgerTransaction, walletId: string): boolean {
  return t.from_wallet_id === walletId;
}

function ledgerStatusBadge(status: string) {
  const map: Record<string, { cls: string; Icon: LucideIcon }> = {
    pending: { cls: 'bg-[#ee7b22]/10 text-[#ee7b22]', Icon: Clock },
    approved: { cls: 'bg-[#1ebcb2]/10 text-[#1ebcb2]', Icon: CheckCircle },
    processing: { cls: 'bg-[#641f60]/10 text-[#641f60]', Icon: Loader2 },
    completed: { cls: 'bg-[#1ebcb2]/10 text-[#1ebcb2]', Icon: CheckCircle },
    failed: { cls: 'bg-[#c46040]/10 text-[#c46040]', Icon: XCircle },
    reversed: { cls: 'bg-slate-100 text-slate-600', Icon: RefreshCw },
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

export function WalletsPage() {
  const { tenant, branch } = useAuth();
  const { format, enabledCurrencies, defaultCurrency } = useCurrency();

  const [allWallets, setAllWallets] = useState<WalletWithCustomer[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Default to "this branch" only when a branch context exists.
  const [scope, setScope] = useState<'branch' | 'all'>(branch ? 'branch' : 'all');

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<WalletForm>(emptyForm(defaultCurrency));

  const [detailWallet, setDetailWallet] = useState<WalletWithCustomer | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Edit + delete — both were missing entirely before (only Create + View
  // existed).
  const [editingWalletId, setEditingWalletId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Activity ledger for whichever wallet is currently open in the detail panel.
  const [walletTransactions, setWalletTransactions] = useState<LedgerTransaction[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);

  const currencyOptions = useMemo(() => {
    const base = enabledCurrencies.length > 0 ? enabledCurrencies : [defaultCurrency];
    return Array.from(new Set([...base, 'KES', 'USD', 'SSP', 'TZS', 'RWF', 'EUR', 'GBP', 'UGX']));
  }, [enabledCurrencies, defaultCurrency]);

  // Resilient fetch: scoped to the tenant only, no hard branch_id filter.
  // Branch scoping happens client-side (see filteredWallets/filteredCustomers)
  // so wallets/customers with a null branch_id (e.g. head-office-managed
  // accounts) never silently vanish from the page.
  const loadData = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [walletsRes, customersRes] = await Promise.all([
        supabase
          .from('wallets')
          .select('*, customer:customers(*)')
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false }),
        supabase.from('customers').select('*').eq('tenant_id', tenant.id).eq('status', 'active'),
      ]);
      if (walletsRes.error) throw walletsRes.error;
      if (customersRes.error) throw customersRes.error;

      setAllWallets((walletsRes.data ?? []) as unknown as WalletWithCustomer[]);
      setAllCustomers((customersRes.data ?? []) as Customer[]);
    } catch (err) {
      console.error('Error loading wallets:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load wallets');
      setAllWallets([]);
      setAllCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time sync: any change to this tenant's wallets (a deposit or
  // withdrawal made from Transactions, another tab, another cashier) reloads
  // the list automatically. If a wallet's detail panel happens to be open,
  // its activity ledger is refreshed too. Requires Realtime enabled for the
  // `wallets` table in Supabase (Database → Replication, or
  // `alter publication supabase_realtime add table wallets;`).
  useEffect(() => {
    if (!tenant) return;
    const channel = supabase
      .channel(`wallets_${tenant.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wallets', filter: `tenant_id=eq.${tenant.id}` },
        () => {
          loadData();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant]);

  // Loads the transactions that actually moved money into or out of this
  // specific wallet (via from_wallet_id / to_wallet_id), so a wallet isn't
  // just a balance number in isolation — mirrors the Float account ledger.
  const loadWalletLedger = useCallback(
    async (walletId: string) => {
      if (!tenant) return;
      setLoadingLedger(true);
      setLedgerError(null);
      try {
        const { data, error: txError } = await supabase
          .from('transactions')
          .select('*')
          .eq('tenant_id', tenant.id)
          .or(`from_wallet_id.eq.${walletId},to_wallet_id.eq.${walletId}`)
          .order('created_at', { ascending: false })
          .limit(50);
        if (txError) throw txError;
        setWalletTransactions((data ?? []) as LedgerTransaction[]);
      } catch (err) {
        console.error('Error loading wallet activity:', err);
        setLedgerError(err instanceof Error ? err.message : 'Failed to load recent activity');
        setWalletTransactions([]);
      } finally {
        setLoadingLedger(false);
      }
    },
    [tenant]
  );

  useEffect(() => {
    if (detailWallet) {
      loadWalletLedger(detailWallet.id);
      setStatusError(null);
      setDeleteError(null);
      setConfirmDeleteId(null);
    } else {
      setWalletTransactions([]);
      setLedgerError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailWallet?.id]);

  // Keeps the open wallet's activity ledger live too — a new transaction
  // landing against this wallet while its detail panel is open shows up
  // immediately instead of only after closing and reopening it.
  useEffect(() => {
    if (!tenant || !detailWallet) return;
    const channel = supabase
      .channel(`wallet_ledger_${detailWallet.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `tenant_id=eq.${tenant.id}` },
        () => {
          loadWalletLedger(detailWallet.id);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant, detailWallet?.id]);

  const inScope = useCallback(
    (branchId: string | null | undefined) => {
      if (scope === 'all' || !branch) return true;
      return branchId === branch.id || branchId == null;
    },
    [scope, branch]
  );

  const wallets = useMemo(() => allWallets.filter((w) => inScope(w.branch_id)), [allWallets, inScope]);
  const customers = useMemo(
    () => allCustomers.filter((c) => inScope(c.branch_id)),
    [allCustomers, inScope]
  );

  const customerOptions: CustomerOption[] = useMemo(
    () =>
      customers.map((c) => ({
        value: c.id,
        label: customerName(c),
        sublabel: `${c.phone}${c.customer_number ? ` · ${c.customer_number}` : ''}`,
        kycStatus: c.kyc_status,
      })),
    [customers]
  );

  const filteredWallets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q === '') return wallets;
    return wallets.filter((w) => {
      const c = w.customer;
      return (
        c?.first_name?.toLowerCase().includes(q) ||
        c?.last_name?.toLowerCase().includes(q) ||
        c?.business_name?.toLowerCase().includes(q) ||
        w.account_number?.toLowerCase().includes(q) ||
        w.currency.toLowerCase().includes(q) ||
        w.wallet_type.toLowerCase().includes(q)
      );
    });
  }, [wallets, searchQuery]);

  // Totals grouped by currency, since summing mixed currencies is meaningless.
  const totalsByCurrency = useMemo(() => {
    const map = new Map<string, { balance: number; available: number; held: number }>();
    for (const w of wallets) {
      const cur = w.currency || defaultCurrency;
      const entry = map.get(cur) ?? { balance: 0, available: 0, held: 0 };
      entry.balance += w.balance || 0;
      entry.available += w.available_balance || 0;
      entry.held += w.held_balance || 0;
      map.set(cur, entry);
    }
    return Array.from(map.entries());
  }, [wallets, defaultCurrency]);

  const validateForm = (): string | null => {
    if (!formData.customer_id) return 'Please select a customer.';
    if (!formData.wallet_type) return 'Please select a wallet type.';
    if (!formData.currency) return 'Please select a currency.';
    if (!editingWalletId && formData.scope === 'branch' && !branch) {
      return 'No branch context available — choose "Tenant-wide" instead.';
    }
    if (editingWalletId) {
      const original = allWallets.find((w) => w.id === editingWalletId);
      if (original && original.currency !== formData.currency && Number(original.balance) !== 0) {
        return `Can't change currency — this wallet still holds a ${original.currency} balance. Move the funds out first.`;
      }
    }
    return null;
  };

  const openForm = () => {
    setEditingWalletId(null);
    setFormData(emptyForm(defaultCurrency));
    setError(null);
    setShowForm(true);
  };

  const openEditForm = (wallet: WalletWithCustomer) => {
    setEditingWalletId(wallet.id);
    setFormData({
      customer_id: wallet.customer_id,
      wallet_type: wallet.wallet_type,
      currency: wallet.currency,
      scope: wallet.branch_id ? 'branch' : 'tenant_wide',
    });
    setError(null);
    setShowForm(true);
    setDetailWallet(null);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingWalletId(null);
    setFormData(emptyForm(defaultCurrency));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!tenant) {
      setError('No institution context found. Please sign in again.');
      return;
    }
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      if (editingWalletId) {
        // Editing never touches balance, customer, or scope — only the
        // account's own configuration. Balance only moves through a tracked
        // transaction; customer and scope are fixed at creation to avoid
        // silently re-pointing an existing account's history.
        const { error: updateError } = await supabase
          .from('wallets')
          .update({
            wallet_type: formData.wallet_type,
            currency: formData.currency,
          } as never)
          .eq('id', editingWalletId)
          .eq('tenant_id', tenant.id);
        if (updateError) throw updateError;
      } else {
        // Insert only typed fields; balances default to 0 at the database
        // level. Opening balances should arrive via a deposit transaction,
        // not a raw wallet insert, so the ledger stays the source of truth.
        const insert: InsertTables<'wallets'> = {
          tenant_id: tenant.id,
          branch_id: formData.scope === 'branch' ? branch?.id ?? null : null,
          customer_id: formData.customer_id,
          wallet_type: formData.wallet_type,
          currency: formData.currency,
          status: 'active',
        };
        const { error: insertError } = await supabase.from('wallets').insert(insert);
        if (insertError) throw insertError;
      }

      await loadData();
      closeForm();
    } catch (err) {
      console.error('Error saving wallet:', err);
      setError(err instanceof Error ? err.message : 'Failed to save wallet');
    } finally {
      setSubmitting(false);
    }
  };

  // Freeze / reactivate / close — the wallet's `status` column already
  // existed and was displayed, but nothing in the UI could ever change it.
  const setWalletStatus = async (wallet: WalletWithCustomer, status: 'active' | 'frozen' | 'closed') => {
    if (!tenant) return;
    setStatusUpdating(true);
    setStatusError(null);
    try {
      const { error: updateError } = await supabase
        .from('wallets')
        .update({ status } as never)
        .eq('id', wallet.id)
        .eq('tenant_id', tenant.id);
      if (updateError) throw updateError;
      await loadData();
      setDetailWallet((prev) => (prev && prev.id === wallet.id ? { ...prev, status } : prev));
    } catch (err) {
      console.error('Error updating wallet status:', err);
      setStatusError(err instanceof Error ? err.message : 'Failed to update wallet status');
    } finally {
      setStatusUpdating(false);
    }
  };

  // Deleting a wallet that still holds funds would make that money
  // disappear from the ledger with no trace — blocked outright. Close
  // (via setWalletStatus) is the right move for a wallet with history but
  // a zero balance that should stop being usable.
  const handleDeleteWallet = async (wallet: WalletWithCustomer) => {
    if (!tenant) return;
    if (Number(wallet.balance) !== 0 || Number(wallet.held_balance) !== 0) {
      setDeleteError(
        `This wallet still holds ${wallet.currency} ${Number(wallet.balance).toLocaleString(undefined, {
          minimumFractionDigits: 2,
        })}. Move the funds out (or use "Close" instead of deleting) before deleting it.`
      );
      setConfirmDeleteId(null);
      return;
    }
    setDeletingId(wallet.id);
    setDeleteError(null);
    try {
      const { error: deleteErr } = await supabase
        .from('wallets')
        .delete()
        .eq('id', wallet.id)
        .eq('tenant_id', tenant.id);
      if (deleteErr) throw deleteErr;
      await loadData();
      setConfirmDeleteId(null);
      if (detailWallet?.id === wallet.id) setDetailWallet(null);
    } catch (err) {
      console.error('Error deleting wallet:', err);
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete wallet');
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { cls: string; icon: React.ReactNode }> = {
      active: { cls: 'bg-[#1ebcb2]/10 text-[#1ebcb2]', icon: <CheckCircle className="w-3.5 h-3.5" /> },
      frozen: { cls: 'bg-[#ee7b22]/10 text-[#ee7b22]', icon: <AlertCircle className="w-3.5 h-3.5" /> },
      closed: { cls: 'bg-slate-100 text-slate-600', icon: <Ban className="w-3.5 h-3.5" /> },
    };
    const s = map[status] || map.active;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium capitalize ${s.cls}`}>
        {s.icon}
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#641f60]">Wallets</h1>
          <p className="text-slate-600 mt-1">Manage customer wallet accounts and balances</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {branch && (
            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
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
            onClick={openForm}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all"
          >
            <Plus className="w-5 h-5" />
            Create Wallet
          </button>
        </div>
      </div>

      {loadError && (
        <div className="bg-[#c46040]/10 border border-[#c46040]/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-[#c46040]/15 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-6 h-6 text-[#c46040]" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-[#c46040]">Couldn&rsquo;t load wallets</h3>
            <p className="text-sm text-slate-600">{loadError}</p>
          </div>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-[#ee7b22] hover:bg-[#c46040] text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {/* Totals by currency — horizontally scrollable on small screens */}
      {totalsByCurrency.length > 0 && (
        <div className="flex gap-4 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:overflow-visible">
          {totalsByCurrency.map(([currency, totals]) => (
            <div
              key={currency}
              className="bg-white rounded-xl border border-slate-200 p-5 flex-shrink-0 w-72 sm:w-auto snap-start"
            >
              <div className="flex items-center gap-3 mb-3">
                <CurrencyBadge code={currency} size={36} />
                <div className="min-w-0">
                  <p className="text-sm text-slate-500">Total Balance ({currency})</p>
                  <p className="text-2xl font-bold text-slate-900 truncate">{format(totals.balance, currency)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm text-slate-500 pt-3 border-t border-slate-100">
                <span>Available: <span className="text-slate-700 font-medium">{format(totals.available, currency)}</span></span>
                <span>Held: <span className="text-slate-700 font-medium">{format(totals.held, currency)}</span></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer, account number, currency, or type..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
          />
        </div>
      </div>

      {/* Delete error banner — shown when a delete was blocked by a
          non-zero balance, or failed outright. */}
      {deleteError && (
        <div className="bg-[#c46040]/10 border border-[#c46040]/30 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[#c46040] flex-shrink-0 mt-0.5" />
          <p className="text-sm text-[#c46040] flex-1">{deleteError}</p>
          <button
            onClick={() => setDeleteError(null)}
            className="text-[#c46040] hover:text-[#641f60] flex-shrink-0"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Wallet cards */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#641f60]" />
          </div>
        ) : filteredWallets.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 p-4 sm:p-6">
            {filteredWallets.map((wallet) => {
              const accent = walletAccent(wallet.wallet_type);
              const confirming = confirmDeleteId === wallet.id;
              return (
                <div
                  key={wallet.id}
                  className={`flex flex-col border border-slate-200 border-t-4 ${accent.border} rounded-xl bg-white shadow-sm hover:shadow-md transition-all overflow-hidden`}
                >
                  <button
                    onClick={() => setDetailWallet(wallet)}
                    className="flex-1 text-left p-4 flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className={`w-11 h-11 rounded-xl ${accent.iconBg} flex items-center justify-center flex-shrink-0`}>
                        <span className={accent.iconColor}>{walletTypeIcon(wallet.wallet_type)}</span>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        {getStatusBadge(wallet.status)}
                        {!wallet.branch_id && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-[#641f60]/10 text-[#641f60]">
                            <Building2 className="w-3 h-3" />
                            Tenant-wide
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="font-semibold text-slate-900 truncate">{customerName(wallet.customer)}</h3>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {getKycBadge(wallet.customer?.kyc_status)}
                        <p className="text-xs text-slate-500 truncate">{wallet.account_number || '—'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-sm text-slate-600">
                      <CurrencyBadge code={wallet.currency} size={16} />
                      <span className="font-medium text-slate-900">{wallet.currency}</span>
                      <span className="text-slate-300">&middot;</span>
                      <span className="capitalize truncate">{wallet.wallet_type.replace(/_/g, ' ')}</span>
                    </div>

                    <div className="mt-auto pt-1">
                      <p className="text-xl font-bold text-slate-900 truncate">
                        {format(wallet.balance, wallet.currency)}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        Available: {format(wallet.available_balance, wallet.currency)}
                      </p>
                    </div>
                  </button>

                  {/* Card actions */}
                  {!confirming ? (
                    <div className="flex items-center gap-1 border-t border-slate-100 px-2 py-2">
                      <button
                        onClick={() => setDetailWallet(wallet)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View
                      </button>
                      <button
                        onClick={() => openEditForm(wallet)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setDeleteError(null);
                          setConfirmDeleteId(wallet.id);
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium text-[#c46040] hover:bg-[#c46040]/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  ) : (
                    <div className="border-t border-[#c46040]/20 bg-[#c46040]/5 px-3 py-2.5 flex items-center justify-between gap-2">
                      <span className="text-xs text-[#c46040] font-medium">Delete this wallet?</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          disabled={deletingId === wallet.id}
                          className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDeleteWallet(wallet)}
                          disabled={deletingId === wallet.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-[#c46040] hover:bg-[#641f60] text-white rounded-md transition-colors disabled:opacity-50"
                        >
                          {deletingId === wallet.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                          Yes, delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <WalletIcon className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No wallets found</h3>
            <p className="text-slate-500 text-center max-w-sm">
              {searchQuery
                ? 'No wallets match your search. Try different criteria.'
                : scope === 'branch'
                ? 'No wallets for this branch. Try "All Branches", or create one.'
                : 'Create wallets for your customers to manage their balances.'}
            </p>
            {!searchQuery && (
              <button
                onClick={openForm}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg transition-colors"
              >
                <Plus className="w-5 h-5" />
                Create First Wallet
              </button>
            )}
          </div>
        )}
      </div>

      {/* Create / Edit Wallet modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl shadow-2xl flex flex-col h-full sm:h-auto sm:max-h-[90vh] overflow-hidden">
            {/* Fixed header */}
            <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg sm:text-xl font-bold text-[#641f60]">
                {editingWalletId ? 'Edit Wallet' : 'Create New Wallet'}
              </h2>
              <button
                onClick={closeForm}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable body */}
            <form
              id="create-wallet-form"
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-5 space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Customer</label>
                {editingWalletId ? (
                  <div className="px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-600 flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="truncate">
                      {customerName(allWallets.find((w) => w.id === editingWalletId)?.customer)}
                    </span>
                  </div>
                ) : (
                  <>
                    <CustomerSelect
                      value={formData.customer_id}
                      onChange={(v) => setFormData((prev) => ({ ...prev, customer_id: v }))}
                      options={customerOptions}
                      placeholder="Search customer..."
                    />
                    {customers.length === 0 && (
                      <p className="text-sm text-[#ee7b22] mt-1">
                        No active customers in this view.{' '}
                        {scope === 'branch' ? 'Try "All Branches", or add a customer first.' : 'Please add a customer first.'}
                      </p>
                    )}
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Wallet Type</label>
                <select
                  value={formData.wallet_type}
                  onChange={(e) => setFormData((prev) => ({ ...prev, wallet_type: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                >
                  {WALLET_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                <CurrencySelect
                  value={formData.currency}
                  onChange={(v) => setFormData((prev) => ({ ...prev, currency: v }))}
                  options={currencyOptions}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Assignment</label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <label className={`flex items-center gap-2 text-sm ${editingWalletId ? 'text-slate-400' : 'text-slate-700'}`}>
                    <input
                      type="radio"
                      name="wallet_scope"
                      checked={formData.scope === 'branch'}
                      disabled={!branch || !!editingWalletId}
                      onChange={() => setFormData((prev) => ({ ...prev, scope: 'branch' }))}
                      className="text-[#641f60] focus:ring-[#1ebcb2]"
                    />
                    <Landmark className="w-4 h-4 text-slate-400" />
                    This Branch{branch ? ` (${branch.name})` : ''}
                  </label>
                  <label className={`flex items-center gap-2 text-sm ${editingWalletId ? 'text-slate-400' : 'text-slate-700'}`}>
                    <input
                      type="radio"
                      name="wallet_scope"
                      checked={formData.scope === 'tenant_wide'}
                      disabled={!!editingWalletId}
                      onChange={() => setFormData((prev) => ({ ...prev, scope: 'tenant_wide' }))}
                      className="text-[#641f60] focus:ring-[#1ebcb2]"
                    />
                    <Building2 className="w-4 h-4 text-slate-400" />
                    Tenant-wide
                  </label>
                </div>
                {editingWalletId && (
                  <p className="text-xs text-slate-400 mt-1">
                    Scope and customer can't be changed after creation — create a new wallet to move to a different branch or customer.
                  </p>
                )}
              </div>

              {!editingWalletId && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500">
                  New wallets open with a zero balance. Fund the wallet with a deposit transaction (Transactions →
                  Deposit) so the movement is recorded in the ledger.
                </div>
              )}

              {error && (
                <div className="p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  {error}
                </div>
              )}
            </form>

            {/* Fixed footer */}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-200 flex-shrink-0 bg-white">
              <button
                type="button"
                onClick={closeForm}
                className="px-4 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="create-wallet-form"
                disabled={submitting || (!editingWalletId && customers.length === 0)}
                className="px-6 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {editingWalletId ? 'Saving...' : 'Creating...'}
                  </>
                ) : editingWalletId ? (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Save Changes
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    Create Wallet
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wallet detail modal */}
      {detailWallet && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl shadow-2xl flex flex-col h-full sm:h-auto sm:max-h-[88vh] overflow-hidden">
            {/* Fixed header */}
            <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg sm:text-xl font-bold text-[#641f60]">Wallet Details</h2>
              <button
                onClick={() => setDetailWallet(null)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-5 space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#641f60] to-[#4a1646] flex items-center justify-center text-white flex-shrink-0">
                  {walletTypeIcon(detailWallet.wallet_type)}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                    {detailWallet.customer?.customer_type && detailWallet.customer.customer_type !== 'individual' ? (
                      <Building className="w-4 h-4 text-slate-400" />
                    ) : (
                      <User className="w-4 h-4 text-slate-400" />
                    )}
                    {customerName(detailWallet.customer)}
                    {getKycBadge(detailWallet.customer?.kyc_status)}
                  </h3>
                  <p className="text-sm text-slate-500">{detailWallet.account_number || 'No account number'}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-lg bg-[#641f60]/5">
                  <p className="text-xs text-slate-500">Balance</p>
                  <p className="text-sm sm:text-base font-bold text-slate-900">{format(detailWallet.balance, detailWallet.currency)}</p>
                </div>
                <div className="p-3 rounded-lg bg-[#1ebcb2]/10">
                  <p className="text-xs text-slate-500">Available</p>
                  <p className="text-sm sm:text-base font-bold text-slate-900">{format(detailWallet.available_balance, detailWallet.currency)}</p>
                </div>
                <div className="p-3 rounded-lg bg-[#ee7b22]/10">
                  <p className="text-xs text-slate-500">Held</p>
                  <p className="text-sm sm:text-base font-bold text-slate-900">{format(detailWallet.held_balance, detailWallet.currency)}</p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Type</span>
                  <span className="text-slate-800 capitalize">{detailWallet.wallet_type.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Currency</span>
                  <span className="text-slate-800 flex items-center gap-1.5">
                    <CurrencyBadge code={detailWallet.currency} size={16} />
                    {detailWallet.currency}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Scope</span>
                  <span className="text-slate-800">{detailWallet.branch_id ? 'This Branch' : 'Tenant-wide'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Status</span>
                  {getStatusBadge(detailWallet.status)}
                </div>
                {detailWallet.customer?.phone && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Customer phone</span>
                    <span className="text-slate-800 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {detailWallet.customer.phone}
                    </span>
                  </div>
                )}
              </div>

              {/* Account status actions — the status column existed and was
                  displayed, but nothing could actually change it before. */}
              <div className="border-t border-slate-200 pt-4">
                <p className="text-xs font-medium text-slate-500 mb-2">Account Status</p>
                <div className="flex flex-wrap gap-2">
                  {detailWallet.status !== 'active' && (
                    <button
                      type="button"
                      onClick={() => setWalletStatus(detailWallet, 'active')}
                      disabled={statusUpdating}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#1ebcb2] hover:bg-[#159089] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reactivate
                    </button>
                  )}
                  {detailWallet.status !== 'frozen' && (
                    <button
                      type="button"
                      onClick={() => setWalletStatus(detailWallet, 'frozen')}
                      disabled={statusUpdating}
                      className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#ee7b22] text-[#ee7b22] hover:bg-[#ee7b22]/10 text-sm font-medium rounded-lg transition-colors disabled:opacity-40"
                    >
                      <AlertCircle className="w-4 h-4" />
                      Freeze
                    </button>
                  )}
                  {detailWallet.status !== 'closed' && (
                    <button
                      type="button"
                      onClick={() => setWalletStatus(detailWallet, 'closed')}
                      disabled={statusUpdating}
                      className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#c46040] text-[#c46040] hover:bg-[#c46040]/10 text-sm font-medium rounded-lg transition-colors disabled:opacity-40"
                    >
                      <Ban className="w-4 h-4" />
                      Close
                    </button>
                  )}
                </div>
                {statusError && (
                  <p className="text-xs text-[#c46040] mt-2 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    {statusError}
                  </p>
                )}
              </div>

              {/* Recent Activity — which transactions actually moved money
                  through this wallet. */}
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
                      onClick={() => loadWalletLedger(detailWallet.id)}
                      className="text-xs font-medium underline flex-shrink-0"
                    >
                      Retry
                    </button>
                  </div>
                ) : walletTransactions.length > 0 ? (
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-64 overflow-y-auto">
                    {walletTransactions.map((t) => {
                      const Icon = ledgerTxIcon(t.transaction_type);
                      const iconClasses = ledgerTxIconClasses(t.transaction_type);
                      const outflow = isOutflowForWallet(t, detailWallet.id);
                      return (
                        <div key={t.id} className="px-3 py-2.5 flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg ${iconClasses.bg} flex items-center justify-center flex-shrink-0`}>
                            <Icon className={`w-4 h-4 ${iconClasses.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 capitalize truncate">
                              {t.transaction_type.replace(/_/g, ' ')}
                            </p>
                            <p className="text-xs text-slate-500 truncate">{t.reference}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`text-sm font-semibold whitespace-nowrap ${outflow ? 'text-[#c46040]' : 'text-[#1ebcb2]'}`}>
                              {outflow ? '\u2212' : '+'}
                              {t.currency} {Number(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                            <div className="flex items-center justify-end gap-1.5 mt-0.5">
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
                    No transactions have moved through this wallet yet.
                  </div>
                )}
              </div>
            </div>

            {/* Fixed footer */}
            <div className="px-4 sm:px-6 py-4 border-t border-slate-200 flex-shrink-0 bg-white">
              {confirmDeleteId === detailWallet.id ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-[#c46040] font-medium">Delete this wallet?</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      disabled={deletingId === detailWallet.id}
                      className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDeleteWallet(detailWallet)}
                      disabled={deletingId === detailWallet.id}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[#c46040] hover:bg-[#641f60] text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      {deletingId === detailWallet.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      Yes, delete
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setDeleteError(null);
                      setConfirmDeleteId(detailWallet.id);
                    }}
                    className="px-4 py-2.5 border border-[#c46040]/30 text-[#c46040] font-medium rounded-lg hover:bg-[#c46040]/10 transition-colors flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                  <button
                    onClick={() => openEditForm(detailWallet)}
                    className="px-4 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
                  >
                    <Pencil className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => setDetailWallet(null)}
                    className="flex-1 px-6 py-2.5 bg-[#641f60] hover:bg-[#4a1646] text-white font-medium rounded-lg transition-colors"
                  >
                    Done
                  </button>
                </div>
              )}
              {deleteError && confirmDeleteId !== detailWallet.id && (
                <p className="text-xs text-[#c46040] mt-2 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {deleteError}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}