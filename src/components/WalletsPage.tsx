import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { InsertTables } from '../lib/supabase';
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
} from 'lucide-react';

// ============================================================================
// Currency flags (shared visual language with TransactionsPage / FloatPage)
// ============================================================================

const CURRENCY_NAMES: Record<string, string> = {
  USD: 'US Dollar',
  KES: 'Kenyan Shilling',
  SSP: 'South Sudanese Pound',
  UGX: 'Ugandan Shilling',
  TZS: 'Tanzanian Shilling',
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

// ============================================================================
// Wallet constants & helpers
// ============================================================================

type WalletWithCustomer = Wallet & { customer?: Customer | null };

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

function customerName(c: Customer | undefined | null): string {
  if (!c) return 'Unknown customer';
  if (c.customer_type !== 'individual') return c.business_name || 'Unnamed business';
  return `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unnamed';
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

  const currencyOptions = useMemo(() => {
    const base = enabledCurrencies.length > 0 ? enabledCurrencies : [defaultCurrency];
    return Array.from(new Set([...base, 'KES', 'USD', 'SSP', 'EUR', 'GBP', 'UGX']));
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
    if (formData.scope === 'branch' && !branch) return 'No branch context available — choose "Tenant-wide" instead.';
    return null;
  };

  const openForm = () => {
    setFormData(emptyForm(defaultCurrency));
    setError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
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
      // Insert only typed fields; balances default to 0 at the database level.
      // Opening balances should arrive via a deposit transaction, not a raw
      // wallet insert, so the ledger stays the source of truth.
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

      await loadData();
      closeForm();
    } catch (err) {
      console.error('Error creating wallet:', err);
      setError(err instanceof Error ? err.message : 'Failed to create wallet');
    } finally {
      setSubmitting(false);
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

      {/* Wallet list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#641f60]" />
          </div>
        ) : filteredWallets.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filteredWallets.map((wallet) => (
              <div key={wallet.id} className="px-4 sm:px-6 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-[#641f60] to-[#4a1646] flex items-center justify-center text-white flex-shrink-0">
                    {walletTypeIcon(wallet.wallet_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 sm:gap-4">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-900 truncate">
                          {customerName(wallet.customer)}
                        </h3>
                        <p className="text-sm text-slate-500 truncate">{wallet.account_number || '—'}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!wallet.branch_id && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#641f60]/10 text-[#641f60]">
                            <Building2 className="w-3 h-3" />
                            Tenant-wide
                          </span>
                        )}
                        {getStatusBadge(wallet.status)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-sm">
                      <span className="text-slate-600 capitalize">
                        {wallet.wallet_type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-slate-300">&middot;</span>
                      <CurrencyBadge code={wallet.currency} size={16} />
                      <span className="font-medium text-slate-900">{wallet.currency}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-base sm:text-lg font-bold text-slate-900 whitespace-nowrap">
                      {format(wallet.balance, wallet.currency)}
                    </p>
                    <p className="text-xs text-slate-500 whitespace-nowrap">
                      Available: {format(wallet.available_balance, wallet.currency)}
                    </p>
                  </div>
                  <button
                    onClick={() => setDetailWallet(wallet)}
                    className="p-2 rounded-lg text-slate-400 hover:text-[#641f60] hover:bg-slate-100 transition-colors flex-shrink-0"
                    aria-label="View wallet"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
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

      {/* Create Wallet modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl shadow-2xl flex flex-col h-full sm:h-auto sm:max-h-[90vh] overflow-hidden">
            {/* Fixed header */}
            <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg sm:text-xl font-bold text-[#641f60]">Create New Wallet</h2>
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Select Customer *</label>
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
                      {c.phone ? ` (${c.phone})` : ''}
                    </option>
                  ))}
                </select>
                {customers.length === 0 && (
                  <p className="text-sm text-[#ee7b22] mt-1">
                    No active customers in this view.{' '}
                    {scope === 'branch' ? 'Try "All Branches", or add a customer first.' : 'Please add a customer first.'}
                  </p>
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
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="wallet_scope"
                      checked={formData.scope === 'branch'}
                      disabled={!branch}
                      onChange={() => setFormData((prev) => ({ ...prev, scope: 'branch' }))}
                      className="text-[#641f60] focus:ring-[#1ebcb2]"
                    />
                    <Landmark className="w-4 h-4 text-slate-400" />
                    This Branch{branch ? ` (${branch.name})` : ''}
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="wallet_scope"
                      checked={formData.scope === 'tenant_wide'}
                      onChange={() => setFormData((prev) => ({ ...prev, scope: 'tenant_wide' }))}
                      className="text-[#641f60] focus:ring-[#1ebcb2]"
                    />
                    <Building2 className="w-4 h-4 text-slate-400" />
                    Tenant-wide
                  </label>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500">
                New wallets open with a zero balance. Fund the wallet with a deposit transaction so the
                movement is recorded in the ledger.
              </div>

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
                disabled={submitting || customers.length === 0}
                className="px-6 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating...
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
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl shadow-2xl flex flex-col h-full sm:h-auto sm:max-h-[85vh] overflow-hidden">
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
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    {detailWallet.customer?.customer_type && detailWallet.customer.customer_type !== 'individual' ? (
                      <Building className="w-4 h-4 text-slate-400" />
                    ) : (
                      <User className="w-4 h-4 text-slate-400" />
                    )}
                    {customerName(detailWallet.customer)}
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
            </div>

            {/* Fixed footer */}
            <div className="px-4 sm:px-6 py-4 border-t border-slate-200 flex-shrink-0 bg-white">
              <button
                onClick={() => setDetailWallet(null)}
                className="w-full px-6 py-2.5 bg-[#641f60] hover:bg-[#4a1646] text-white font-medium rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}