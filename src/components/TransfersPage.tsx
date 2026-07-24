import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Tables } from '../lib/supabase';
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
  Printer,
  Banknote,
  Smartphone,
  Landmark,
  CreditCard,
  FileText,
} from 'lucide-react';
import { buildApprovalChain } from '../lib/approvalChain';
import { buildReceiptData, type ReceiptData } from './TransactionReceipt';
import { VoucherModal, type VoucherExtras } from './TransactionVoucher';

type Transaction = Tables<'transactions'>;
type Customer = Tables<'customers'>;
type FloatAccount = Tables<'float_accounts'>;
type TransferStatus = Transaction['status'];

// ============================================================================
// Error formatting — Supabase/Postgres errors carry code, details and hint that
// were previously discarded. Under RLS a blocked insert can also return
// { data: null, error: null }, which used to surface as a bare
// "Failed to create transfer" with nothing actionable.
// ============================================================================

interface PostgrestLikeError {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

function describeError(err: unknown, fallback: string): string {
  if (!err) return fallback;
  if (typeof err === 'string') return err;

  const e = err as PostgrestLikeError;
  const parts: string[] = [];

  if (e.message) parts.push(e.message);
  if (e.details && e.details !== e.message) parts.push(e.details);
  if (e.hint) parts.push(`Hint: ${e.hint}`);
  if (e.code) parts.push(`[${e.code}]`);

  if (parts.length === 0) {
    if (err instanceof Error && err.message) return err.message;
    return fallback;
  }
  return parts.join(' · ');
}

// Postgres codes that mean "the row was rejected by a policy" rather than
// "the data was malformed". Worth a plain-English explanation.
function explainCode(err: unknown): string | null {
  const code = (err as PostgrestLikeError)?.code;
  switch (code) {
    case '42501':
      return 'The database rejected this operation under row level security. Confirm your admin account is active for this institution and branch.';
    case '23502':
      return 'A required column was left null. One of the transfer fields the database expects was not supplied.';
    case '23503':
      return 'A referenced record does not exist. The customer, branch, till or user linked to this transfer could not be found.';
    case '23514':
      return 'A check constraint rejected this row. If you just added payment methods, confirm migration 011 has been applied.';
    case '22P02':
      return 'A value had the wrong type. This is usually a malformed UUID or number.';
    case 'PGRST202':
      return 'The transfer_create function was not found. Apply migrations 012 and 013, then reload.';
    case 'PGRST204':
      return 'A column in this form does not exist on the transactions table yet. Apply migration 011 and regenerate your database types.';
    default:
      return null;
  }
}

// ============================================================================
// Payment methods — how the sender hands over the money at the counter.
// Each method declares the fields it needs, so the form renders and validates
// itself from this table rather than from scattered conditionals.
// ============================================================================

type PaymentMethod = 'cash' | 'mpesa' | 'bank' | 'card' | 'cheque';

interface PaymentMethodConfig {
  id: PaymentMethod;
  label: string;
  blurb: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string; // text colour
  tint: string; // background tint when selected
  // Fields shown when this method is picked.
  fields: Array<'phone' | 'reference' | 'bank' | 'account_number' | 'account_name' | 'cheque_number'>;
  required: Array<'phone' | 'reference' | 'bank' | 'account_number' | 'account_name' | 'cheque_number'>;
  // Whether the money is in hand the moment the transfer is booked.
  settlesImmediately: boolean;
}

const PAYMENT_METHODS: PaymentMethodConfig[] = [
  {
    id: 'cash',
    label: 'Cash',
    blurb: 'Paid over the counter',
    icon: Banknote,
    accent: 'text-[#1ebcb2]',
    tint: 'bg-[#1ebcb2]/10 border-[#1ebcb2]',
    fields: [],
    required: [],
    settlesImmediately: true,
  },
  {
    id: 'mpesa',
    label: 'M-Pesa',
    blurb: 'Paybill or Send Money',
    icon: Smartphone,
    accent: 'text-[#1ebcb2]',
    tint: 'bg-[#1ebcb2]/10 border-[#1ebcb2]',
    fields: ['phone', 'reference'],
    required: ['phone', 'reference'],
    settlesImmediately: true,
  },
  {
    id: 'bank',
    label: 'Bank',
    blurb: 'Transfer or deposit',
    icon: Landmark,
    accent: 'text-[#641f60]',
    tint: 'bg-[#641f60]/10 border-[#641f60]',
    fields: ['bank', 'account_number', 'account_name', 'reference'],
    required: ['bank', 'account_number'],
    settlesImmediately: false,
  },
  {
    id: 'card',
    label: 'Card',
    blurb: 'Debit or credit',
    icon: CreditCard,
    accent: 'text-[#ee7b22]',
    tint: 'bg-[#ee7b22]/10 border-[#ee7b22]',
    fields: ['reference'],
    required: ['reference'],
    settlesImmediately: true,
  },
  {
    id: 'cheque',
    label: 'Cheque',
    blurb: 'Clears before payout',
    icon: FileText,
    accent: 'text-[#c46040]',
    tint: 'bg-[#c46040]/10 border-[#c46040]',
    fields: ['bank', 'cheque_number', 'account_name'],
    required: ['bank', 'cheque_number'],
    settlesImmediately: false,
  },
];

const PAYMENT_METHOD_MAP: Record<string, PaymentMethodConfig> = PAYMENT_METHODS.reduce(
  (acc, m) => ({ ...acc, [m.id]: m }),
  {} as Record<string, PaymentMethodConfig>
);

const FIELD_LABELS: Record<string, string> = {
  phone: 'M-Pesa Phone Number',
  reference: 'Payment Reference',
  bank: 'Bank Name',
  account_number: 'Account Number',
  account_name: 'Account Name',
  cheque_number: 'Cheque Number',
};

const FIELD_PLACEHOLDERS: Record<string, string> = {
  phone: '07XX XXX XXX',
  reference: 'e.g. SLK4H2QW9P',
  bank: 'e.g. Equity Bank',
  account_number: 'Account the funds came from',
  account_name: 'Name on the account',
  cheque_number: 'Cheque serial number',
};

// Common Kenyan banks, offered as a datalist so the field stays free-text for
// anything not on the list.
const COMMON_BANKS = [
  'Equity Bank',
  'KCB Bank',
  'Co-operative Bank',
  'NCBA Bank',
  'Absa Bank Kenya',
  'Standard Chartered',
  'Diamond Trust Bank',
  'I&M Bank',
  'Family Bank',
  'Stanbic Bank',
  'National Bank of Kenya',
  'Bank of South Sudan',
];

function PaymentMethodChip({ method }: { method: string | null | undefined }) {
  if (!method) return null;
  const cfg = PAYMENT_METHOD_MAP[method];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-medium rounded">
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

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
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-2 pl-3 pr-3 py-3 sm:py-2.5 border border-slate-300 rounded-lg bg-white text-left hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1ebcb2]"
      >
        <CurrencyBadge code={value} />
        <span className="flex-1 min-w-0 truncate text-slate-900">
          <span className="font-medium">{value}</span>
          <span className="hidden xs:inline text-slate-400"> · {CURRENCY_NAMES[value] || value}</span>
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto overscroll-contain">
          {CURRENCIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-slate-50 ${
                c === value ? 'bg-[#1ebcb2]/10' : ''
              }`}
            >
              <CurrencyBadge code={c} size={20} />
              <span
                className={
                  c === value
                    ? 'text-[#641f60] font-medium flex-shrink-0'
                    : 'text-slate-700 flex-shrink-0'
                }
              >
                {c}
              </span>
              <span className="text-slate-400 truncate min-w-0">{CURRENCY_NAMES[c] || ''}</span>
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
  sender_address: string;
  sender_id_number: string;
  receiver_name: string;
  receiver_phone: string;
  receiver_city: string;
  destination_country: string;
  amount: string;
  currency: string;
  purpose: string;
  notes: string;
  float_account_id: string;
  payment_method: PaymentMethod;
  payment_phone: string;
  payment_reference: string;
  payment_bank_name: string;
  payment_account_number: string;
  payment_account_name: string;
  payment_cheque_number: string;
}

const EMPTY_FORM: TransferForm = {
  from_customer_id: '',
  sender_name: '',
  sender_phone: '',
  sender_address: '',
  sender_id_number: '',
  receiver_name: '',
  receiver_phone: '',
  receiver_city: '',
  destination_country: '',
  amount: '',
  currency: 'KES',
  purpose: '',
  notes: '',
  float_account_id: '',
  payment_method: 'cash',
  payment_phone: '',
  payment_reference: '',
  payment_bank_name: '',
  payment_account_number: '',
  payment_account_name: '',
  payment_cheque_number: '',
};

// Flat transfer fee rate, applied automatically to every transfer created on
// this page — local or international, matching the Transactions module.
// Deducted from the sender's amount (recipient receives amount - fee), and
// is NOT user-editable so it can't be under/over-ridden at the point of
// entry.
const TRANSFER_FEE_RATE = 0.05;

function formatMoney(value: number, currency = 'KES'): string {
  return `${currency} ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Compact form for the summary tiles, which are very tight on a 360px screen.
function formatCompactMoney(value: number, currency = 'KES'): string {
  const n = Number(value || 0);
  if (Math.abs(n) >= 1_000_000) return `${currency} ${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 10_000) return `${currency} ${(n / 1_000).toFixed(1)}K`;
  return formatMoney(n, currency);
}

function customerName(c: Customer | undefined | null): string {
  if (!c) return '';
  if (c.customer_type !== 'individual') return c.business_name || 'Unnamed business';
  const name = `${c.first_name || ''} ${c.last_name || ''}`.trim();
  return name || 'Unnamed';
}

// Normalises 07XX / 01XX / +254 / 254 into the 2547XXXXXXXX form used by
// Daraja, so references reconcile against the M-Pesa statement.
function normalizeKenyanPhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (!digits) return null;
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  if (/^0[17]\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^[17]\d{8}$/.test(digits)) return `254${digits}`;
  return null;
}

const HOME_COUNTRY = 'Kenya'; // institution's home country for is_international detection
const LARGE_TRANSACTION_THRESHOLD = 10000; // fallback; tenant.settings.compliance can override

export function TransfersPage() {
  const { tenant, branch, admin } = useAuth();

  const [transfers, setTransfers] = useState<Transaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [floatAccounts, setFloatAccounts] = useState<FloatAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TransferStatus>('all');
  const [methodFilter, setMethodFilter] = useState<'all' | PaymentMethod>('all');

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<TransferForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formErrorHint, setFormErrorHint] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  // Remittance voucher — auto-opens after a transfer is created, and can be
  // reopened for any existing transfer via the Voucher action on its row.
  const [voucher, setVoucher] = useState<{ data: ReceiptData; extras: VoucherExtras } | null>(null);

  // Lock background scroll while the sheet is open, otherwise on mobile the
  // page behind scrolls under the modal when the body reaches its end.
  useEffect(() => {
    if (!showForm && !voucher) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [showForm, voucher]);

  const complianceThreshold = useMemo(() => {
    const settings = tenant?.settings as { compliance?: { large_transaction_threshold?: number } } | null;
    const stored = settings?.compliance?.large_transaction_threshold;
    // A stored 0 must fall back to the default; ?? alone would keep the 0 and
    // flag every transfer for compliance review.
    return stored && stored > 0 ? stored : LARGE_TRANSACTION_THRESHOLD;
  }, [tenant]);

  // Institution details printed in the voucher header. Stored on the tenant
  // record (Settings > General), so each institution prints its own.
  const institutionDetails = useMemo(() => {
    const settings = tenant?.settings as
      | { address?: string | null; phone?: string | null; branding?: { logo_url?: string | null } }
      | null;
    return {
      address: settings?.address ?? null,
      phone: settings?.phone ?? null,
      logoUrl: settings?.branding?.logo_url ?? null,
    };
  }, [tenant]);

  // Builds the voucher from a REAL transactions row (freshly created or
  // stored), so everything printed comes from the database.
  const openVoucherForTransfer = useCallback(
    (tx: Transaction) => {
      if (!tenant) return;
      const data = buildReceiptData({
        institutionName: tenant.name,
        institutionLogoUrl: institutionDetails.logoUrl,
        branchName: branch?.name ?? null,
        transactionId: tx.id,
        reference: tx.reference,
        transactionType: tx.transaction_type,
        status: tx.status,
        createdAtIso: tx.created_at,
        senderName: tx.sender_name,
        senderPhone: tx.sender_phone,
        receiverName: tx.receiver_name,
        receiverPhone: tx.receiver_phone,
        amount: tx.amount,
        currency: tx.currency,
        chargesAmount: tx.fee_amount,
        chargesCurrency: tx.fee_currency ?? tx.currency,
        exchangeRate: tx.exchange_rate,
        cashierName: admin?.full_name ?? null,
      });

      // Payment collection details, printed under the amounts on the voucher.
      const methodCfg = tx.payment_method ? PAYMENT_METHOD_MAP[tx.payment_method] : null;
      const paymentLines: string[] = [];
      if (tx.payment_phone) paymentLines.push(`Phone: ${tx.payment_phone}`);
      if (tx.payment_bank_name) paymentLines.push(`Bank: ${tx.payment_bank_name}`);
      if (tx.payment_account_number) paymentLines.push(`Account: ${tx.payment_account_number}`);
      if (tx.payment_account_name) paymentLines.push(`Account Name: ${tx.payment_account_name}`);
      if (tx.payment_cheque_number) paymentLines.push(`Cheque No: ${tx.payment_cheque_number}`);

      const extras: VoucherExtras = {
        institutionAddress: institutionDetails.address,
        institutionPhone: institutionDetails.phone,
        senderAddress: tx.sender_address,
        senderIdNumber: tx.sender_id_number,
        receiverCity: tx.receiver_city,
        receiverCountry: tx.destination_country,
        purpose: tx.purpose,
        conductor: admin?.full_name ?? null,
        paymentMethod: methodCfg?.label ?? tx.payment_method ?? null,
        paymentReference: tx.payment_reference ?? null,
        paymentDetails: paymentLines.length > 0 ? paymentLines.join(' · ') : null,
        paymentStatus: tx.payment_status ?? null,
      };
      setVoucher({ data, extras });
    },
    [tenant, branch, admin, institutionDetails]
  );

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
      if (branch) txQuery = txQuery.eq('branch_id', branch.id);

      const customersQuery = supabase
        .from('customers')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('status', 'active');

      let floatQuery = supabase
        .from('float_accounts')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('status', 'active');
      if (branch) floatQuery = floatQuery.eq('branch_id', branch.id);

      const [txRes, custRes, floatRes] = await Promise.all([txQuery, customersQuery, floatQuery]);
      if (txRes.error) throw txRes.error;
      if (custRes.error) throw custRes.error;
      if (floatRes.error) throw floatRes.error;

      setTransfers(txRes.data ?? []);
      setCustomers(custRes.data ?? []);
      setFloatAccounts(floatRes.data ?? []);
    } catch (err) {
      console.error('Error loading transfers:', err);
      setLoadError(describeError(err, 'Failed to load transfers'));
      setTransfers([]);
      setCustomers([]);
      setFloatAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [tenant, branch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Volume and exposure across the transfers currently loaded.
  const summary = useMemo(() => {
    const pending = transfers.filter(
      (t) => t.status === 'pending' || t.status === 'approved' || t.status === 'processing'
    );
    const completed = transfers.filter((t) => t.status === 'completed');
    const flagged = transfers.filter(
      (t) => t.requires_compliance_check && t.compliance_status !== 'cleared'
    );
    const international = transfers.filter((t) => t.is_international);
    const awaitingFunds = transfers.filter(
      (t) => t.payment_status === 'pending' && t.status !== 'cancelled' && t.status !== 'failed'
    );

    // Value is only summed within a currency; a mixed total would be
    // meaningless. Falls back to counting when the book spans several.
    const currencies = new Set(transfers.map((t) => t.currency));
    const singleCurrency = currencies.size === 1 ? Array.from(currencies)[0] : null;
    const pendingValue = singleCurrency
      ? pending.reduce((sum, t) => sum + Number(t.amount || 0), 0)
      : null;
    const feesEarned = singleCurrency
      ? completed.reduce((sum, t) => sum + Number(t.fee_amount || 0), 0)
      : null;

    // Split by collection channel, so the counter can reconcile at close.
    const byMethod: Record<string, { count: number; value: number }> = {};
    for (const t of transfers) {
      const key = t.payment_method ?? 'unspecified';
      if (!byMethod[key]) byMethod[key] = { count: 0, value: 0 };
      byMethod[key].count += 1;
      byMethod[key].value += Number(t.amount || 0);
    }

    return {
      pendingCount: pending.length,
      pendingValue,
      completedCount: completed.length,
      feesEarned,
      flaggedCount: flagged.length,
      internationalCount: international.length,
      awaitingFundsCount: awaitingFunds.length,
      byMethod,
      singleCurrency,
    };
  }, [transfers]);

  const filteredTransfers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return transfers.filter((t) => {
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      const matchesMethod = methodFilter === 'all' || t.payment_method === methodFilter;
      const matchesSearch =
        q === '' ||
        (t.reference ?? '').toLowerCase().includes(q) ||
        (t.sender_name ?? '').toLowerCase().includes(q) ||
        (t.receiver_name ?? '').toLowerCase().includes(q) ||
        (t.payment_reference ?? '').toLowerCase().includes(q);
      return matchesStatus && matchesMethod && matchesSearch;
    });
  }, [transfers, searchQuery, statusFilter, methodFilter]);

  const isInternational = useMemo(() => {
    const dest = formData.destination_country.trim();
    return dest !== '' && dest.toLowerCase() !== HOME_COUNTRY.toLowerCase();
  }, [formData.destination_country]);

  const requiresCompliance = useMemo(() => {
    const amount = parseFloat(formData.amount) || 0;
    return isInternational || amount > complianceThreshold;
  }, [isInternational, formData.amount, complianceThreshold]);

  const selectedMethod = PAYMENT_METHOD_MAP[formData.payment_method] ?? PAYMENT_METHODS[0];

  // Tills that hold the transfer's currency — money can only be paid from a
  // till of the matching currency.
  const eligibleFloats = useMemo(
    () => floatAccounts.filter((f) => f.currency === formData.currency),
    [floatAccounts, formData.currency]
  );

  // Default the till when currency changes or the form opens.
  useEffect(() => {
    if (!showForm) return;
    if (formData.float_account_id && eligibleFloats.some((f) => f.id === formData.float_account_id))
      return;
    setFormData((prev) => ({ ...prev, float_account_id: eligibleFloats[0]?.id ?? '' }));
  }, [showForm, eligibleFloats, formData.float_account_id]);

  // Automatic 5% transfer fee — same rule as the Transactions module.
  // Deducted from the sender's amount; the recipient receives amount - fee.
  const parsedAmount = parseFloat(formData.amount) || 0;
  const transferFee = Math.round(parsedAmount * TRANSFER_FEE_RATE * 100) / 100;
  const recipientReceives = Math.max(parsedAmount - transferFee, 0);

  // Reads a payment field out of the form by its config key.
  const paymentFieldValue = (field: string): string => {
    switch (field) {
      case 'phone':
        return formData.payment_phone;
      case 'reference':
        return formData.payment_reference;
      case 'bank':
        return formData.payment_bank_name;
      case 'account_number':
        return formData.payment_account_number;
      case 'account_name':
        return formData.payment_account_name;
      case 'cheque_number':
        return formData.payment_cheque_number;
      default:
        return '';
    }
  };

  const setPaymentFieldValue = (field: string, value: string) => {
    const key = ({
      phone: 'payment_phone',
      reference: 'payment_reference',
      bank: 'payment_bank_name',
      account_number: 'payment_account_number',
      account_name: 'payment_account_name',
      cheque_number: 'payment_cheque_number',
    } as Record<string, keyof TransferForm>)[field];
    if (!key) return;
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const validateForm = (): string | null => {
    if (!formData.sender_name.trim() && !formData.from_customer_id) {
      return 'Select a sending customer or enter a sender name.';
    }
    if (!formData.receiver_name.trim()) return 'Receiver name is required.';
    const amount = parseFloat(formData.amount);
    if (!formData.amount || Number.isNaN(amount) || amount <= 0) {
      return 'Please enter a valid transfer amount.';
    }
    if (!formData.float_account_id) {
      return `No active till found for ${formData.currency}. Open or top up a ${formData.currency} float account first.`;
    }

    // Each method carries its own required fields.
    for (const field of selectedMethod.required) {
      if (!paymentFieldValue(field).trim()) {
        return `${FIELD_LABELS[field]} is required for ${selectedMethod.label} payments.`;
      }
    }

    if (formData.payment_method === 'mpesa') {
      if (!normalizeKenyanPhone(formData.payment_phone)) {
        return 'Enter a valid M-Pesa phone number, for example 0712345678.';
      }
      if (formData.payment_reference.trim().length < 6) {
        return 'Enter the full M-Pesa confirmation code, for example SLK4H2QW9P.';
      }
    }

    return null;
  };

  const openForm = () => {
    setFormData(EMPTY_FORM);
    setFormError(null);
    setFormErrorHint(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setFormData(EMPTY_FORM);
    setFormError(null);
    setFormErrorHint(null);
  };

  // Switching method clears the fields belonging to the old one, so a stale
  // cheque number can't ride along on an M-Pesa transfer.
  const selectPaymentMethod = (method: PaymentMethod) => {
    setFormData((prev) => ({
      ...prev,
      payment_method: method,
      payment_phone: method === 'mpesa' ? prev.payment_phone || prev.sender_phone : '',
      payment_reference: method === 'cash' ? '' : prev.payment_reference,
      payment_bank_name: method === 'bank' || method === 'cheque' ? prev.payment_bank_name : '',
      payment_account_number: method === 'bank' ? prev.payment_account_number : '',
      payment_account_name:
        method === 'bank' || method === 'cheque' ? prev.payment_account_name : '',
      payment_cheque_number: method === 'cheque' ? prev.payment_cheque_number : '',
    }));
    setFormError(null);
    setFormErrorHint(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormErrorHint(null);

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
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user?.id) {
        setFormError('Your session has expired. Please sign in again.');
        setSubmitting(false);
        return;
      }

      const selectedCustomer = customers.find((c) => c.id === formData.from_customer_id);
      const normalizedPayPhone =
        formData.payment_method === 'mpesa' ? normalizeKenyanPhone(formData.payment_phone) : null;

      // process_transaction (via transfer_create) does the money movement:
      // float debit + double-entry journal. Cash / M-Pesa / card move the
      // float now; bank / cheque defer it until Funds In is pressed.
      const { data: createdTx, error } = await supabase.rpc('transfer_create', {
        p_tenant_id: tenant.id,
        p_branch_id: branch?.id ?? null,
        p_amount: parseFloat(formData.amount),
        p_currency: formData.currency,
        p_fee_amount: transferFee,
        p_from_customer_id: formData.from_customer_id || null,
        p_sender_name: formData.sender_name.trim() || customerName(selectedCustomer) || null,
        p_sender_phone: formData.sender_phone.trim() || selectedCustomer?.phone || null,
        p_sender_address: formData.sender_address.trim() || selectedCustomer?.address || null,
        p_sender_id_number:
          formData.sender_id_number.trim() || selectedCustomer?.id_number || null,
        p_receiver_name: formData.receiver_name.trim(),
        p_receiver_phone: formData.receiver_phone.trim() || null,
        p_receiver_city: formData.receiver_city.trim() || null,
        p_destination_country: formData.destination_country.trim() || null,
        p_is_international: isInternational,
        p_requires_compliance_check: requiresCompliance,
        p_required_approval_level: requiresCompliance ? 3 : 1,
        p_purpose: formData.purpose.trim() || null,
        p_notes: formData.notes.trim() || null,
        p_float_account_id: formData.float_account_id,
        p_payment_method: formData.payment_method,
        p_payment_reference: formData.payment_reference.trim() || null,
        p_payment_phone: normalizedPayPhone ?? (formData.payment_phone.trim() || null),
        p_payment_bank_name: formData.payment_bank_name.trim() || null,
        p_payment_account_number: formData.payment_account_number.trim() || null,
        p_payment_account_name: formData.payment_account_name.trim() || null,
        p_payment_cheque_number: formData.payment_cheque_number.trim() || null,
        p_payment_status: selectedMethod.settlesImmediately ? 'received' : 'pending',
      });

      if (error) {
        console.error('transfer_create rejected:', error);
        setFormError(describeError(error, 'Failed to create transfer'));
        setFormErrorHint(explainCode(error));
        setSubmitting(false);
        return;
      }

      const tx = (createdTx as Transaction | null) ?? null;
      if (!tx) {
        setFormError('The transfer was not saved. No record came back from the server.');
        setFormErrorHint(
          'Confirm your admin account is active for this institution and that the till belongs to it.'
        );
        setSubmitting(false);
        return;
      }

      // If this transfer needs multi-level sign-off, generate its approval
      // chain so it shows up on the Approvals page. The transaction row already
      // exists; if the chain fails we surface it rather than hide it.
      if (requiresCompliance) {
        try {
          await buildApprovalChain({
            tenantId: tenant.id,
            transactionId: tx.id,
            requiredApprovalLevel: tx.required_approval_level,
          });
        } catch (chainErr) {
          console.error('Approval chain creation failed:', chainErr);
          setLoadError(
            `Transfer ${tx.reference} was created, but its approval chain could not be generated. ` +
              'It will need manual review.'
          );
        }
      }

      await loadData();
      closeForm();

      // Print the voucher straight from the row the database returned, so the
      // reference and every printed field come from the stored record.
      openVoucherForTransfer(tx);
    } catch (err) {
      console.error('Error creating transfer:', err);
      setFormError(describeError(err, 'Failed to create transfer'));
      setFormErrorHint(explainCode(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Bank transfer or cheque has cleared: debit the till by amount + fee and
  // post the journal, via transfer_mark_funds_received.
  const handleMarkFundsReceived = async (transfer: Transaction) => {
    if (!tenant) return;
    setActioningId(transfer.id);
    setLoadError(null);
    try {
      const floatId =
        (transfer as Transaction & { float_account_id?: string }).float_account_id ||
        floatAccounts.find((f) => f.currency === transfer.currency)?.id;
      if (!floatId) {
        throw new Error(
          `No active ${transfer.currency} till to receive these funds into. Open or top up one first.`
        );
      }
      const { error } = await supabase.rpc('transfer_mark_funds_received', {
        p_transaction_id: transfer.id,
        p_float_account_id: floatId,
      });
      if (error) throw error;
      await loadData();
    } catch (err) {
      console.error('Error marking funds received:', err);
      setLoadError(describeError(err, 'Failed to update payment status'));
    } finally {
      setActioningId(null);
    }
  };

  const handleComplete = async (transfer: Transaction) => {
    if (!tenant) return;

    // Do not release a payout against money that has not landed.
    if (transfer.payment_status === 'pending') {
      setLoadError(
        `Funds for ${transfer.reference} have not been confirmed yet. Mark the payment as received first.`
      );
      return;
    }

    setActioningId(transfer.id);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', transfer.id)
        .eq('tenant_id', tenant.id)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error(
          'The transfer was not updated. Your account may not have permission to complete it.'
        );
      }
      await loadData();
    } catch (err) {
      console.error('Error completing transfer:', err);
      setLoadError(describeError(err, 'Failed to complete transfer'));
    } finally {
      setActioningId(null);
    }
  };

  const handleCancel = async (transfer: Transaction) => {
    if (!tenant) return;
    setActioningId(transfer.id);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .update({ status: 'cancelled' })
        .eq('id', transfer.id)
        .eq('tenant_id', tenant.id)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error(
          'The transfer was not updated. Your account may not have permission to cancel it.'
        );
      }
      await loadData();
    } catch (err) {
      console.error('Error cancelling transfer:', err);
      setLoadError(describeError(err, 'Failed to cancel transfer'));
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
    const s = map[status] ?? map.pending;
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-medium capitalize flex-shrink-0 ${s.cls}`}
      >
        {s.icon}
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-[#641f60]">Money Transfers</h1>
          <p className="text-sm sm:text-base text-slate-600 mt-1">
            Send and track domestic and international transfers
          </p>
        </div>
        <button
          onClick={openForm}
          className="inline-flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all w-full sm:w-auto flex-shrink-0"
        >
          <Plus className="w-5 h-5" />
          New Transfer
        </button>
      </div>

      <div className="bg-[#641f60]/5 border border-[#641f60]/20 rounded-xl px-3.5 sm:px-4 py-3 text-xs sm:text-sm text-[#641f60] flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>
          International transfers and any above {formatMoney(complianceThreshold)} need compliance
          review before completion.
        </p>
      </div>

      {loadError && (
        <div className="bg-[#c46040]/10 border border-[#c46040]/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="w-11 h-11 rounded-full bg-[#c46040]/15 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-6 h-6 text-[#c46040]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-[#c46040]">Something went wrong</h3>
            <p className="text-sm text-slate-600 break-words">{loadError}</p>
          </div>
          <button
            onClick={loadData}
            className="px-4 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 flex-shrink-0"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {!loading && transfers.length > 0 && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="group bg-white rounded-xl border border-slate-200 p-3.5 sm:p-5 transition-all duration-200 hover:shadow-lg hover:shadow-slate-200/60 sm:hover:-translate-y-0.5 hover:border-[#ee7b22]/40">
              <div className="flex items-center justify-between mb-2.5 sm:mb-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[#ee7b22]/10 flex items-center justify-center transition-colors group-hover:bg-[#ee7b22]/20">
                  <Clock className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-[#ee7b22]" />
                </div>
              </div>
              <p className="text-[11px] sm:text-xs font-medium text-slate-500 mb-1">In flight</p>
              <p className="text-xl sm:text-2xl font-bold text-[#ee7b22] tabular-nums">
                {summary.pendingCount}
              </p>
              {summary.pendingValue !== null && summary.singleCurrency && (
                <p className="text-[10px] sm:text-[11px] text-slate-400 mt-1 tabular-nums truncate">
                  {formatCompactMoney(summary.pendingValue, summary.singleCurrency)}
                </p>
              )}
            </div>

            <div className="group bg-white rounded-xl border border-slate-200 p-3.5 sm:p-5 transition-all duration-200 hover:shadow-lg hover:shadow-slate-200/60 sm:hover:-translate-y-0.5 hover:border-[#1ebcb2]/40">
              <div className="flex items-center justify-between mb-2.5 sm:mb-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[#1ebcb2]/10 flex items-center justify-center transition-colors group-hover:bg-[#1ebcb2]/20">
                  <CheckCircle className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-[#1ebcb2]" />
                </div>
              </div>
              <p className="text-[11px] sm:text-xs font-medium text-slate-500 mb-1">Completed</p>
              <p className="text-xl sm:text-2xl font-bold text-[#159089] tabular-nums">
                {summary.completedCount}
              </p>
              {summary.feesEarned !== null && summary.singleCurrency && (
                <p className="text-[10px] sm:text-[11px] text-slate-400 mt-1 tabular-nums truncate">
                  {formatCompactMoney(summary.feesEarned, summary.singleCurrency)} in fees
                </p>
              )}
            </div>

            <div className="group bg-white rounded-xl border border-slate-200 p-3.5 sm:p-5 transition-all duration-200 hover:shadow-lg hover:shadow-slate-200/60 sm:hover:-translate-y-0.5 hover:border-[#c46040]/40">
              <div className="flex items-center justify-between mb-2.5 sm:mb-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[#c46040]/10 flex items-center justify-center transition-colors group-hover:bg-[#c46040]/20">
                  <Banknote className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-[#c46040]" />
                </div>
              </div>
              <p className="text-[11px] sm:text-xs font-medium text-slate-500 mb-1">
                Awaiting funds
              </p>
              <p className="text-xl sm:text-2xl font-bold text-[#c46040] tabular-nums">
                {summary.awaitingFundsCount}
              </p>
              <p className="text-[10px] sm:text-[11px] text-slate-400 mt-1 truncate">
                {summary.flaggedCount} in compliance
              </p>
            </div>

            <div className="group bg-white rounded-xl border border-slate-200 p-3.5 sm:p-5 transition-all duration-200 hover:shadow-lg hover:shadow-slate-200/60 sm:hover:-translate-y-0.5 hover:border-[#641f60]/30">
              <div className="flex items-center justify-between mb-2.5 sm:mb-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[#641f60]/10 flex items-center justify-center transition-colors group-hover:bg-[#641f60]/15">
                  <Globe className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-[#641f60]" />
                </div>
              </div>
              <p className="text-[11px] sm:text-xs font-medium text-slate-500 mb-1">International</p>
              <p className="text-xl sm:text-2xl font-bold text-[#641f60] tabular-nums">
                {summary.internationalCount}
              </p>
            </div>
          </div>

          {/* Collection mix — how the money came in, for counter reconciliation. */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 sm:p-4">
            <p className="text-[11px] sm:text-xs font-medium text-slate-500 mb-3">
              Collected by method
            </p>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((m) => {
                const stat = summary.byMethod[m.id];
                if (!stat) return null;
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    onClick={() => setMethodFilter((prev) => (prev === m.id ? 'all' : m.id))}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-colors ${
                      methodFilter === m.id
                        ? 'border-[#641f60] bg-[#641f60]/5 text-[#641f60]'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${m.accent}`} />
                    <span className="font-medium">{m.label}</span>
                    <span className="tabular-nums text-slate-400">{stat.count}</span>
                    {summary.singleCurrency && (
                      <span className="tabular-nums text-slate-400 hidden xs:inline">
                        · {formatCompactMoney(stat.value, summary.singleCurrency)}
                      </span>
                    )}
                  </button>
                );
              })}
              {summary.byMethod.unspecified && (
                <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-200 text-xs text-slate-400">
                  Unspecified
                  <span className="tabular-nums">{summary.byMethod.unspecified.count}</span>
                </span>
              )}
            </div>
          </div>
        </>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reference, sender, receiver, M-Pesa code..."
              className="w-full pl-10 pr-4 py-3 sm:py-2.5 text-base sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
            />
          </div>
          <div className="grid grid-cols-2 sm:flex gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="w-full sm:w-auto px-3 sm:px-4 py-3 sm:py-2.5 text-base sm:text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value as typeof methodFilter)}
              className="w-full sm:w-auto px-3 sm:px-4 py-3 sm:py-2.5 text-base sm:text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
            >
              <option value="all">All Methods</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
              <div className="h-3 w-24 bg-slate-200 rounded mb-3" />
              <div className="h-4 w-40 bg-slate-200 rounded mb-2" />
              <div className="h-6 w-28 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : filteredTransfers.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {filteredTransfers.map((transfer) => {
            const canAct = transfer.status === 'pending' || transfer.status === 'approved';
            const flagged =
              transfer.requires_compliance_check && transfer.compliance_status !== 'cleared';
            const fundsPending =
              transfer.payment_status === 'pending' &&
              transfer.status !== 'cancelled' &&
              transfer.status !== 'failed';

            return (
              <div
                key={transfer.id}
                className={`group flex flex-col bg-white rounded-xl border transition-all duration-200 hover:shadow-lg hover:shadow-slate-200/50 sm:hover:-translate-y-0.5 ${
                  flagged
                    ? 'border-[#c46040]/30 hover:border-[#c46040]/50'
                    : 'border-slate-200 hover:border-[#641f60]/30'
                }`}
              >
                <div className="p-4 sm:p-5 flex-1">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="font-mono text-[11px] text-slate-400 truncate min-w-0">
                      {transfer.reference}
                    </span>
                    {getStatusBadge(transfer.status)}
                  </div>

                  {/* Sender and receiver stacked rather than inline: on a
                      narrow card the arrow form truncates both names. */}
                  <div className="mb-4">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {transfer.sender_name || 'Unknown sender'}
                    </p>
                    <div className="flex items-center gap-1.5 my-1">
                      <ArrowRightLeft className="w-3 h-3 text-slate-300 flex-shrink-0" />
                      <span className="h-px flex-1 bg-slate-100" />
                    </div>
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {transfer.receiver_name || 'Unknown receiver'}
                    </p>
                    {transfer.destination_country && (
                      <p className="text-[11px] text-slate-400 mt-1 truncate">
                        to {transfer.destination_country}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2 pt-3 border-t border-slate-100">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <CurrencyBadge code={transfer.currency} size={14} />
                        <span className="text-[11px] font-medium text-slate-400">
                          {transfer.currency}
                        </span>
                      </div>
                      <p className="text-base sm:text-lg font-bold text-slate-900 tabular-nums break-all">
                        {formatMoney(transfer.amount, transfer.currency)}
                      </p>
                      {Number(transfer.fee_amount) > 0 && (
                        <p className="text-[11px] text-slate-400 tabular-nums break-all">
                          +{formatMoney(transfer.fee_amount, transfer.currency)} fee
                        </p>
                      )}
                    </div>
                    <div className="flex flex-row sm:flex-col sm:items-end gap-1 flex-shrink-0 flex-wrap">
                      <PaymentMethodChip method={transfer.payment_method} />
                      {transfer.is_international && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#641f60]/10 text-[#641f60] text-[10px] font-medium rounded">
                          <Globe className="w-3 h-3" />
                          International
                        </span>
                      )}
                      {flagged && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#c46040]/10 text-[#c46040] text-[10px] font-medium rounded">
                          <ShieldAlert className="w-3 h-3" />
                          {transfer.compliance_status ?? 'pending'}
                        </span>
                      )}
                    </div>
                  </div>

                  {transfer.payment_reference && (
                    <p className="text-[11px] font-mono text-slate-400 mt-2 truncate">
                      Ref {transfer.payment_reference}
                    </p>
                  )}

                  {fundsPending && (
                    <p className="text-[11px] text-[#c46040] mt-2 flex items-center gap-1">
                      <Clock className="w-3 h-3 flex-shrink-0" />
                      Funds not confirmed
                    </p>
                  )}

                  {transfer.purpose && (
                    <p className="text-[11px] text-slate-400 mt-3 line-clamp-2">
                      {transfer.purpose}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 px-3 py-2.5 border-t border-slate-100">
                  <button
                    onClick={() => openVoucherForTransfer(transfer)}
                    className="flex-1 min-w-[84px] inline-flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Print remittance voucher"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Voucher
                  </button>
                  {canAct && fundsPending && (
                    <button
                      onClick={() => handleMarkFundsReceived(transfer)}
                      disabled={actioningId === transfer.id}
                      className="flex-1 min-w-[110px] inline-flex items-center justify-center gap-1.5 px-2 py-2 bg-[#641f60] hover:bg-[#4e1849] text-white text-xs font-semibold rounded-lg transition-all duration-200 active:scale-[0.97] disabled:opacity-50"
                    >
                      {actioningId === transfer.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Banknote className="w-3.5 h-3.5" />
                      )}
                      Funds In
                    </button>
                  )}
                  {canAct && !fundsPending && (
                    <button
                      onClick={() => handleComplete(transfer)}
                      disabled={actioningId === transfer.id}
                      className="flex-1 min-w-[96px] inline-flex items-center justify-center gap-1.5 px-2 py-2 bg-[#1ebcb2] hover:bg-[#159089] text-white text-xs font-semibold rounded-lg transition-all duration-200 hover:shadow-md hover:shadow-[#1ebcb2]/25 active:scale-[0.97] disabled:opacity-50"
                    >
                      {actioningId === transfer.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      Complete
                    </button>
                  )}
                  {canAct && (
                    <button
                      onClick={() => handleCancel(transfer)}
                      disabled={actioningId === transfer.id}
                      className="inline-flex items-center justify-center px-2.5 py-2 text-slate-400 hover:text-[#c46040] hover:bg-[#c46040]/10 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                      title="Cancel transfer"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-12 sm:py-16 px-4">
          <div className="w-16 h-16 rounded-full bg-[#641f60]/5 flex items-center justify-center mb-4">
            <ArrowRightLeft className="w-8 h-8 text-[#641f60]/40" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">No transfers found</h3>
          <p className="text-slate-500 text-center max-w-sm text-sm">
            {searchQuery || statusFilter !== 'all' || methodFilter !== 'all'
              ? 'No transfers match your search or filters.'
              : 'Create your first money transfer to get started.'}
          </p>
        </div>
      )}

      {/* New Transfer Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl shadow-2xl flex flex-col h-full sm:h-auto sm:max-h-[90vh] overflow-hidden">
            {/* Fixed header */}
            <div
              className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0"
              style={{ paddingTop: 'max(0.875rem, env(safe-area-inset-top))' }}
            >
              <h2 className="text-base sm:text-xl font-bold text-[#641f60] truncate">
                New Money Transfer
              </h2>
              <button
                type="button"
                onClick={closeForm}
                className="p-2 -mr-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable body */}
            <form
              id="new-transfer-form"
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 sm:py-5 space-y-4"
            >
              <div className="border-b border-slate-200 pb-4">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Sender</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Existing Customer
                    </label>
                    <select
                      value={formData.from_customer_id}
                      onChange={(e) => {
                        const customer = customers.find((c) => c.id === e.target.value);
                        setFormData((prev) => ({
                          ...prev,
                          from_customer_id: e.target.value,
                          sender_name: customer ? customerName(customer) : prev.sender_name,
                          sender_phone: customer?.phone ?? prev.sender_phone,
                          sender_address: customer?.address ?? prev.sender_address,
                          sender_id_number: customer?.id_number ?? prev.sender_id_number,
                        }));
                      }}
                      className="w-full px-3 sm:px-4 py-3 sm:py-2.5 text-base sm:text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
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
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Sender Name *
                    </label>
                    <input
                      type="text"
                      value={formData.sender_name}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, sender_name: e.target.value }))
                      }
                      className="w-full px-3 sm:px-4 py-3 sm:py-2.5 text-base sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Sender Phone
                    </label>
                    <input
                      type="tel"
                      inputMode="tel"
                      value={formData.sender_phone}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, sender_phone: e.target.value }))
                      }
                      className="w-full px-3 sm:px-4 py-3 sm:py-2.5 text-base sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Sender ID Number
                    </label>
                    <input
                      type="text"
                      value={formData.sender_id_number}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, sender_id_number: e.target.value }))
                      }
                      className="w-full px-3 sm:px-4 py-3 sm:py-2.5 text-base sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                      placeholder="ID / Passport number"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Sender Address
                    </label>
                    <input
                      type="text"
                      value={formData.sender_address}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, sender_address: e.target.value }))
                      }
                      className="w-full px-3 sm:px-4 py-3 sm:py-2.5 text-base sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                      placeholder="Printed on the remittance voucher"
                    />
                  </div>
                </div>
              </div>

              <div className="border-b border-slate-200 pb-4">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Receiver</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Receiver Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.receiver_name}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, receiver_name: e.target.value }))
                      }
                      className="w-full px-3 sm:px-4 py-3 sm:py-2.5 text-base sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Receiver Phone
                    </label>
                    <input
                      type="tel"
                      inputMode="tel"
                      value={formData.receiver_phone}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, receiver_phone: e.target.value }))
                      }
                      className="w-full px-3 sm:px-4 py-3 sm:py-2.5 text-base sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Receiver City
                    </label>
                    <input
                      type="text"
                      value={formData.receiver_city}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, receiver_city: e.target.value }))
                      }
                      className="w-full px-3 sm:px-4 py-3 sm:py-2.5 text-base sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                      placeholder="e.g. Nairobi"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Destination Country
                    </label>
                    <input
                      type="text"
                      value={formData.destination_country}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, destination_country: e.target.value }))
                      }
                      className="w-full px-3 sm:px-4 py-3 sm:py-2.5 text-base sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                      placeholder="Blank for domestic"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amount *</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                    className="w-full px-3 sm:px-4 py-3 sm:py-2.5 text-base sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
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

              {/* Pay from till — the float account the money is collected into
                  (and, for payouts, drawn from). Filtered to the transfer's
                  currency. The transfer cannot post to the ledger without it. */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Pay From Till *
                </label>
                {eligibleFloats.length > 0 ? (
                  <select
                    value={formData.float_account_id}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, float_account_id: e.target.value }))
                    }
                    className="w-full px-3 sm:px-4 py-3 sm:py-2.5 text-base sm:text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  >
                    {eligibleFloats.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.float_type} · {f.currency}{' '}
                        {Number(f.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-[#c46040] p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg">
                    No active {formData.currency} till. Open or top up a {formData.currency} float
                    account in the Float module before sending.
                  </p>
                )}
              </div>

              {/* Payment method */}
              <div className="border-t border-slate-200 pt-4">
                <h3 className="text-sm font-semibold text-slate-900 mb-1">Payment Method *</h3>
                <p className="text-xs text-slate-500 mb-3">
                  How the sender is paying for this transfer.
                </p>

                <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-5 gap-2">
                  {PAYMENT_METHODS.map((m) => {
                    const Icon = m.icon;
                    const active = formData.payment_method === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => selectPaymentMethod(m.id)}
                        aria-pressed={active}
                        className={`flex flex-col items-center justify-center gap-1.5 px-2 py-3 rounded-lg border-2 transition-all text-center ${
                          active
                            ? `${m.tint} shadow-sm`
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${active ? m.accent : 'text-slate-400'}`} />
                        <span
                          className={`text-xs font-semibold ${
                            active ? 'text-slate-900' : 'text-slate-600'
                          }`}
                        >
                          {m.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <p className="text-[11px] text-slate-400 mt-2">{selectedMethod.blurb}</p>

                {selectedMethod.fields.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-3">
                    {selectedMethod.fields.map((field) => {
                      const isRequired = selectedMethod.required.includes(field);
                      const isBank = field === 'bank';
                      const wide = field === 'account_name' || field === 'reference';
                      return (
                        <div key={field} className={wide ? 'sm:col-span-2' : ''}>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            {FIELD_LABELS[field]}
                            {isRequired ? ' *' : ''}
                          </label>
                          <input
                            type={field === 'phone' ? 'tel' : 'text'}
                            inputMode={
                              field === 'phone' || field === 'account_number' ? 'numeric' : 'text'
                            }
                            list={isBank ? 'transfer-bank-list' : undefined}
                            value={paymentFieldValue(field)}
                            onChange={(e) => setPaymentFieldValue(field, e.target.value)}
                            placeholder={FIELD_PLACEHOLDERS[field]}
                            className={`w-full px-3 sm:px-4 py-3 sm:py-2.5 text-base sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent ${
                              field === 'reference' ? 'font-mono uppercase' : ''
                            }`}
                          />
                        </div>
                      );
                    })}
                    <datalist id="transfer-bank-list">
                      {COMMON_BANKS.map((b) => (
                        <option key={b} value={b} />
                      ))}
                    </datalist>
                  </div>
                )}

                {!selectedMethod.settlesImmediately && (
                  <div className="mt-3 p-3 bg-[#ee7b22]/10 border border-[#ee7b22]/30 rounded-lg text-[#c46040] text-xs sm:text-sm flex items-start gap-2">
                    <Clock className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>
                      {selectedMethod.label} payments are recorded as awaiting funds. The till is
                      not debited and the payout cannot be completed until the money is confirmed
                      via Funds In.
                    </span>
                  </div>
                )}
              </div>

              {/* Automatic 5% fee breakdown */}
              {parsedAmount > 0 && (
                <div className="p-3 sm:p-3.5 bg-[#1ebcb2]/5 border border-[#1ebcb2]/20 rounded-lg text-xs sm:text-sm space-y-1.5">
                  <div className="flex items-start justify-between gap-3 text-slate-600">
                    <span className="flex-shrink-0">Amount Sent</span>
                    <span className="font-medium text-slate-800 tabular-nums text-right break-all">
                      {formData.currency}{' '}
                      {parsedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3 text-slate-600">
                    <span className="min-w-0">
                      Transfer Fee ({(TRANSFER_FEE_RATE * 100).toFixed(0)}%, automatic)
                    </span>
                    <span className="font-medium text-[#ee7b22] tabular-nums text-right break-all flex-shrink-0">
                      − {formData.currency}{' '}
                      {transferFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3 text-slate-600">
                    <span className="flex-shrink-0">Paid By</span>
                    <span className="font-medium text-slate-800 text-right">
                      {selectedMethod.label}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3 pt-1.5 border-t border-[#1ebcb2]/20">
                    <span className="font-semibold text-slate-800 flex-shrink-0">
                      Recipient Receives
                    </span>
                    <span className="font-semibold text-[#1ebcb2] tabular-nums text-right break-all">
                      {formData.currency}{' '}
                      {recipientReceives.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                  className="w-full px-3 sm:px-4 py-3 sm:py-2.5 text-base sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 sm:px-4 py-3 sm:py-2.5 text-base sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent resize-y"
                />
              </div>

              {requiresCompliance && (
                <div className="p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-xs sm:text-sm flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    This transfer will be flagged for compliance review
                    {isInternational ? ' (international destination)' : ' (amount above threshold)'}.
                  </span>
                </div>
              )}

              {formError && (
                <div className="p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-xs sm:text-sm flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium break-words">{formError}</p>
                    {formErrorHint && (
                      <p className="text-[#c46040]/80 break-words">{formErrorHint}</p>
                    )}
                  </div>
                </div>
              )}
            </form>

            {/* Fixed footer */}
            <div
              className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2.5 sm:gap-3 px-4 sm:px-6 py-3.5 sm:py-4 border-t border-slate-200 flex-shrink-0 bg-white"
              style={{ paddingBottom: 'max(0.875rem, env(safe-area-inset-bottom))' }}
            >
              <button
                type="button"
                onClick={closeForm}
                className="px-4 py-3 sm:py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="new-transfer-form"
                disabled={submitting}
                className="px-6 py-3 sm:py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
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

      {/* Remittance voucher */}
      {voucher && (
        <VoucherModal
          data={voucher.data}
          extras={voucher.extras}
          onClose={() => setVoucher(null)}
        />
      )}
    </div>
  );
}