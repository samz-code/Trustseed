import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Transaction, TransactionType, Customer, Wallet, LoanAccount, FloatAccount } from '../types';
import { useTenantExchangeRates, lookupRate } from '../lib/forexRates';
import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowRightLeft,
  Globe,
  Search,
  Plus,
  X,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCcw,
  DollarSign,
  Phone,
  User,
  UserCheck,
  UserX,
  Banknote,
  PiggyBank,
  Receipt,
  Landmark,
  Smartphone,
  CreditCard,
  ChevronDown,
  Wallet as WalletIcon,
  ShieldAlert,
} from 'lucide-react';

// ============================================================================
// Constants
// ============================================================================

type PaymentSource = 'cash' | 'momo' | 'mpesa' | 'bank';

const TRANSACTION_TYPES: { value: TransactionType; label: string; icon: React.ReactNode }[] = [
  { value: 'deposit', label: 'Deposit', icon: <ArrowDownRight className="w-5 h-5" /> },
  { value: 'withdrawal', label: 'Withdrawal', icon: <ArrowUpRight className="w-5 h-5" /> },
  { value: 'transfer', label: 'Money Transfer', icon: <ArrowRightLeft className="w-5 h-5" /> },
  { value: 'forex_buy', label: 'Forex Buy', icon: <DollarSign className="w-5 h-5" /> },
  { value: 'forex_sell', label: 'Forex Sell', icon: <RefreshCcw className="w-5 h-5" /> },
  { value: 'loan_disbursement', label: 'Loan Disbursement', icon: <CreditCard className="w-5 h-5" /> },
  { value: 'loan_repayment', label: 'Loan Repayment', icon: <Banknote className="w-5 h-5" /> },
  { value: 'savings_deposit', label: 'Savings Deposit', icon: <PiggyBank className="w-5 h-5" /> },
  { value: 'savings_withdrawal', label: 'Savings Withdrawal', icon: <PiggyBank className="w-5 h-5" /> },
  { value: 'float_allocation', label: 'Add Funds (Float)', icon: <Receipt className="w-5 h-5" /> },
];

// The 6 quick-select cards shown in the modal, matching the reference layout.
const QUICK_TYPES = TRANSACTION_TYPES.slice(0, 6);

const CURRENCIES = ['KES', 'USD', 'SSP', 'UGX', 'TZS', 'RWF', 'EUR', 'GBP'];

// Flat transfer fee rate, applied to every money-transfer transaction
// (local AND international, per product decision). Deducted from the
// sender's amount, so the recipient receives amount - fee. Kept as a
// named constant so it's trivial to make tenant-configurable later.
const TRANSFER_FEE_RATE = 0.05;

// Real national flags rendered as inline SVG, clipped to a circle. National
// flags are public-domain symbols, so no external assets or licensing needed,
// and inline SVG stays crisp at any DPI (unlike emoji, which render poorly on
// Windows/Android). Currency -> issuing country flag.
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
          <circle cx="31" cy="9" r="4.3" fill="#00a1de" opacity="0.001" />
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

// A round flag badge for a currency. Clips the flag SVG to a circle and adds a
// thin ring so light-colored flags stay visible on white backgrounds.
function CurrencyBadge({ code, size = 22 }: { code: string; size?: number }) {
  const clipId = `flag-clip-${code}`;
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

const PAYMENT_SOURCES: { value: PaymentSource; label: string; icon: React.ReactNode }[] = [
  { value: 'cash', label: 'Cash', icon: <Banknote className="w-4 h-4" /> },
  { value: 'momo', label: 'MoMo', icon: <Smartphone className="w-4 h-4" /> },
  { value: 'mpesa', label: 'M-Pesa', icon: <Smartphone className="w-4 h-4" /> },
  { value: 'bank', label: 'Bank', icon: <Landmark className="w-4 h-4" /> },
];

// Threshold above which a transaction needs sign-off purely on size, even if
// it's domestic. Kept as a named constant so it's easy to make configurable
// per-tenant later instead of hardcoded here.
const LARGE_AMOUNT_APPROVAL_THRESHOLD = 1000;

type RequiredRole = 'branch_manager' | 'compliance_officer';

// Decides who has to sign off on a transaction before it can complete.
// International transfers always route to compliance (AML / source-of-funds
// obligations), regardless of amount. Everything else only needs approval
// once it crosses the size threshold, and goes to the branch manager.
function resolveRequiredRole(amount: number, isInternational: boolean): RequiredRole | null {
  if (isInternational) return 'compliance_officer';
  if (amount >= LARGE_AMOUNT_APPROVAL_THRESHOLD) return 'branch_manager';
  return null;
}

function roleLabel(role: RequiredRole): string {
  return role === 'compliance_officer' ? 'Compliance Officer' : 'Branch Manager';
}

function customerLabel(c: Customer): string {
  if (c.customer_type === 'individual') return `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || 'Unnamed';
  return c.business_name || 'Unnamed Business';
}

function walletLabel(w: Wallet): string {
  const bal = Number(w.available_balance ?? w.balance ?? 0);
  return `${w.currency} ${w.wallet_type} — Bal: ${bal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

// Strips everything but digits and keeps the last 9, so "+254712345678",
// "0712345678", and "712345678" are all treated as the same subscriber
// number regardless of how the country code was entered.
function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digitsOnly = phone.replace(/\D/g, '');
  return digitsOnly.slice(-9);
}

// Masks a resolved recipient's name the way mobile-money confirmation
// screens do (e.g. "JOHN K***A") so the sender can visually confirm it's
// the right person without the full name being spoofable/typo-prone.
function maskConfirmationName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return name;
  return parts
    .map((part) => {
      if (part.length <= 2) return part.toUpperCase();
      return `${part[0]}${'*'.repeat(part.length - 2)}${part[part.length - 1]}`.toUpperCase();
    })
    .join(' ');
}

// ============================================================================
// Supabase helpers
// ============================================================================

async function fetchCustomerWallets(tenantId: string, customerId: string): Promise<Wallet[]> {
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .eq('status', 'active');
  if (error) throw error;
  return (data || []) as Wallet[];
}

// Float accounts live in their own `float_accounts` table (see FloatPage),
// scoped to a branch. This is the institution's central financial pool per
// currency — every transaction type now settles against it (see
// FLOAT_DEBIT_TYPES / FLOAT_CREDIT_TYPES below), not just Forex.
async function fetchFloatAccounts(tenantId: string, branchId: string | null): Promise<FloatAccount[]> {
  let q = supabase
    .from('float_accounts')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'active');
  if (branchId) q = q.eq('branch_id', branchId);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as FloatAccount[];
}

function floatLabel(f: FloatAccount): string {
  const bal = Number(f.balance ?? 0);
  const typeLabel = f.float_type.replace(/_/g, ' ');
  return `${f.currency} ${typeLabel} — Bal: ${bal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

async function fetchLoanAccounts(tenantId: string, customerId: string): Promise<LoanAccount[]> {
  const { data, error } = await supabase
    .from('loan_accounts')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .eq('status', 'active');
  if (error) throw error;
  // Cast through `unknown` because the real loan_accounts columns vary between
  // deployments (loan_number vs account_number, principal_amount vs
  // outstanding_balance). loanLabel() below reads whichever exist.
  return (data || []) as unknown as LoanAccount[];
}

// Reads a loan account's display fields defensively so it works no matter
// which columns your loan_accounts table actually has.
function loanNumber(l: LoanAccount): string {
  const rec = l as Record<string, unknown>;
  return String(rec.account_number ?? rec.loan_number ?? rec.number ?? l.id);
}

function loanBalance(l: LoanAccount): number {
  const rec = l as Record<string, unknown>;
  const val = rec.outstanding_balance ?? rec.current_balance ?? rec.balance ?? rec.principal_amount ?? rec.principal ?? 0;
  return Number(val) || 0;
}

function loanCurrency(l: LoanAccount): string {
  const rec = l as Record<string, unknown>;
  return typeof rec.currency === 'string' ? rec.currency : '';
}

function loanLabel(l: LoanAccount): string {
  const cur = loanCurrency(l);
  const bal = loanBalance(l).toLocaleString(undefined, { minimumFractionDigits: 2 });
  return cur ? `${loanNumber(l)} — ${cur} ${bal}` : `${loanNumber(l)} — ${bal}`;
}

// ============================================================================
// Reusable searchable select (Customer / Wallet / Loan / Float pickers)
// ============================================================================

interface SearchableOption {
  value: string;
  label: string;
  sublabel?: string;
}

function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  disabledHint,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  placeholder: string;
  disabled?: boolean;
  disabledHint?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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
      (o.sublabel || '').toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between pl-10 pr-3 py-2.5 border rounded-lg text-left transition-colors ${
          disabled
            ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
            : 'border-slate-300 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1ebcb2]'
        }`}
      >
        <span className={`truncate ${selected ? 'text-slate-900' : 'text-slate-400'}`}>
          {selected ? selected.label : disabled && disabledHint ? disabledHint : placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0 ml-2" />
      </button>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />

      {open && !disabled && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          <div className="p-2 border-b border-slate-100 sticky top-0 bg-white">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
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
                className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${
                  o.value === value ? 'bg-[#1ebcb2]/10 text-[#641f60] font-medium' : 'text-slate-700'
                }`}
              >
                {o.label}
                {o.sublabel && <span className="block text-xs text-slate-400">{o.sublabel}</span>}
              </button>
            ))
          ) : (
            <div className="px-3 py-3 text-sm text-slate-400 text-center">No results found</div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  hintTone = 'warn',
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  hintTone?: 'warn' | 'info';
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label} {required && <span className="text-[#c46040]">*</span>}
      </label>
      {children}
      {hint && (
        <p className={`text-xs mt-1 ${hintTone === 'info' ? 'text-[#1ebcb2]' : 'text-[#ee7b22]'}`}>{hint}</p>
      )}
    </div>
  );
}

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
              <span className={c === value ? 'text-[#641f60] font-medium' : 'text-slate-700'}>
                {c}
              </span>
              <span className="text-slate-400 truncate">{CURRENCY_NAMES[c] || ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PaymentSourcePicker({
  value,
  onChange,
}: {
  value: PaymentSource | '';
  onChange: (v: PaymentSource) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {PAYMENT_SOURCES.map((p) => (
        <button
          key={p.value}
          type="button"
          onClick={() => onChange(p.value)}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 text-xs font-medium transition-all ${
            value === p.value
              ? 'border-[#1ebcb2] bg-[#1ebcb2]/10 text-[#641f60]'
              : 'border-slate-200 text-slate-600 hover:border-slate-300'
          }`}
        >
          {p.icon}
          {p.label}
        </button>
      ))}
    </div>
  );
}

function AmountInput({
  value,
  onChange,
  step = '0.01',
  icon,
  readOnly,
}: {
  value: number;
  onChange?: (v: number) => void;
  step?: string;
  icon?: React.ReactNode;
  readOnly?: boolean;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
        {icon || <DollarSign className="w-5 h-5" />}
      </span>
      {readOnly ? (
        <input
          type="text"
          readOnly
          value={value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-600"
        />
      ) : (
        <input
          type="number"
          step={step}
          min="0"
          value={value || ''}
          onChange={(e) => onChange?.(parseFloat(e.target.value) || 0)}
          className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
        />
      )}
    </div>
  );
}

// ============================================================================
// Form data
// ============================================================================

interface TransactionFormData {
  transaction_type: TransactionType;
  amount: number;
  currency: string;
  to_currency: string;
  from_customer_id: string;
  to_customer_id: string;
  from_wallet_id: string;
  to_wallet_id: string;
  float_account_id: string;
  loan_account_id: string;
  sender_name: string;
  sender_phone: string;
  receiver_name: string;
  receiver_phone: string;
  is_international: boolean;
  payment_source: PaymentSource | '';
  exchange_rate: number;
  charges: number;
  approval_reference: string;
  destination_country: string;
  purpose: string;
  notes: string;
}

function emptyFormData(defaultType?: TransactionType): TransactionFormData {
  return {
    transaction_type: defaultType || 'deposit',
    amount: 0,
    currency: 'USD',
    to_currency: 'KES',
    from_customer_id: '',
    to_customer_id: '',
    from_wallet_id: '',
    to_wallet_id: '',
    float_account_id: '',
    loan_account_id: '',
    sender_name: '',
    sender_phone: '',
    receiver_name: '',
    receiver_phone: '',
    is_international: false,
    payment_source: '',
    exchange_rate: 0,
    charges: 0,
    approval_reference: '',
    destination_country: '',
    purpose: '',
    notes: '',
  };
}

// Transaction types that DRAW DOWN the branch float pool. Before these can
// be submitted, the selected float account's balance must cover the amount
// (plus fee, for transfers). This is the "verify available balance in the
// wallet pool before crediting the receiving customer" rule.
const FLOAT_DEBIT_TYPES: TransactionType[] = [
  'withdrawal',
  'transfer',
  'forex_buy',
  'forex_sell',
  'loan_disbursement',
  'savings_withdrawal',
];

// Transaction types that TOP UP the branch float pool. No balance check
// needed, but the float account is still recorded for traceability.
const FLOAT_CREDIT_TYPES: TransactionType[] = [
  'deposit',
  'savings_deposit',
  'loan_repayment',
  'float_allocation',
];

// Which currency's float account is actually affected by a given type. For
// Forex, the institution pays OUT the "to_currency" leg, so that's the side
// that must have sufficient balance (and the side that gets debited).
function relevantFloatCurrency(type: TransactionType, formData: TransactionFormData): string {
  if (type === 'forex_buy' || type === 'forex_sell') return formData.to_currency;
  return formData.currency;
}

// ============================================================================
// Main component
// ============================================================================

interface TransactionsPageProps {
  defaultType?: TransactionType;
}

export function TransactionsPage({ defaultType }: TransactionsPageProps = {}) {
  const { tenant, branch, admin } = useAuth();
  const { rates } = useTenantExchangeRates(tenant?.id);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<TransactionFormData>(emptyFormData(defaultType));

  const [fromWallets, setFromWallets] = useState<Wallet[]>([]);
  const [floatAccounts, setFloatAccounts] = useState<FloatAccount[]>([]);
  const [loanAccounts, setLoanAccounts] = useState<LoanAccount[]>([]);
  const [loadingFromWallets, setLoadingFromWallets] = useState(false);
  const [rateManuallyEdited, setRateManuallyEdited] = useState(false);

  useEffect(() => {
    if (tenant) loadData();
  }, [tenant, branch]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [txRes, custRes, walletRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('*')
          .eq('tenant_id', tenant!.id)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase.from('customers').select('*').eq('tenant_id', tenant!.id).eq('status', 'active'),
        supabase
          .from('wallets')
          .select('*, customer:customers(first_name, last_name, business_name, customer_type)')
          .eq('tenant_id', tenant!.id)
          .eq('status', 'active'),
      ]);

      if (txRes.error) throw txRes.error;
      if (custRes.error) throw custRes.error;
      if (walletRes.error) throw walletRes.error;

      setTransactions((txRes.data || []) as Transaction[]);
      setCustomers((custRes.data || []) as Customer[]);
      setWallets((walletRes.data || []) as Wallet[]);
    } catch (err) {
      console.error('Error loading transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  // From-customer wallets
  useEffect(() => {
    if (!tenant || !formData.from_customer_id) {
      setFromWallets([]);
      return;
    }
    setLoadingFromWallets(true);
    fetchCustomerWallets(tenant.id, formData.from_customer_id)
      .then(setFromWallets)
      .catch((err) => console.error('Error loading wallets:', err))
      .finally(() => setLoadingFromWallets(false));
  }, [tenant, formData.from_customer_id]);

  // Float / reserve accounts — loaded once per branch and reused across
  // EVERY transaction type (deposit, withdrawal, transfer, forex, loans,
  // savings, and manual float top-ups), not just Forex as before. This is
  // the institution's central financial pool: every transaction settles
  // against it so cash flow stays traceable and accurate.
  useEffect(() => {
    if (!tenant) {
      setFloatAccounts([]);
      return;
    }
    fetchFloatAccounts(tenant.id, branch?.id ?? null)
      .then(setFloatAccounts)
      .catch((err) => console.error('Error loading float accounts:', err));
  }, [tenant, branch]);

  // Loan accounts (loan disbursement only)
  useEffect(() => {
    if (!tenant || formData.transaction_type !== 'loan_disbursement' || !formData.from_customer_id) {
      setLoanAccounts([]);
      return;
    }
    fetchLoanAccounts(tenant.id, formData.from_customer_id)
      .then(setLoanAccounts)
      .catch((err) => console.error('Error loading loan accounts:', err));
  }, [tenant, formData.transaction_type, formData.from_customer_id]);

  // Auto-fill exchange rate from the Forex module whenever the currency pair
  // changes (unless the user has manually overridden it). forex_buy uses the
  // buy leg, forex_sell uses the sell leg, transfers use sell.
  useEffect(() => {
    const type = formData.transaction_type;
    const needsRate =
      (type === 'transfer' && formData.is_international) || type === 'forex_buy' || type === 'forex_sell';
    if (!needsRate || rateManuallyEdited || formData.currency === formData.to_currency) return;

    const mode: 'buy' | 'sell' = type === 'forex_buy' ? 'buy' : 'sell';
    const rate = lookupRate(rates, formData.currency, formData.to_currency, mode);
    if (rate !== null) {
      setFormData((prev) => ({ ...prev, exchange_rate: rate }));
    }
  }, [
    rates,
    formData.transaction_type,
    formData.currency,
    formData.to_currency,
    formData.is_international,
    rateManuallyEdited,
  ]);

  const amountReceived = formData.exchange_rate > 0 ? formData.amount * formData.exchange_rate : 0;

  // --- Automatic 5% transfer fee ---------------------------------------------
  // Applies to every money-transfer transaction, local or international.
  // Deducted from the sender's amount: the recipient receives amount - fee
  // (converted at the exchange rate for cross-currency transfers).
  const isTransferType = formData.transaction_type === 'transfer';
  const transferFee = isTransferType ? Math.round(formData.amount * TRANSFER_FEE_RATE * 100) / 100 : 0;
  const netPrincipalAfterFee = Math.max(formData.amount - transferFee, 0);
  const transferRecipientReceives =
    formData.exchange_rate > 0 && formData.currency !== formData.to_currency
      ? netPrincipalAfterFee * formData.exchange_rate
      : netPrincipalAfterFee;

  // --- Float account resolution for whichever type is selected ---------------
  const floatCurrency = useMemo(
    () => relevantFloatCurrency(formData.transaction_type, formData),
    [formData.transaction_type, formData.currency, formData.to_currency]
  );

  const floatAccountsForCurrency = useMemo(
    () => floatAccounts.filter((f) => f.currency === floatCurrency),
    [floatAccounts, floatCurrency]
  );

  const floatAccountOptions: SearchableOption[] = floatAccountsForCurrency.map((f) => ({
    value: f.id,
    label: floatLabel(f),
  }));

  const selectedFloatAccount = floatAccounts.find((f) => f.id === formData.float_account_id) || null;

  // Auto-select the float account when there's exactly one match for the
  // relevant currency, and clear a stale selection if the currency changed
  // out from under it (e.g. user switched transaction currency).
  useEffect(() => {
    if (selectedFloatAccount && selectedFloatAccount.currency === floatCurrency) return;
    if (floatAccountsForCurrency.length === 1) {
      setFormData((prev) => ({ ...prev, float_account_id: floatAccountsForCurrency[0].id }));
    } else {
      setFormData((prev) => (prev.float_account_id ? { ...prev, float_account_id: '' } : prev));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floatCurrency, floatAccountsForCurrency.length]);

  // --- Phone-number recipient lookup for transfers (M-Pesa style) ------------
  // As the sender types the recipient's phone number, we search the existing
  // customer base (already loaded) for a match and auto-resolve their name,
  // rather than requiring a customer to be picked from a list first.
  const resolvedRecipient = useMemo(() => {
    if (!isTransferType) return null;
    const normalizedQuery = normalizePhone(formData.receiver_phone);
    if (normalizedQuery.length < 7) return null;
    return (
      customers.find(
        (c) => c.id !== formData.from_customer_id && normalizePhone(c.phone) === normalizedQuery
      ) || null
    );
  }, [isTransferType, formData.receiver_phone, formData.from_customer_id, customers]);

  const recipientLookupState: 'idle' | 'searching' | 'found' | 'not_found' = !isTransferType
    ? 'idle'
    : normalizePhone(formData.receiver_phone).length < 7
    ? 'idle'
    : resolvedRecipient
    ? 'found'
    : 'not_found';

  // Keep to_customer_id / receiver_name in sync with whatever the phone
  // lookup resolves, so the eventual insert always has a customer link when
  // one exists (unregistered numbers still go through as external transfers).
  useEffect(() => {
    if (!isTransferType) return;
    if (resolvedRecipient) {
      setFormData((prev) =>
        prev.to_customer_id === resolvedRecipient.id && prev.receiver_name === customerLabel(resolvedRecipient)
          ? prev
          : { ...prev, to_customer_id: resolvedRecipient.id, receiver_name: customerLabel(resolvedRecipient) }
      );
    } else {
      setFormData((prev) => (prev.to_customer_id ? { ...prev, to_customer_id: '' } : prev));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedRecipient, isTransferType]);

  const filteredTransactions = transactions.filter((tx) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      tx.reference?.toLowerCase().includes(q) ||
      tx.sender_name?.toLowerCase().includes(q) ||
      tx.receiver_name?.toLowerCase().includes(q);
    const matchesType = filterType === 'all' || tx.transaction_type === filterType;
    const matchesStatus = filterStatus === 'all' || tx.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (!tenant || !admin) throw new Error('Missing tenant or admin');
      if (formData.amount <= 0) throw new Error('Amount must be greater than 0');

      const type = formData.transaction_type;
      const isTransfer = type === 'transfer';
      const isForex = type === 'forex_buy' || type === 'forex_sell';
      const isLoan = type === 'loan_disbursement';
      const isFloatTopUp = type === 'float_allocation';

      if (isLoan && !formData.loan_account_id) throw new Error('Select a loan account to disburse against');

      if (isTransfer && !formData.to_customer_id && !formData.receiver_name.trim()) {
        throw new Error('No registered customer found for that phone number — enter the recipient\'s name to continue as an external transfer.');
      }
      if (isTransfer && !formData.receiver_phone.trim()) {
        throw new Error('Recipient phone number is required.');
      }

      // --- Universal float / wallet-pool verification -------------------
      // Every transaction now settles against the branch float pool. Debit
      // types must have sufficient balance BEFORE we allow the transaction
      // to be created; credit types just need a target float account on
      // record for traceability.
      const isDebit = FLOAT_DEBIT_TYPES.includes(type);
      const isCredit = FLOAT_CREDIT_TYPES.includes(type);

      if (!formData.float_account_id) {
        throw new Error(
          `Select the ${floatCurrency} float/reserve account this transaction ${isDebit ? 'draws from' : 'credits'}.`
        );
      }
      const floatAccount = floatAccounts.find((f) => f.id === formData.float_account_id);
      if (!floatAccount) throw new Error('Selected float account could not be found. Please refresh and try again.');

      if (isDebit) {
        const feeComponent = isTransfer ? transferFee : 0;
        const requiredAmount = isForex ? amountReceived : formData.amount + feeComponent;
        const availableBalance = Number(floatAccount.balance ?? 0);
        if (requiredAmount > availableBalance) {
          throw new Error(
            `Insufficient float balance. Available: ${floatAccount.currency} ${availableBalance.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}, required: ${floatAccount.currency} ${requiredAmount.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}.`
          );
        }
      }

      const requiredRole = resolveRequiredRole(formData.amount, formData.is_international);
      const requiresApproval = requiredRole !== null;
      // Compliance sign-off (international) is treated as the higher tier;
      // a plain large-amount branch-manager approval is level 1.
      const approvalLevel = requiredRole === 'compliance_officer' ? 2 : requiresApproval ? 1 : 0;

      // Resolve which wallet ids get written, per type. Note the branch float
      // account is NOT a customer wallet (separate `float_accounts` table);
      // it is always written to `float_account_id` regardless of type.
      let fromWalletId: string | null = formData.from_wallet_id || null;
      let toWalletId: string | null = formData.to_wallet_id || null;
      if (isForex) {
        fromWalletId = formData.from_wallet_id || null; // customer wallet
        toWalletId = null;
      }
      if (isLoan) {
        fromWalletId = null;
        toWalletId = formData.from_wallet_id || null; // disbursement wallet
      }
      if (isFloatTopUp) {
        fromWalletId = null;
        toWalletId = null;
      }

      const feeAmount = isTransfer ? transferFee : 0;

      const { data: insertedTx, error: insertError } = await supabase
        .from('transactions')
        .insert({
          tenant_id: tenant.id,
          branch_id: branch?.id || null,
          transaction_type: type,
          amount: formData.amount,
          currency: formData.currency,
          to_currency: isTransfer || isForex ? formData.to_currency : null,
          fee_amount: feeAmount,
          fee_currency: isTransfer ? formData.currency : null,
          charges: isTransfer ? feeAmount : null,
          from_customer_id: isFloatTopUp ? null : formData.from_customer_id || null,
          to_customer_id: isTransfer ? formData.to_customer_id || null : null,
          from_wallet_id: fromWalletId,
          to_wallet_id: toWalletId,
          sender_name: formData.sender_name || null,
          sender_phone: formData.sender_phone || null,
          receiver_name: isTransfer ? formData.receiver_name || null : null,
          receiver_phone: isTransfer ? formData.receiver_phone || null : null,
          destination_country: isTransfer ? formData.destination_country || null : null,
          is_international: isTransfer ? formData.is_international : false,
          requires_compliance_check: isTransfer ? formData.is_international : false,
          payment_source:
            type === 'deposit' || type === 'withdrawal' || isFloatTopUp ? formData.payment_source || null : null,
          exchange_rate: isTransfer || isForex ? formData.exchange_rate || null : null,
          float_account_id: formData.float_account_id,
          loan_account_id: isLoan ? formData.loan_account_id || null : null,
          approval_reference: isLoan ? formData.approval_reference || null : null,
          purpose: formData.purpose || null,
          notes: formData.notes || null,
          status: (requiresApproval ? 'pending' : 'approved') as Transaction['status'],
          created_by: admin.id,
          required_approval_level: approvalLevel,
        } as never)
        .select()
        .single();

      if (insertError) throw insertError;

      // Route the transaction to whoever actually has to sign off on it -
      // without this, transactions sat as `status: 'pending'` with no
      // corresponding approval record, so nothing showed up on the Pending
      // Approvals page and nobody was ever notified.
      if (requiresApproval && insertedTx && requiredRole) {
        const { error: approvalError } = await supabase.from('transaction_approvals').insert({
          tenant_id: tenant.id,
          transaction_id: (insertedTx as Transaction).id,
          required_role: requiredRole,
          approval_level: approvalLevel,
          status: 'pending' as const,
        });
        if (approvalError) throw approvalError;

        // Best-effort notification - if the `notifications` table isn't set
        // up yet this silently no-ops rather than blocking the transaction.
        try {
          await (supabase.from('notifications') as any).insert({
            tenant_id: tenant.id,
            branch_id: branch?.id || null,
            admin_id: null, // tenant-wide; narrow once role->admin lookup exists
            title: `${roleLabel(requiredRole)} approval needed`,
            message: `${type.replace(/_/g, ' ')} of ${formData.currency} ${formData.amount.toLocaleString()} is awaiting approval.`,
            type: 'warning',
            link_path: 'approvals',
          });
        } catch (notifyErr) {
          console.error('Error creating approval notification:', notifyErr);
        }
      }

      await loadData();
      setShowForm(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create transaction');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData(emptyFormData(defaultType));
    setFromWallets([]);
    setLoanAccounts([]);
    setRateManuallyEdited(false);
    setError(null);
  };

  const setType = (type: TransactionType) => {
    setFormData({ ...emptyFormData(type), transaction_type: type });
    setRateManuallyEdited(false);
  };

  // --- Presentation helpers --------------------------------------------------

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
      pending: { bg: 'bg-[#ee7b22]/10', text: 'text-[#ee7b22]', icon: <Clock className="w-3.5 h-3.5" /> },
      approved: { bg: 'bg-[#1ebcb2]/10', text: 'text-[#1ebcb2]', icon: <CheckCircle className="w-3.5 h-3.5" /> },
      processing: { bg: 'bg-[#641f60]/10', text: 'text-[#641f60]', icon: <Loader2 className="w-3.5 h-3.5" /> },
      completed: { bg: 'bg-[#1ebcb2]/10', text: 'text-[#1ebcb2]', icon: <CheckCircle className="w-3.5 h-3.5" /> },
      failed: { bg: 'bg-[#c46040]/10', text: 'text-[#c46040]', icon: <XCircle className="w-3.5 h-3.5" /> },
      reversed: { bg: 'bg-slate-100', text: 'text-slate-700', icon: <RefreshCcw className="w-3.5 h-3.5" /> },
      cancelled: { bg: 'bg-slate-100', text: 'text-slate-700', icon: <XCircle className="w-3.5 h-3.5" /> },
    };
    const style = styles[status] || styles.pending;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
        {style.icon}
        {status}
      </span>
    );
  };

  const getTransactionIcon = (type: string) => {
    if (type.includes('deposit') || type.includes('repayment')) return <ArrowDownRight className="w-5 h-5 text-[#1ebcb2]" />;
    if (type.includes('withdrawal') || type.includes('disbursement')) return <ArrowUpRight className="w-5 h-5 text-[#ee7b22]" />;
    if (type.includes('forex')) return <Globe className="w-5 h-5 text-[#641f60]" />;
    return <ArrowRightLeft className="w-5 h-5 text-slate-500" />;
  };

  const getIconBg = (type: string) => {
    if (type.includes('deposit') || type.includes('repayment')) return 'bg-[#1ebcb2]/10';
    if (type.includes('withdrawal') || type.includes('disbursement')) return 'bg-[#ee7b22]/10';
    if (type.includes('forex')) return 'bg-[#641f60]/10';
    return 'bg-slate-100';
  };

  const customerOptions: SearchableOption[] = useMemo(
    () =>
      customers.map((c) => ({
        value: c.id,
        label: customerLabel(c),
        sublabel: `${c.customer_type === 'individual' ? 'Individual' : c.customer_type === 'business' ? 'Business' : 'Organization'} · ${c.phone}`,
      })),
    [customers]
  );

  const fromWalletOptions: SearchableOption[] = fromWallets.map((w) => ({ value: w.id, label: walletLabel(w) }));
  const loanAccountOptions: SearchableOption[] = loanAccounts.map((l) => ({
    value: l.id,
    label: loanLabel(l),
    sublabel: 'Loan account',
  }));

  const approvalHint =
    formData.amount >= LARGE_AMOUNT_APPROVAL_THRESHOLD
      ? `Requires Branch Manager approval (amount >= ${LARGE_AMOUNT_APPROVAL_THRESHOLD.toLocaleString()})`
      : undefined;

  const setRate = (v: number) => {
    setRateManuallyEdited(true);
    setFormData((prev) => ({ ...prev, exchange_rate: v }));
  };

  // Shared float-account field, rendered for every transaction type so the
  // branch's central pool is always the source of truth for the movement.
  const renderFloatField = (labelOverride?: string) => {
    const isDebit = FLOAT_DEBIT_TYPES.includes(formData.transaction_type);
    return (
      <Field
        label={labelOverride || `${isDebit ? 'Float Account Debited' : 'Float Account Credited'} (${floatCurrency})`}
        required
        hint={
          floatAccountOptions.length === 0
            ? `No active ${floatCurrency} float account found for this branch. Create one on the Float page first.`
            : selectedFloatAccount
            ? `Current balance: ${selectedFloatAccount.currency} ${Number(selectedFloatAccount.balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
            : undefined
        }
        hintTone={floatAccountOptions.length === 0 ? 'warn' : 'info'}
      >
        <SearchableSelect
          value={formData.float_account_id}
          onChange={(v) => setFormData((prev) => ({ ...prev, float_account_id: v }))}
          options={floatAccountOptions}
          placeholder={floatAccountOptions.length ? 'Select float account...' : 'No float accounts found'}
          disabled={floatAccountOptions.length === 0}
          disabledHint="No matching float accounts"
        />
      </Field>
    );
  };

  // --- Dynamic "Section 2" fields, one branch per transaction type -----------

  const renderTypeFields = () => {
    const type = formData.transaction_type;

    switch (type) {
      case 'deposit':
      case 'withdrawal': {
        const isDeposit = type === 'deposit';
        return (
          <>
            <Field label="Customer" required>
              <SearchableSelect
                value={formData.from_customer_id}
                onChange={(v) => setFormData((prev) => ({ ...prev, from_customer_id: v, from_wallet_id: '' }))}
                options={customerOptions}
                placeholder="Search customer..."
              />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label={isDeposit ? 'Wallet / Account to Deposit Into' : 'Wallet / Account to Withdraw From'} required>
                <SearchableSelect
                  value={formData.from_wallet_id}
                  onChange={(v) => {
                    const w = fromWallets.find((fw) => fw.id === v);
                    setFormData((prev) => ({ ...prev, from_wallet_id: v, currency: w?.currency || prev.currency }));
                  }}
                  options={fromWalletOptions}
                  placeholder={loadingFromWallets ? 'Loading wallets...' : 'Select wallet / account'}
                  disabled={!formData.from_customer_id || loadingFromWallets}
                  disabledHint="Select a customer first"
                />
              </Field>
              <Field label="Currency">
                <CurrencySelect value={formData.currency} onChange={(v) => setFormData((prev) => ({ ...prev, currency: v }))} />
              </Field>
            </div>
            <Field label="Amount" required hint={approvalHint}>
              <AmountInput value={formData.amount} onChange={(v) => setFormData((prev) => ({ ...prev, amount: v }))} />
            </Field>
            {renderFloatField()}
            <Field label={isDeposit ? 'Payment Source' : 'Payout Method'} required>
              <PaymentSourcePicker
                value={formData.payment_source}
                onChange={(v) => setFormData((prev) => ({ ...prev, payment_source: v }))}
              />
            </Field>
          </>
        );
      }

      case 'transfer':
        return (
          <>
            <Field label="From Customer / Sender" required>
              <SearchableSelect
                value={formData.from_customer_id}
                onChange={(v) => setFormData((prev) => ({ ...prev, from_customer_id: v, from_wallet_id: '' }))}
                options={customerOptions}
                placeholder="Search sender..."
              />
            </Field>

            {/* M-Pesa-style recipient resolution: type the phone number, the
                system looks up the registered customer and confirms the
                name before the sender proceeds. */}
            <Field label="Recipient Phone Number" required>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="tel"
                  value={formData.receiver_phone}
                  onChange={(e) => setFormData((prev) => ({ ...prev, receiver_phone: e.target.value }))}
                  placeholder="e.g. 0712345678"
                  className="w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                />
                {recipientLookupState === 'found' && (
                  <UserCheck className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#1ebcb2]" />
                )}
                {recipientLookupState === 'not_found' && (
                  <UserX className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#ee7b22]" />
                )}
              </div>
              {recipientLookupState === 'found' && resolvedRecipient && (
                <p className="text-xs mt-1.5 flex items-center gap-1.5 text-[#1ebcb2] font-medium">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Confirmed: {maskConfirmationName(customerLabel(resolvedRecipient))}
                </p>
              )}
              {recipientLookupState === 'not_found' && (
                <p className="text-xs mt-1.5 flex items-center gap-1.5 text-[#ee7b22]">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  No registered customer with this number — enter their name below to send as an external transfer.
                </p>
              )}
            </Field>

            {recipientLookupState === 'not_found' && (
              <Field label="Recipient Name (unregistered)" required>
                <input
                  type="text"
                  value={formData.receiver_name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, receiver_name: e.target.value }))}
                  placeholder="Full name of recipient"
                  className="w-full px-4 py-2.5 border border-[#ee7b22]/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ee7b22] focus:border-transparent"
                />
              </Field>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Sending Currency">
                <CurrencySelect value={formData.currency} onChange={(v) => { setRateManuallyEdited(false); setFormData((prev) => ({ ...prev, currency: v })); }} />
              </Field>
              <Field label="Amount Sent" required hint={approvalHint}>
                <AmountInput value={formData.amount} onChange={(v) => setFormData((prev) => ({ ...prev, amount: v }))} />
              </Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Receiving Currency">
                <CurrencySelect value={formData.to_currency} onChange={(v) => { setRateManuallyEdited(false); setFormData((prev) => ({ ...prev, to_currency: v })); }} />
              </Field>
              <Field label="Exchange Rate" hint={formData.currency === formData.to_currency ? 'Same currency — rate not needed' : undefined} hintTone="info">
                <AmountInput
                  value={formData.currency === formData.to_currency ? 1 : formData.exchange_rate}
                  onChange={setRate}
                  step="0.0001"
                  icon={<RefreshCcw className="w-4 h-4" />}
                  readOnly={formData.currency === formData.to_currency}
                />
              </Field>
            </div>

            {/* Automatic 5% fee breakdown — always shown for transfers,
                local or international, before the sender can confirm. */}
            {formData.amount > 0 && (
              <div className="p-3.5 bg-[#1ebcb2]/5 border border-[#1ebcb2]/20 rounded-lg text-sm space-y-1.5">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Amount Sent</span>
                  <span className="font-medium text-slate-800">
                    {formData.currency} {formData.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Transfer Fee ({(TRANSFER_FEE_RATE * 100).toFixed(0)}%)</span>
                  <span className="font-medium text-[#ee7b22]">
                    − {formData.currency} {transferFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1.5 border-t border-[#1ebcb2]/20">
                  <span className="font-semibold text-slate-800">Recipient Receives</span>
                  <span className="font-semibold text-[#1ebcb2]">
                    {formData.to_currency} {transferRecipientReceives.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}

            {renderFloatField(`Float Account Debited (${floatCurrency})`)}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Transfer Type</label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="transfer_type"
                    checked={!formData.is_international}
                    onChange={() => setFormData((prev) => ({ ...prev, is_international: false, destination_country: '' }))}
                    className="text-[#641f60] focus:ring-[#1ebcb2]"
                  />
                  Local Transfer
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="transfer_type"
                    checked={formData.is_international}
                    onChange={() => setFormData((prev) => ({ ...prev, is_international: true }))}
                    className="text-[#641f60] focus:ring-[#1ebcb2]"
                  />
                  International Transfer
                </label>
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                International transfers always route to Compliance for sign-off. The 5% fee applies either way.
              </p>
              {formData.is_international && (
                <div className="mt-4">
                  <Field label="Destination Country">
                    <input
                      type="text"
                      value={formData.destination_country}
                      onChange={(e) => setFormData((prev) => ({ ...prev, destination_country: e.target.value }))}
                      placeholder="e.g. South Sudan"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    />
                  </Field>
                </div>
              )}
            </div>
          </>
        );

      case 'forex_buy':
      case 'forex_sell': {
        const givesLabel = type === 'forex_buy' ? 'Customer Gives Currency' : 'Customer Sells Currency';
        const givesAmountLabel = type === 'forex_buy' ? 'Amount Customer Gives' : 'Amount Customer Sells';
        const receivesAmountLabel = type === 'forex_buy' ? 'Amount Customer Receives' : 'Amount Paid to Customer';
        return (
          <>
            <Field label="Customer" required>
              <SearchableSelect
                value={formData.from_customer_id}
                onChange={(v) => setFormData((prev) => ({ ...prev, from_customer_id: v, from_wallet_id: '' }))}
                options={customerOptions}
                placeholder="Search customer..."
              />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label={givesLabel}>
                <CurrencySelect value={formData.currency} onChange={(v) => { setRateManuallyEdited(false); setFormData((prev) => ({ ...prev, currency: v })); }} />
              </Field>
              <Field label={givesAmountLabel} required hint={approvalHint}>
                <AmountInput value={formData.amount} onChange={(v) => setFormData((prev) => ({ ...prev, amount: v }))} />
              </Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Customer Receives Currency">
                <CurrencySelect value={formData.to_currency} onChange={(v) => { setRateManuallyEdited(false); setFormData((prev) => ({ ...prev, to_currency: v })); }} />
              </Field>
              <Field
                label="Exchange Rate"
                hint={
                  formData.exchange_rate > 0
                    ? `1 ${formData.currency} = ${formData.exchange_rate.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${formData.to_currency}`
                    : undefined
                }
                hintTone="info"
              >
                <AmountInput value={formData.exchange_rate} onChange={setRate} step="0.0001" icon={<RefreshCcw className="w-4 h-4" />} />
              </Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label={receivesAmountLabel}>
                <AmountInput value={amountReceived} readOnly />
              </Field>
              {renderFloatField(`Branch Float Affected (${floatCurrency})`)}
            </div>
          </>
        );
      }

      case 'loan_disbursement':
        return (
          <>
            <Field label="Borrower / Customer" required>
              <SearchableSelect
                value={formData.from_customer_id}
                onChange={(v) => setFormData((prev) => ({ ...prev, from_customer_id: v, loan_account_id: '', from_wallet_id: '' }))}
                options={customerOptions}
                placeholder="Search borrower..."
              />
            </Field>
            <Field label="Loan Account" required>
              <SearchableSelect
                value={formData.loan_account_id}
                onChange={(v) => {
                  const loan = loanAccounts.find((l) => l.id === v);
                  const cur = loan ? loanCurrency(loan) : '';
                  setFormData((prev) => ({ ...prev, loan_account_id: v, currency: cur || prev.currency }));
                }}
                options={loanAccountOptions}
                placeholder="Select loan account"
                disabled={!formData.from_customer_id}
                disabledHint="Select a borrower first"
              />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Disbursement Wallet" required>
                <SearchableSelect
                  value={formData.from_wallet_id}
                  onChange={(v) => setFormData((prev) => ({ ...prev, from_wallet_id: v }))}
                  options={fromWalletOptions}
                  placeholder={loadingFromWallets ? 'Loading wallets...' : 'Select wallet...'}
                  disabled={!formData.from_customer_id || loadingFromWallets}
                  disabledHint="Select a borrower first"
                />
              </Field>
              <Field label="Currency">
                <CurrencySelect value={formData.currency} onChange={(v) => setFormData((prev) => ({ ...prev, currency: v }))} />
              </Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Amount" required hint={approvalHint}>
                <AmountInput value={formData.amount} onChange={(v) => setFormData((prev) => ({ ...prev, amount: v }))} />
              </Field>
              <Field label="Approval Reference">
                <input
                  type="text"
                  value={formData.approval_reference}
                  onChange={(e) => setFormData((prev) => ({ ...prev, approval_reference: e.target.value }))}
                  placeholder="Enter approval reference..."
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                />
              </Field>
            </div>
            {renderFloatField()}
          </>
        );

      case 'float_allocation':
        return (
          <>
            <div className="p-3.5 bg-[#641f60]/5 border border-[#641f60]/20 rounded-lg text-sm text-slate-600 flex items-start gap-2.5">
              <WalletIcon className="w-5 h-5 text-[#641f60] flex-shrink-0 mt-0.5" />
              <span>
                Use this to record capital injected into the business float — cash, bank, or mobile-money funds
                deposited into your operating pool. No customer is involved; this only increases a float account's
                available balance.
              </span>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Currency" required>
                <CurrencySelect
                  value={formData.currency}
                  onChange={(v) => setFormData((prev) => ({ ...prev, currency: v, float_account_id: '' }))}
                />
              </Field>
              <Field label="Amount" required>
                <AmountInput value={formData.amount} onChange={(v) => setFormData((prev) => ({ ...prev, amount: v }))} />
              </Field>
            </div>
            {renderFloatField('Float Account Credited')}
            <Field label="Funding Source" required>
              <PaymentSourcePicker
                value={formData.payment_source}
                onChange={(v) => setFormData((prev) => ({ ...prev, payment_source: v }))}
              />
            </Field>
          </>
        );

      default:
        // savings_deposit / savings_withdrawal / loan_repayment
        return (
          <>
            <Field label="Customer" required>
              <SearchableSelect
                value={formData.from_customer_id}
                onChange={(v) => setFormData((prev) => ({ ...prev, from_customer_id: v, from_wallet_id: '' }))}
                options={customerOptions}
                placeholder="Search customer..."
              />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Wallet / Account" required>
                <SearchableSelect
                  value={formData.from_wallet_id}
                  onChange={(v) => {
                    const w = fromWallets.find((fw) => fw.id === v);
                    setFormData((prev) => ({ ...prev, from_wallet_id: v, currency: w?.currency || prev.currency }));
                  }}
                  options={fromWalletOptions}
                  placeholder={loadingFromWallets ? 'Loading wallets...' : 'Select wallet / account'}
                  disabled={!formData.from_customer_id || loadingFromWallets}
                  disabledHint="Select a customer first"
                />
              </Field>
              <Field label="Currency">
                <CurrencySelect value={formData.currency} onChange={(v) => setFormData((prev) => ({ ...prev, currency: v }))} />
              </Field>
            </div>
            <Field label="Amount" required hint={approvalHint}>
              <AmountInput value={formData.amount} onChange={(v) => setFormData((prev) => ({ ...prev, amount: v }))} />
            </Field>
            {renderFloatField()}
            <Field label="Payment Source">
              <PaymentSourcePicker value={formData.payment_source} onChange={(v) => setFormData((prev) => ({ ...prev, payment_source: v }))} />
            </Field>
          </>
        );
    }
  };

  const activeQuickType = QUICK_TYPES.find((t) => t.value === formData.transaction_type);
  // Only Withdrawal still uses the free-text "External Party" block for
  // supplementary sender info — Transfer now captures recipient details
  // inline (phone lookup) as part of Section 2 above.
  const showExternalParty = formData.transaction_type === 'withdrawal';

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#641f60]">Transactions</h1>
          <p className="text-slate-600 mt-1">Process deposits, withdrawals, transfers, and more</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg transition-all w-full sm:w-auto"
        >
          <Plus className="w-5 h-5" />
          New Transaction
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by reference or name..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
            />
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
            >
              <option value="all">All Types</option>
              {TRANSACTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Transaction List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#641f60]" />
          </div>
        ) : filteredTransactions.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filteredTransactions.map((tx) => (
              <div key={tx.id} className="px-4 sm:px-6 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${getIconBg(tx.transaction_type)}`}>
                    {getTransactionIcon(tx.transaction_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 sm:gap-4">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-900 capitalize truncate">
                          {tx.transaction_type.replace(/_/g, ' ')}
                        </h3>
                        <p className="text-sm text-slate-500 truncate">{tx.reference}</p>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                        {tx.is_international && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-[#641f60]/10 text-[#641f60]">
                            <Globe className="w-3 h-3" />
                            International
                          </span>
                        )}
                        {getStatusBadge(tx.status)}
                      </div>
                    </div>
                    {(tx.sender_name || tx.receiver_name) && (
                      <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                        <span className="flex items-center gap-1 min-w-0">
                          <User className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">
                            {tx.sender_name && `From: ${tx.sender_name}`}
                            {tx.sender_name && tx.receiver_name && ' → '}
                            {tx.receiver_name && `To: ${tx.receiver_name}`}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p
                      className={`text-base sm:text-lg font-semibold whitespace-nowrap ${
                        tx.transaction_type.includes('deposit') || tx.transaction_type.includes('repayment')
                          ? 'text-[#1ebcb2]'
                          : 'text-slate-900'
                      }`}
                    >
                      {tx.transaction_type.includes('deposit') || tx.transaction_type.includes('repayment') ? '+' : '-'}
                      {tx.currency} {tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    {tx.fee_amount ? (
                      <p className="text-xs text-[#ee7b22]">
                        Fee: {tx.fee_currency || tx.currency} {Number(tx.fee_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                    ) : null}
                    <p className="text-xs text-slate-500">{new Date(tx.created_at).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <ArrowRightLeft className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No transactions found</h3>
            <p className="text-slate-500 text-center max-w-sm">
              {searchQuery || filterType !== 'all' || filterStatus !== 'all'
                ? 'No transactions match your filters. Try adjusting them.'
                : 'Start processing transactions to see them here.'}
            </p>
          </div>
        )}
      </div>

      {/* New Transaction Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl shadow-2xl flex flex-col h-full sm:h-auto sm:max-h-[90vh] overflow-hidden">
            {/* Fixed header */}
            <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg sm:text-xl font-bold text-[#641f60]">New Transaction</h2>
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
              id="new-transaction-form"
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-5 space-y-6"
            >
              {/* Section 1: Transaction Type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">1. Select Transaction Type</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
                  {QUICK_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setType(t.value)}
                      className={`flex flex-col items-start gap-1.5 p-3 rounded-lg border-2 text-left transition-all min-h-[76px] ${
                        formData.transaction_type === t.value
                          ? 'border-[#1ebcb2] bg-[#1ebcb2]/10'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className={formData.transaction_type === t.value ? 'text-[#641f60]' : 'text-slate-500'}>
                        {t.icon}
                      </span>
                      <span className="block text-xs sm:text-sm font-medium text-slate-700 leading-tight">
                        {t.label}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="mt-2">
                  <select
                    value={TRANSACTION_TYPES.some((t) => t.value === formData.transaction_type) ? formData.transaction_type : ''}
                    onChange={(e) => setType(e.target.value as TransactionType)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#1ebcb2]"
                  >
                    {TRANSACTION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Section 2: dynamic fields */}
              <div className="border-t border-slate-200 pt-5 space-y-4">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-2">
                  <WalletIcon className="w-4 h-4" />
                  2. Transaction Details {activeQuickType ? `(${activeQuickType.label})` : ''}
                </h3>
                {renderTypeFields()}
              </div>

              {/* External Party (withdrawal only — transfer captures this inline above) */}
              {showExternalParty && (
                <div className="border-t border-slate-200 pt-4 space-y-4">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <User className="w-5 h-5 text-[#641f60]" />
                    External Party (Optional)
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Sender Name">
                      <input
                        type="text"
                        value={formData.sender_name}
                        onChange={(e) => setFormData((prev) => ({ ...prev, sender_name: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                      />
                    </Field>
                    <Field label="Sender Phone">
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                          type="tel"
                          value={formData.sender_phone}
                          onChange={(e) => setFormData((prev) => ({ ...prev, sender_phone: e.target.value }))}
                          className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                        />
                      </div>
                    </Field>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Receiver Name">
                      <input
                        type="text"
                        value={formData.receiver_name}
                        onChange={(e) => setFormData((prev) => ({ ...prev, receiver_name: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                      />
                    </Field>
                    <Field label="Receiver Phone">
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                          type="tel"
                          value={formData.receiver_phone}
                          onChange={(e) => setFormData((prev) => ({ ...prev, receiver_phone: e.target.value }))}
                          className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                        />
                      </div>
                    </Field>
                  </div>
                </div>
              )}

              {/* Notes */}
              <Field label="Notes">
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  placeholder="Add any additional notes..."
                />
              </Field>

              {error && (
                <div className="p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  {error}
                </div>
              )}
            </form>

            {/* Fixed footer (outside scroll area so it's always reachable) */}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-200 flex-shrink-0 bg-white">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="new-transaction-form"
                disabled={submitting}
                className="px-6 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    Create {activeQuickType ? activeQuickType.label : 'Transaction'}
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