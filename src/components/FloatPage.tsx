import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { FloatAccount } from '../types';
import {
  Receipt,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Loader2,
  RefreshCcw,
  Plus,
  X,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  Building2,
  Landmark,
} from 'lucide-react';

// ============================================================================
// Currency flags (shared visual language with TransactionsPage)
// ============================================================================

const CURRENCIES = ['KES', 'USD', 'SSP', 'UGX', 'TZS', 'EUR', 'GBP'];

const CURRENCY_NAMES: Record<string, string> = {
  USD: 'US Dollar',
  KES: 'Kenyan Shilling',
  SSP: 'South Sudanese Pound',
  UGX: 'Ugandan Shilling',
  TZS: 'Tanzanian Shilling',
  EUR: 'Euro',
  GBP: 'British Pound',
};

// Real national flags rendered as inline SVG, clipped to a circle — same
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
          <span className="hidden sm:inline text-slate-400"> · {CURRENCY_NAMES[value] || value}</span>
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

const FLOAT_TYPES: { value: string; label: string; icon: string }[] = [
  { value: 'cash', label: 'Cash', icon: '💵' },
  { value: 'mpesa', label: 'M-Pesa Till', icon: '📱' },
  { value: 'mtn_momo', label: 'MoMo', icon: '📱' },
  { value: 'bank', label: 'Bank', icon: '🏦' },
  { value: 'safe', label: 'Safe', icon: '🔒' },
  { value: 'vault', label: 'Vault', icon: '🏛️' },
  { value: 'other', label: 'Other', icon: '💰' },
];

const STATUS_OPTIONS: FloatAccount['status'][] = ['active', 'inactive', 'frozen'];

function getFloatIcon(type: string) {
  return FLOAT_TYPES.find((t) => t.value === type)?.icon || '💰';
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
// Form data
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
  const { tenant, branch } = useAuth();

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

  useEffect(() => {
    if (tenant) loadData();
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

  const filteredAccounts = useMemo(() => {
    if (scope === 'all' || !branch) return accounts;
    // Tenant-wide accounts (branch_id null) always surface alongside the
    // current branch's own accounts.
    return accounts.filter((a) => a.branch_id === branch.id || a.branch_id === null);
  }, [accounts, scope, branch]);

  // Per-currency totals instead of one blended `$` figure.
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
      setFormError('No branch context available — choose "Tenant-wide" instead');
      return;
    }

    setSubmitting(true);
    try {
      if (!tenant) throw new Error('Missing tenant');

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

      if (editingId) {
        const { error: updateError } = await supabase
          .from('float_accounts')
          .update(payload as never)
          .eq('id', editingId)
          .eq('tenant_id', tenant.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('float_accounts').insert(payload as never);
        if (insertError) throw insertError;
      }

      await loadData();
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save float account');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!tenant) return;
    setDeletingId(id);
    try {
      const { error: deleteError } = await supabase
        .from('float_accounts')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenant.id);
      if (deleteError) throw deleteError;
      await loadData();
      setSelectedAccount(null);
    } catch (err) {
      console.error('Error deleting float account:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete float account');
    } finally {
      setDeletingId(null);
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

      {/* Per-currency totals — horizontally scrollable on small screens so
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
                <button
                  key={account.id}
                  onClick={() => setSelectedAccount(account)}
                  className="w-full text-left px-4 sm:px-6 py-4 sm:py-6 hover:bg-slate-50 transition-colors flex items-center gap-3 sm:gap-4"
                >
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-[#ee7b22] to-[#c46040] flex items-center justify-center text-white text-xl sm:text-2xl flex-shrink-0">
                    {getFloatIcon(account.float_type)}
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
                  <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0 hidden sm:block" />
                </button>
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
                      <span>{t.icon}</span>
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
                <Field label={editingId ? 'Balance' : 'Opening Balance'} required>
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
                      name="float_scope"
                      checked={formData.scope === 'tenant_wide'}
                      onChange={() => setFormData((prev) => ({ ...prev, scope: 'tenant_wide' }))}
                      className="text-[#641f60] focus:ring-[#1ebcb2]"
                    />
                    <Building2 className="w-4 h-4 text-slate-400" />
                    Tenant-wide (no branch)
                  </label>
                </div>
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

      {/* Account Details Panel */}
      {selectedAccount && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl shadow-2xl flex flex-col h-full sm:h-auto sm:max-h-[85vh] overflow-hidden">
            {/* Fixed header */}
            <div className="px-4 sm:px-6 py-4 border-b border-[#dae1e1] flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-bold text-[#641f60] flex items-center gap-2">
                <span className="text-2xl">{getFloatIcon(selectedAccount.float_type)}</span>
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
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Max Threshold</p>
                  <p className="font-medium text-slate-900">
                    {selectedAccount.max_threshold != null
                      ? `${selectedAccount.currency} ${formatMoney(selectedAccount.max_threshold)}`
                      : '—'}
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
            </div>

            {/* Fixed footer */}
            <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-t border-[#dae1e1] flex-shrink-0 bg-white">
              <button
                type="button"
                onClick={() => handleDelete(selectedAccount.id)}
                disabled={deletingId === selectedAccount.id}
                className="px-4 py-2.5 border border-[#c46040]/30 text-[#c46040] font-medium rounded-lg hover:bg-[#c46040]/10 disabled:opacity-50 flex items-center gap-2"
              >
                {deletingId === selectedAccount.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
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
          </div>
        </div>
      )}
    </div>
  );
}