import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Tables, InsertTables } from '../lib/supabase';
import {
  Plus,
  Search,
  ArrowRightLeft,
  X,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  ShieldAlert,
  Globe,
  Send,
  ChevronDown,
} from 'lucide-react';
import { buildApprovalChain } from '../lib/approvalChain';

type Transaction = Tables<'transactions'>;
type Customer = Tables<'customers'>;
type TransferStatus = Transaction['status'];

// ============================================================================
// Currency system — shared visual language with TransactionsPage /
// WalletsPage / FloatPage. Real national flags as inline SVG (crisp at any
// DPI, no external assets, no emoji rendering issues on Windows/Android).
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
  const clipId = `transfer-flag-clip-${code}`;
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
// Form
// ============================================================================

interface TransferForm {
  from_customer_id: string;
  sender_name: string;
  sender_phone: string;
  receiver_name: string;
  receiver_phone: string;
  destination_country: string;
  amount: string;
  currency: string;
  purpose: string;
  notes: string;
}

const EMPTY_FORM: TransferForm = {
  from_customer_id: '',
  sender_name: '',
  sender_phone: '',
  receiver_name: '',
  receiver_phone: '',
  destination_country: '',
  amount: '',
  currency: 'KES',
  purpose: '',
  notes: '',
};

// Flat transfer fee rate, applied automatically to every transfer created on
// this page — local or international, matching the Transactions module.
// Deducted from the sender's amount (recipient receives amount - fee), and
// is NOT user-editable so it can't be under/over-ridden at the point of
// entry.
const TRANSFER_FEE_RATE = 0.05;

function formatMoney(value: number, currency = 'KES'): string {
  return `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function customerName(c: Customer | undefined | null): string {
  if (!c) return '';
  if (c.customer_type !== 'individual') return c.business_name || 'Unnamed business';
  const name = `${c.first_name || ''} ${c.last_name || ''}`.trim();
  return name || 'Unnamed';
}

const HOME_COUNTRY = 'Kenya'; // institution's home country for is_international detection
const LARGE_TRANSACTION_THRESHOLD = 10000; // fallback; tenant.settings.compliance can override

export function TransfersPage() {
  const { tenant, branch, admin } = useAuth();

  const [transfers, setTransfers] = useState<Transaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TransferStatus>('all');

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<TransferForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const complianceThreshold = useMemo(() => {
    const settings = tenant?.settings as { compliance?: { large_transaction_threshold?: number } } | null;
    return settings?.compliance?.large_transaction_threshold ?? LARGE_TRANSACTION_THRESHOLD;
  }, [tenant]);

  const loadData = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    setLoadError(null);
    try {
      let txQuery = supabase
        .from('transactions')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('transaction_type', 'transfer')
        .order('created_at', { ascending: false });
      if (branch) {
        txQuery = txQuery.eq('branch_id', branch.id);
      }

      const customersQuery = supabase
        .from('customers')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('status', 'active');

      const [txRes, custRes] = await Promise.all([txQuery, customersQuery]);
      if (txRes.error) throw txRes.error;
      if (custRes.error) throw custRes.error;

      setTransfers(txRes.data ?? []);
      setCustomers(custRes.data ?? []);
    } catch (err) {
      console.error('Error loading transfers:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load transfers');
      setTransfers([]);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [tenant, branch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredTransfers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return transfers.filter((t) => {
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      const matchesSearch =
        q === '' ||
        t.reference.toLowerCase().includes(q) ||
        (t.sender_name ?? '').toLowerCase().includes(q) ||
        (t.receiver_name ?? '').toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [transfers, searchQuery, statusFilter]);

  const isInternational = useMemo(() => {
    const dest = formData.destination_country.trim();
    return dest !== '' && dest.toLowerCase() !== HOME_COUNTRY.toLowerCase();
  }, [formData.destination_country]);

  const requiresCompliance = useMemo(() => {
    const amount = parseFloat(formData.amount) || 0;
    return isInternational || amount > complianceThreshold;
  }, [isInternational, formData.amount, complianceThreshold]);

  // Automatic 5% transfer fee — same rule as the Transactions module.
  // Deducted from the sender's amount; the recipient receives amount - fee.
  const parsedAmount = parseFloat(formData.amount) || 0;
  const transferFee = Math.round(parsedAmount * TRANSFER_FEE_RATE * 100) / 100;
  const recipientReceives = Math.max(parsedAmount - transferFee, 0);

  const validateForm = (): string | null => {
    if (!formData.sender_name.trim() && !formData.from_customer_id) {
      return 'Select a sending customer or enter a sender name.';
    }
    if (!formData.receiver_name.trim()) return 'Receiver name is required.';
    const amount = parseFloat(formData.amount);
    if (!formData.amount || Number.isNaN(amount) || amount <= 0) {
      return 'Please enter a valid transfer amount.';
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
      const selectedCustomer = customers.find((c) => c.id === formData.from_customer_id);
      const insert: InsertTables<'transactions'> = {
        tenant_id: tenant.id,
        branch_id: branch?.id ?? null,
        transaction_type: 'transfer',
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        fee_amount: transferFee,
        from_customer_id: formData.from_customer_id || null,
        sender_name: formData.sender_name.trim() || customerName(selectedCustomer) || null,
        sender_phone: formData.sender_phone.trim() || selectedCustomer?.phone || null,
        receiver_name: formData.receiver_name.trim(),
        receiver_phone: formData.receiver_phone.trim() || null,
        destination_country: formData.destination_country.trim() || null,
        purpose: formData.purpose.trim() || null,
        notes: formData.notes.trim() || null,
        is_international: isInternational,
        requires_compliance_check: requiresCompliance,
        created_by: admin.id,
        required_approval_level: requiresCompliance ? 3 : 1,
      };

      const { data: createdTx, error } = await supabase
        .from('transactions')
        .insert(insert)
        .select()
        .maybeSingle();
      if (error) throw error;

      // If this transfer needs multi-level sign-off, generate its approval
      // chain so it shows up on the Approvals page. The transaction row already
      // exists; if the chain fails we surface it rather than hide it.
      if (createdTx && requiresCompliance) {
        try {
          await buildApprovalChain({
            tenantId: tenant.id,
            transactionId: createdTx.id,
            requiredApprovalLevel: createdTx.required_approval_level,
          });
        } catch (chainErr) {
          console.error('Approval chain creation failed:', chainErr);
          setFormError(
            `Transfer ${createdTx.reference} was created, but its approval chain could not be generated. ` +
              'It will need manual review.'
          );
        }
      }

      await loadData();
      closeForm();
    } catch (err) {
      console.error('Error creating transfer:', err);
      setFormError(err instanceof Error ? err.message : 'Failed to create transfer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async (transfer: Transaction) => {
    if (!tenant) return;
    setActioningId(transfer.id);
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', transfer.id)
        .eq('tenant_id', tenant.id);
      if (error) throw error;
      await loadData();
    } catch (err) {
      console.error('Error completing transfer:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to complete transfer');
    } finally {
      setActioningId(null);
    }
  };

  const handleCancel = async (transfer: Transaction) => {
    if (!tenant) return;
    setActioningId(transfer.id);
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ status: 'cancelled' })
        .eq('id', transfer.id)
        .eq('tenant_id', tenant.id);
      if (error) throw error;
      await loadData();
    } catch (err) {
      console.error('Error cancelling transfer:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to cancel transfer');
    } finally {
      setActioningId(null);
    }
  };

  const getStatusBadge = (status: TransferStatus) => {
    const map: Record<TransferStatus, { cls: string; icon: React.ReactNode }> = {
      pending: { cls: 'bg-[#ee7b22]/10 text-[#ee7b22]', icon: <Clock className="w-3.5 h-3.5" /> },
      approved: { cls: 'bg-[#1ebcb2]/10 text-[#1ebcb2]', icon: <CheckCircle className="w-3.5 h-3.5" /> },
      processing: { cls: 'bg-[#ee7b22]/10 text-[#ee7b22]', icon: <Loader2 className="w-3.5 h-3.5" /> },
      completed: { cls: 'bg-[#1ebcb2]/10 text-[#1ebcb2]', icon: <CheckCircle className="w-3.5 h-3.5" /> },
      failed: { cls: 'bg-[#c46040]/10 text-[#c46040]', icon: <XCircle className="w-3.5 h-3.5" /> },
      reversed: { cls: 'bg-slate-100 text-slate-600', icon: <RefreshCw className="w-3.5 h-3.5" /> },
      cancelled: { cls: 'bg-slate-100 text-slate-500', icon: <XCircle className="w-3.5 h-3.5" /> },
    };
    const s = map[status];
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
          <h1 className="text-2xl font-bold text-[#641f60]">Money Transfers</h1>
          <p className="text-slate-600 mt-1">Send and track domestic and international transfers</p>
        </div>
        <button
          onClick={openForm}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all w-full sm:w-auto"
        >
          <Plus className="w-5 h-5" />
          New Transfer
        </button>
      </div>

      <div className="bg-[#641f60]/5 border border-[#641f60]/20 rounded-xl p-3.5 sm:p-4 text-sm text-[#641f60] flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <p>
          Transfers flagged as international or above {formatMoney(complianceThreshold)} require compliance
          review before they can be completed. This page records the transfer and its compliance flag;
          full multi-level approval routing is handled separately once your Approvals workflow is configured.
        </p>
      </div>

      {loadError && (
        <div className="bg-[#c46040]/10 border border-[#c46040]/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-[#c46040]/15 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-6 h-6 text-[#c46040]" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-[#c46040]">Something went wrong</h3>
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

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by reference, sender, or receiver..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Transfer list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#641f60]" />
          </div>
        ) : filteredTransfers.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filteredTransfers.map((transfer) => {
              const canAct = transfer.status === 'pending' || transfer.status === 'approved';
              return (
                <div key={transfer.id} className="px-4 sm:px-6 py-4 hover:bg-slate-50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                        <span className="font-mono text-xs sm:text-sm text-slate-500 truncate">{transfer.reference}</span>
                        {getStatusBadge(transfer.status)}
                        {transfer.is_international && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#641f60]/10 text-[#641f60] text-xs font-medium rounded-full">
                            <Globe className="w-3 h-3" />
                            International
                          </span>
                        )}
                        {transfer.requires_compliance_check && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#c46040]/10 text-[#c46040] text-xs font-medium rounded-full">
                            <ShieldAlert className="w-3 h-3" />
                            Compliance {transfer.compliance_status ?? 'pending'}
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-slate-900 mt-1.5 truncate">
                        {transfer.sender_name || 'Unknown sender'} &rarr; {transfer.receiver_name || 'Unknown receiver'}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <CurrencyBadge code={transfer.currency} size={16} />
                        <p className="text-sm text-slate-600">
                          {formatMoney(transfer.amount, transfer.currency)}
                          {transfer.fee_amount > 0 && ` (+${formatMoney(transfer.fee_amount, transfer.currency)} fee)`}
                          {transfer.destination_country && ` \u2192 ${transfer.destination_country}`}
                        </p>
                      </div>
                      {transfer.purpose && <p className="text-sm text-slate-500 mt-1 truncate">{transfer.purpose}</p>}
                    </div>
                    {canAct && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleComplete(transfer)}
                          disabled={actioningId === transfer.id}
                          className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#1ebcb2] hover:bg-[#641f60] text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                        >
                          {actioningId === transfer.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          Complete
                        </button>
                        <button
                          onClick={() => handleCancel(transfer)}
                          disabled={actioningId === transfer.id}
                          className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Cancel
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
              <ArrowRightLeft className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No transfers found</h3>
            <p className="text-slate-500 text-center max-w-sm">
              {searchQuery || statusFilter !== 'all'
                ? 'No transfers match your search or filter.'
                : 'Create your first money transfer to get started.'}
            </p>
          </div>
        )}
      </div>

      {/* New Transfer Modal — bottom sheet on mobile, centered dialog on desktop,
          fixed header/footer with a scrollable body so it's always reachable
          on short screens, matching the pattern used on Transactions/Customers/
          Wallets. */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl shadow-2xl flex flex-col h-full sm:h-auto sm:max-h-[90vh] overflow-hidden">
            {/* Fixed header */}
            <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg sm:text-xl font-bold text-[#641f60]">New Money Transfer</h2>
              <button
                type="button"
                onClick={closeForm}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable body */}
            <form
              id="new-transfer-form"
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-5 space-y-4"
            >
              <div className="border-b border-slate-200 pb-4">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Sender</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Existing Customer</label>
                    <select
                      value={formData.from_customer_id}
                      onChange={(e) => {
                        const customer = customers.find((c) => c.id === e.target.value);
                        setFormData((prev) => ({
                          ...prev,
                          from_customer_id: e.target.value,
                          sender_name: customer ? customerName(customer) : prev.sender_name,
                          sender_phone: customer?.phone ?? prev.sender_phone,
                        }));
                      }}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    >
                      <option value="">Walk-in / external sender</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {customerName(c)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Sender Name *</label>
                    <input
                      type="text"
                      value={formData.sender_name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, sender_name: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div className="border-b border-slate-200 pb-4">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Receiver</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Receiver Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.receiver_name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, receiver_name: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Receiver Phone</label>
                    <input
                      type="tel"
                      value={formData.receiver_phone}
                      onChange={(e) => setFormData((prev) => ({ ...prev, receiver_phone: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Destination Country</label>
                  <input
                    type="text"
                    value={formData.destination_country}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, destination_country: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    placeholder="Leave blank for domestic transfers"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                  <CurrencySelect
                    value={formData.currency}
                    onChange={(v) => setFormData((prev) => ({ ...prev, currency: v }))}
                  />
                </div>
              </div>

              {/* Automatic 5% fee breakdown — read-only, deducted from the
                  sender's amount. Applies to every transfer, local or
                  international, and can't be edited at entry. */}
              {parsedAmount > 0 && (
                <div className="p-3.5 bg-[#1ebcb2]/5 border border-[#1ebcb2]/20 rounded-lg text-sm space-y-1.5">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Amount Sent</span>
                    <span className="font-medium text-slate-800">
                      {formData.currency} {parsedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Transfer Fee ({(TRANSFER_FEE_RATE * 100).toFixed(0)}%, automatic)</span>
                    <span className="font-medium text-[#ee7b22]">
                      − {formData.currency} {transferFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1.5 border-t border-[#1ebcb2]/20">
                    <span className="font-semibold text-slate-800">Recipient Receives</span>
                    <span className="font-semibold text-[#1ebcb2]">
                      {formData.currency} {recipientReceives.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Purpose</label>
                <input
                  type="text"
                  value={formData.purpose}
                  onChange={(e) => setFormData((prev) => ({ ...prev, purpose: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                />
              </div>

              {requiresCompliance && (
                <div className="p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  This transfer will be flagged for compliance review
                  {isInternational ? ' (international destination)' : ' (amount above threshold)'}.
                </div>
              )}

              {formError && (
                <div className="p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  {formError}
                </div>
              )}
            </form>

            {/* Fixed footer (outside the scroll area so it's always reachable) */}
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
                form="new-transfer-form"
                disabled={submitting}
                className="px-6 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Send Transfer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}