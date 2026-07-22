import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { InsertTables } from '../lib/supabase';
import type { ExchangeRate, FloatAccount, Customer } from '../types';
import { ReceiptModal, buildReceiptData, type ReceiptData } from './TransactionReceipt';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  Globe,
  RefreshCw,
  Plus,
  Loader2,
  ArrowRight,
  Calculator,
  X,
  AlertCircle,
  TrendingUp,
  Power,
  Download,
  Pencil,
  ChevronDown,
  Zap,
  Clock,
  CheckCircle,
  ArrowDownRight,
  ArrowUpRight,
  Users,
} from 'lucide-react';

// ============================================================================
// Currency flags — inline SVG, shared visual language with Transactions /
// Float / Wallets. Crisp at any DPI, no external assets, and no emoji-flag
// fallback boxes on Windows.
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

function CurrencyBadge({ code, size = 22 }: { code: string; size?: number }) {
  const clipId = `forex-flag-clip-${code}`;
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

function CurrencySelect({
  value,
  onChange,
  options = CURRENCIES,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options?: string[];
  disabled?: boolean;
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
        disabled={disabled}
        onClick={() => setOpen((p) => !p)}
        className={`w-full flex items-center gap-2 pl-3 pr-3 py-2.5 border rounded-lg text-left transition-colors ${
          disabled
            ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
            : 'border-slate-300 bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1ebcb2]'
        }`}
      >
        <CurrencyBadge code={value} />
        <span className="flex-1 min-w-0 truncate text-slate-900">
          <span className="font-medium">{value}</span>
          <span className="hidden sm:inline text-slate-400"> · {CURRENCY_NAMES[value] || value}</span>
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
      </button>

      {open && !disabled && (
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

function PairLabel({ from, to, size = 20 }: { from: string; to: string; size?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <CurrencyBadge code={from} size={size} />
      <span className="font-semibold text-slate-900">{from}</span>
      <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
      <CurrencyBadge code={to} size={size} />
      <span className="font-semibold text-slate-900">{to}</span>
    </span>
  );
}

// ============================================================================
// Form
// ============================================================================

interface RateForm {
  from_currency: string;
  to_currency: string;
  buy_rate: string;
  sell_rate: string;
  reference_rate: string;
  spread_percent: string;
  auto_update: boolean;
}

const EMPTY_FORM: RateForm = {
  from_currency: 'USD',
  to_currency: 'KES',
  buy_rate: '',
  sell_rate: '',
  reference_rate: '',
  spread_percent: '1',
  auto_update: true,
};

// Mirrors exactly what apply_market_rate() does nightly in the database, so
// what the form previews is what will actually be stored when the job runs.
function applySpread(mid: number, spreadPercent: number) {
  return {
    buy: mid * (1 - spreadPercent / 100),
    sell: mid * (1 + spreadPercent / 100),
  };
}

function fmtRate(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

function fmtWhen(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'never';
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

export function ForexPage() {
  const { tenant, branch, admin } = useAuth();

  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [history, setHistory] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingRate, setEditingRate] = useState<ExchangeRate | null>(null);
  const [formData, setFormData] = useState<RateForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fetchingRef, setFetchingRef] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);

  const [convertFrom, setConvertFrom] = useState('USD');
  const [convertTo, setConvertTo] = useState('KES');
  const [convertAmount, setConvertAmount] = useState('1000');
  const [convertMode, setConvertMode] = useState<'buy' | 'sell'>('sell');

  const [chartPair, setChartPair] = useState<string>('');

  // ------------------------------------------------------------------
  // Dealing. The page could set board rates and calculate conversions, but
  // there was no way to record an actual trade: a customer walking in with
  // USD and leaving with KES left no trace at all. For a bureau that is the
  // core function, so it is built here rather than left to a spreadsheet.
  // ------------------------------------------------------------------
  const [floatAccounts, setFloatAccounts] = useState<FloatAccount[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showDeal, setShowDeal] = useState(false);
  const [dealType, setDealType] = useState<'buy' | 'sell'>('buy');
  const [dealForeignFloat, setDealForeignFloat] = useState('');
  const [dealLocalFloat, setDealLocalFloat] = useState('');
  const [dealAmount, setDealAmount] = useState('');
  const [dealRate, setDealRate] = useState('');
  const [dealCustomerId, setDealCustomerId] = useState('');
  const [dealCustomerName, setDealCustomerName] = useState('');
  const [dealNotes, setDealNotes] = useState('');
  const [dealSubmitting, setDealSubmitting] = useState(false);
  const [dealError, setDealError] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  const canManage =
    admin?.role === 'super_admin' ||
    admin?.role === 'institution_admin' ||
    admin?.role === 'head_office_admin' ||
    admin?.role === 'branch_manager' ||
    admin?.role === 'forex_officer';

  const loadRates = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [activeRes, historyRes] = await Promise.all([
        supabase
          .from('exchange_rates')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('is_active', true)
          .order('from_currency', { ascending: true }),
        supabase
          .from('exchange_rates')
          .select('*')
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: true })
          .limit(500),
      ]);
      if (activeRes.error) throw activeRes.error;
      if (historyRes.error) throw historyRes.error;

      // Tills and customers needed for dealing.
      const [floatsRes, custRes] = await Promise.all([
        supabase
          .from('float_accounts')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('status', 'active'),
        supabase
          .from('customers')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('status', 'active')
          .limit(500),
      ]);
      if (floatsRes.error) throw floatsRes.error;
      if (custRes.error) throw custRes.error;
      setFloatAccounts((floatsRes.data ?? []) as unknown as FloatAccount[]);
      setCustomers((custRes.data ?? []) as Customer[]);

      const active = (activeRes.data ?? []) as ExchangeRate[];
      setRates(active);
      setHistory((historyRes.data ?? []) as ExchangeRate[]);

      setChartPair((prev) => {
        if (prev) return prev;
        return active.length > 0 ? `${active[0].from_currency}/${active[0].to_currency}` : '';
      });
    } catch (err) {
      console.error('Error loading rates:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load exchange rates');
      setRates([]);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    loadRates();
  }, [loadRates]);

  // ---- Manual trigger of the nightly job ----------------------------------

  const refreshFromMarket = async () => {
    setRefreshingAll(true);
    setLoadError(null);
    setNotice(null);
    try {
      const { data, error } = await supabase.functions.invoke('refresh-exchange-rates', {});
      if (error) throw error;

      const updated = Number(data?.rowsUpdated ?? 0);
      const failures = Number(data?.failures ?? 0);
      setNotice(
        updated > 0
          ? `Updated ${updated} rate${updated === 1 ? '' : 's'} from the market.${
              failures > 0 ? ` ${failures} pair(s) could not be fetched.` : ''
            }`
          : 'No rates were updated. Check that pairs have auto-update enabled.'
      );
      await loadRates();
    } catch (err) {
      console.error('Error refreshing rates:', err);
      setLoadError(
        err instanceof Error
          ? `Couldn't refresh rates: ${err.message}. Has the "refresh-exchange-rates" Edge Function been deployed?`
          : 'Could not refresh rates from the market.'
      );
    } finally {
      setRefreshingAll(false);
    }
  };

  // ---- Converter -----------------------------------------------------------

  const getActiveRate = useCallback(
    (from: string, to: string): ExchangeRate | null =>
      rates.find((r) => r.from_currency === from && r.to_currency === to) ?? null,
    [rates]
  );

  const conversion = useMemo(() => {
    const amount = parseFloat(convertAmount) || 0;
    if (convertFrom === convertTo) {
      return { rate: 1, result: amount, inverse: false, found: true };
    }
    const direct = getActiveRate(convertFrom, convertTo);
    if (direct) {
      const rate = convertMode === 'buy' ? direct.buy_rate : direct.sell_rate;
      return { rate, result: amount * rate, inverse: false, found: true };
    }
    const inverse = getActiveRate(convertTo, convertFrom);
    if (inverse) {
      const base = convertMode === 'buy' ? inverse.buy_rate : inverse.sell_rate;
      const rate = base !== 0 ? 1 / base : 0;
      return { rate, result: amount * rate, inverse: true, found: true };
    }
    return { rate: 0, result: 0, inverse: false, found: false };
  }, [convertAmount, convertFrom, convertTo, convertMode, getActiveRate]);

  // ---- Chart ---------------------------------------------------------------

  const chartData = useMemo(() => {
    if (!chartPair) return [];
    const [from, to] = chartPair.split('/');
    return history
      .filter((r) => r.from_currency === from && r.to_currency === to)
      .map((r) => ({
        date: new Date(r.created_at).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        }),
        buy: r.buy_rate,
        sell: r.sell_rate,
      }));
  }, [history, chartPair]);

  const pairOptions = useMemo(() => {
    const set = new Set<string>();
    history.forEach((r) => set.add(`${r.from_currency}/${r.to_currency}`));
    rates.forEach((r) => set.add(`${r.from_currency}/${r.to_currency}`));
    return Array.from(set);
  }, [history, rates]);

  const autoCount = useMemo(() => rates.filter((r) => r.auto_update !== false).length, [rates]);

  // ---- Live reference ------------------------------------------------------

  const fetchReferenceRate = async () => {
    setFetchingRef(true);
    setFormError(null);
    try {
      const res = await fetch(`https://open.er-api.com/v6/latest/${formData.from_currency}`);
      if (!res.ok) throw new Error(`Reference service returned ${res.status}`);
      const data = await res.json();
      const rate = data?.rates?.[formData.to_currency];
      if (typeof rate !== 'number') {
        throw new Error(
          `No reference rate available for ${formData.from_currency}/${formData.to_currency}`
        );
      }
      const mid = Number(rate);
      const spread = parseFloat(formData.spread_percent) || 0;
      const { buy, sell } = applySpread(mid, spread);
      setFormData((prev) => ({
        ...prev,
        reference_rate: mid.toFixed(6),
        buy_rate: buy.toFixed(6),
        sell_rate: sell.toFixed(6),
      }));
    } catch (err) {
      console.error('Error fetching reference rate:', err);
      setFormError(
        err instanceof Error
          ? `Couldn't fetch reference rate: ${err.message}. Enter rates manually.`
          : 'Could not fetch reference rate. Enter rates manually.'
      );
    } finally {
      setFetchingRef(false);
    }
  };

  // ---- CRUD ----------------------------------------------------------------

  // ==========================================================================
  // Dealing
  // ==========================================================================

  const openDeal = (type: 'buy' | 'sell') => {
    setDealType(type);
    setDealForeignFloat('');
    setDealLocalFloat('');
    setDealAmount('');
    setDealRate('');
    setDealCustomerId('');
    setDealCustomerName('');
    setDealNotes('');
    setDealError(null);
    setShowDeal(true);
  };

  const closeDeal = () => {
    setShowDeal(false);
    setDealError(null);
  };

  const foreignFloat = useMemo(
    () => floatAccounts.find((f) => f.id === dealForeignFloat) ?? null,
    [floatAccounts, dealForeignFloat]
  );
  const localFloat = useMemo(
    () => floatAccounts.find((f) => f.id === dealLocalFloat) ?? null,
    [floatAccounts, dealLocalFloat]
  );

  // The board rate for this pair, offered as the default. A dealer can
  // override it — a manager may give a better rate on a large deal — but the
  // starting point should be what the board says.
  const boardRate = useMemo(() => {
    if (!foreignFloat || !localFloat) return null;
    const direct = rates.find(
      (r) =>
        r.from_currency === foreignFloat.currency && r.to_currency === localFloat.currency
    );
    if (!direct) return null;
    return dealType === 'buy' ? direct.buy_rate : direct.sell_rate;
  }, [rates, foreignFloat, localFloat, dealType]);

  // Prefill the rate when the pair or direction changes, without stamping on
  // a rate the dealer has already typed.
  useEffect(() => {
    if (boardRate != null && dealRate === '') {
      setDealRate(String(boardRate));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardRate]);

  useEffect(() => {
    setDealRate(boardRate != null ? String(boardRate) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealType, dealForeignFloat, dealLocalFloat]);

  const dealLocalAmount = useMemo(() => {
    const amt = parseFloat(dealAmount);
    const rate = parseFloat(dealRate);
    if (Number.isNaN(amt) || Number.isNaN(rate) || amt <= 0 || rate <= 0) return null;
    return Math.round(amt * rate * 100) / 100;
  }, [dealAmount, dealRate]);

  // What the bureau makes on this deal versus the board rate. Shown so an
  // off-book rate is visible before it is committed, not discovered later.
  const dealMargin = useMemo(() => {
    if (boardRate == null || dealLocalAmount == null) return null;
    const amt = parseFloat(dealAmount);
    const rate = parseFloat(dealRate);
    if (Number.isNaN(amt) || Number.isNaN(rate)) return null;
    const atBoard = amt * boardRate;
    const atApplied = amt * rate;
    // Buying: paying out less than board is a gain. Selling: taking in more.
    const diff = dealType === 'buy' ? atBoard - atApplied : atApplied - atBoard;
    return Math.round(diff * 100) / 100;
  }, [boardRate, dealAmount, dealRate, dealType, dealLocalAmount]);

  const handleDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    setDealError(null);

    if (!tenant) {
      setDealError('No institution context. Please sign in again.');
      return;
    }
    if (!dealForeignFloat || !dealLocalFloat) {
      setDealError('Choose both tills for this deal.');
      return;
    }
    if (dealForeignFloat === dealLocalFloat) {
      setDealError('A deal needs two different tills.');
      return;
    }
    if (foreignFloat && localFloat && foreignFloat.currency === localFloat.currency) {
      setDealError('Both tills hold the same currency. A deal needs two different ones.');
      return;
    }
    const amount = parseFloat(dealAmount);
    if (!dealAmount || Number.isNaN(amount) || amount <= 0) {
      setDealError('Enter a valid amount.');
      return;
    }
    const rate = parseFloat(dealRate);
    if (!dealRate || Number.isNaN(rate) || rate <= 0) {
      setDealError('Enter a valid rate.');
      return;
    }

    // Checked here for a clear message; the database enforces it too, so a
    // stale balance on screen cannot let a deal through that the till cannot
    // physically cover.
    if (dealType === 'buy' && localFloat && dealLocalAmount != null) {
      if (Number(localFloat.balance || 0) < dealLocalAmount) {
        setDealError(
          `The ${localFloat.currency} till holds ${Number(localFloat.balance).toLocaleString()}, but this deal pays out ${dealLocalAmount.toLocaleString()}.`
        );
        return;
      }
    }
    if (dealType === 'sell' && foreignFloat) {
      if (Number(foreignFloat.balance || 0) < amount) {
        setDealError(
          `The ${foreignFloat.currency} till holds ${Number(foreignFloat.balance).toLocaleString()}, but this deal sells ${amount.toLocaleString()}.`
        );
        return;
      }
    }

    setDealSubmitting(true);
    try {
      // Both tills move inside one transaction: one leg succeeding alone
      // would either create money or destroy it.
      const { data: result, error } = await supabase.rpc('forex_deal', {
        p_deal_type: dealType,
        p_foreign_float_id: dealForeignFloat,
        p_local_float_id: dealLocalFloat,
        p_foreign_amount: amount,
        p_rate: rate,
        p_customer_id: dealCustomerId || null,
        p_customer_name: dealCustomerName.trim() || null,
        p_notes: dealNotes.trim() || null,
      } as never);
      if (error) throw error;

      const row = (Array.isArray(result) ? result[0] : result) as
        | {
            transaction_id?: string;
            local_amount?: number;
            foreign_balance?: number;
            local_balance?: number;
          }
        | null;

      if (row?.transaction_id && foreignFloat && localFloat) {
        const customer = customers.find((c) => c.id === dealCustomerId);
        const name =
          dealCustomerName.trim() ||
          (customer
            ? customer.customer_type !== 'individual'
              ? customer.business_name || 'Unnamed business'
              : `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
            : 'Walk-in customer');

        setReceiptData(
          buildReceiptData({
            institutionName: tenant.name,
            institutionLogoUrl:
              (tenant.settings as { branding?: { logo_url?: string | null } } | null)?.branding
                ?.logo_url ?? null,
            branchName: branch?.name ?? null,
            transactionId: row.transaction_id,
            reference: row.transaction_id.slice(0, 8).toUpperCase(),
            transactionType: dealType === 'buy' ? 'forex_buy' : 'forex_sell',
            status: 'completed',
            createdAtIso: new Date().toISOString(),
            customerName: name,
            amount,
            currency: foreignFloat.currency,
            // The rate that was actually applied, not today's board rate.
            exchangeRate: rate,
            toCurrency: localFloat.currency,
            amountReceived: row.local_amount ?? null,
            remainingFloatBalance: row.foreign_balance ?? null,
            remainingFloatCurrency: foreignFloat.currency,
            cashierName: admin?.full_name ?? null,
          })
        );
      }

      await loadRates();
      closeDeal();
    } catch (err) {
      console.error('Error recording forex deal:', err);
      setDealError(err instanceof Error ? err.message : 'Failed to record deal');
    } finally {
      setDealSubmitting(false);
    }
  };

  const openCreate = () => {
    setEditingRate(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (rate: ExchangeRate) => {
    setEditingRate(rate);
    setFormData({
      from_currency: rate.from_currency,
      to_currency: rate.to_currency,
      buy_rate: String(rate.buy_rate),
      sell_rate: String(rate.sell_rate),
      reference_rate: rate.reference_rate !== null ? String(rate.reference_rate) : '',
      spread_percent: String(rate.spread_percent ?? 1),
      auto_update: rate.auto_update ?? true,
    });
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingRate(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
  };

  const validateForm = (): string | null => {
    if (formData.from_currency === formData.to_currency) {
      return 'From and To currencies must be different.';
    }
    const buy = parseFloat(formData.buy_rate);
    const sell = parseFloat(formData.sell_rate);
    const spread = parseFloat(formData.spread_percent);
    if (!formData.buy_rate || Number.isNaN(buy) || buy <= 0) return 'Enter a valid buy rate.';
    if (!formData.sell_rate || Number.isNaN(sell) || sell <= 0) return 'Enter a valid sell rate.';
    if (sell < buy) return 'Sell rate is usually greater than or equal to the buy rate.';
    if (Number.isNaN(spread) || spread < 0 || spread > 50) {
      return 'Spread must be between 0 and 50 percent.';
    }
    if (!editingRate) {
      const exists = rates.some(
        (r) => r.from_currency === formData.from_currency && r.to_currency === formData.to_currency
      );
      if (exists) {
        return `An active ${formData.from_currency}/${formData.to_currency} rate already exists. Edit it instead.`;
      }
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!tenant) {
      setFormError('No institution context found. Please sign in again.');
      return;
    }
    if (!canManage) {
      setFormError('You do not have permission to manage rates.');
      return;
    }
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const ref = formData.reference_rate ? parseFloat(formData.reference_rate) : null;

      if (editingRate) {
        const { error } = await supabase
          .from('exchange_rates')
          .update({
            buy_rate: parseFloat(formData.buy_rate),
            sell_rate: parseFloat(formData.sell_rate),
            reference_rate: ref,
            spread_percent: parseFloat(formData.spread_percent) || 0,
            auto_update: formData.auto_update,
          })
          .eq('id', editingRate.id)
          .eq('tenant_id', tenant.id);
        if (error) throw error;
      } else {
        const insert: InsertTables<'exchange_rates'> = {
          tenant_id: tenant.id,
          branch_id: branch?.id ?? null,
          from_currency: formData.from_currency,
          to_currency: formData.to_currency,
          buy_rate: parseFloat(formData.buy_rate),
          sell_rate: parseFloat(formData.sell_rate),
          reference_rate: ref,
          is_active: true,
          spread_percent: parseFloat(formData.spread_percent) || 0,
          auto_update: formData.auto_update,
          created_by: admin?.id ?? null,
        };
        const { error } = await supabase.from('exchange_rates').insert(insert);
        if (error) {
          if ((error as { code?: string }).code === '23505') {
            throw new Error(
              `An active ${formData.from_currency}/${formData.to_currency} rate already exists.`
            );
          }
          throw error;
        }
      }

      await loadRates();
      closeForm();
    } catch (err) {
      console.error('Error saving rate:', err);
      setFormError(err instanceof Error ? err.message : 'Failed to save rate');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (rate: ExchangeRate) => {
    if (!tenant || !canManage) return;
    setTogglingId(rate.id);
    try {
      const { error } = await supabase
        .from('exchange_rates')
        .update({ is_active: !rate.is_active })
        .eq('id', rate.id)
        .eq('tenant_id', tenant.id);
      if (error) throw error;
      await loadRates();
    } catch (err) {
      console.error('Error toggling rate:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to update rate');
    } finally {
      setTogglingId(null);
    }
  };

  const toggleAuto = async (rate: ExchangeRate) => {
    if (!tenant || !canManage) return;
    setTogglingId(rate.id);
    try {
      const { error } = await supabase
        .from('exchange_rates')
        .update({ auto_update: !(rate.auto_update ?? true) })
        .eq('id', rate.id)
        .eq('tenant_id', tenant.id);
      if (error) throw error;
      await loadRates();
    } catch (err) {
      console.error('Error toggling auto-update:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to update rate');
    } finally {
      setTogglingId(null);
    }
  };

  const spread = (r: ExchangeRate): string => {
    if (r.buy_rate === 0) return '0.00';
    return (((r.sell_rate - r.buy_rate) / r.buy_rate) * 100).toFixed(2);
  };

  // Live preview of what the spread will produce, shown in the form.
  const previewFromSpread = useMemo(() => {
    const mid = parseFloat(formData.reference_rate);
    const sp = parseFloat(formData.spread_percent);
    if (Number.isNaN(mid) || mid <= 0 || Number.isNaN(sp)) return null;
    return applySpread(mid, sp);
  }, [formData.reference_rate, formData.spread_percent]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#641f60]">Forex Trading</h1>
          <p className="text-slate-600 mt-1">
            Exchange rates track the market daily and apply your own margin
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={loadRates}
            className="px-4 py-2 border border-[#dae1e1] rounded-lg hover:bg-slate-50 transition-all flex items-center gap-2 text-slate-700"
          >
            <RefreshCw className="w-4 h-4" />
            Reload
          </button>
          {canManage && (
            <button
              onClick={refreshFromMarket}
              disabled={refreshingAll}
              className="px-4 py-2 border border-[#1ebcb2] text-[#1ebcb2] hover:bg-[#1ebcb2]/10 font-medium rounded-lg transition-all flex items-center gap-2 disabled:opacity-50"
              title="Runs the same job scheduled daily. Safe to press any time."
            >
              {refreshingAll ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              Update from market
            </button>
          )}
          {canManage && (
            <button
              onClick={openCreate}
              className="px-4 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Rate
            </button>
          )}
        </div>
      </div>

      {/* Dealing — the actual trade, which the page could not record before.
          Buy and sell are separate buttons because they move the two tills in
          opposite directions and a dealer should choose deliberately. */}
      {canManage && (
        <div className="grid sm:grid-cols-2 gap-3">
          <button
            onClick={() => openDeal('buy')}
            className="flex items-center gap-3 p-4 bg-white border-2 border-[#1ebcb2]/30 hover:border-[#1ebcb2] rounded-xl transition-all text-left group"
          >
            <div className="w-11 h-11 rounded-xl bg-[#1ebcb2]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[#1ebcb2]/20 transition-colors">
              <ArrowDownRight className="w-5 h-5 text-[#1ebcb2]" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900">Buy Currency</p>
              <p className="text-xs text-slate-500">
                Customer brings foreign notes, you pay out local cash
              </p>
            </div>
          </button>
          <button
            onClick={() => openDeal('sell')}
            className="flex items-center gap-3 p-4 bg-white border-2 border-[#ee7b22]/30 hover:border-[#ee7b22] rounded-xl transition-all text-left group"
          >
            <div className="w-11 h-11 rounded-xl bg-[#ee7b22]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[#ee7b22]/20 transition-colors">
              <ArrowUpRight className="w-5 h-5 text-[#ee7b22]" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900">Sell Currency</p>
              <p className="text-xs text-slate-500">
                You hand over foreign notes, customer pays local cash
              </p>
            </div>
          </button>
        </div>
      )}

      {/* Auto-rate explainer */}
      <div className="bg-[#1ebcb2]/[0.07] border border-[#1ebcb2]/25 rounded-xl p-4 flex items-start gap-3">
        <Zap className="w-5 h-5 text-[#1ebcb2] flex-shrink-0 mt-0.5" />
        <div className="text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Automatic daily rates</p>
          <p className="mt-0.5">
            {autoCount} of {rates.length} active pair{rates.length === 1 ? '' : 's'} update
            automatically each morning. The market mid-rate is fetched, then your spread is applied
            either side of it, so your margin is preserved rather than trading at mid-market. Turn
            auto-update off on any pair you want to price by hand.
          </p>
        </div>
      </div>

      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <p className="text-sm text-emerald-800 flex-1">{notice}</p>
          <button onClick={() => setNotice(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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
            onClick={loadRates}
            className="px-4 py-2 bg-[#ee7b22] hover:bg-[#c46040] text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {/* Converter */}
      <div className="bg-white rounded-xl border border-[#dae1e1] p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-[#1ebcb2]" />
            Currency Converter
          </h2>
          <div className="flex bg-slate-100 rounded-lg p-1 text-sm">
            <button
              onClick={() => setConvertMode('buy')}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                convertMode === 'buy' ? 'bg-white text-[#641f60] shadow' : 'text-slate-500'
              }`}
            >
              Buy
            </button>
            <button
              onClick={() => setConvertMode('sell')}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                convertMode === 'sell' ? 'bg-white text-[#641f60] shadow' : 'text-slate-500'
              }`}
            >
              Sell
            </button>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={convertAmount}
              onChange={(e) => setConvertAmount(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">From</label>
            <CurrencySelect value={convertFrom} onChange={setConvertFrom} />
          </div>
          <div className="hidden md:flex items-center justify-center pb-2">
            <ArrowRight className="w-6 h-6 text-slate-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">To</label>
            <CurrencySelect value={convertTo} onChange={setConvertTo} />
          </div>
        </div>
        <div className="mt-4 p-4 bg-[#1ebcb2]/10 rounded-lg">
          {conversion.found ? (
            <>
              <p className="text-sm text-slate-600 flex flex-wrap items-center gap-2">
                <span>
                  {(parseFloat(convertAmount) || 0).toLocaleString()} {convertFrom} =
                </span>
                <span className="text-xl font-bold text-[#641f60] flex items-center gap-1.5">
                  <CurrencyBadge code={convertTo} size={20} />
                  {conversion.result.toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
                  {convertTo}
                </span>
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {convertMode === 'buy' ? 'Buy' : 'Sell'} rate: 1 {convertFrom} ={' '}
                {fmtRate(conversion.rate)} {convertTo}
                {conversion.inverse ? ' (derived from inverse pair)' : ''}
              </p>
            </>
          ) : (
            <p className="text-sm text-[#c46040]">
              No active rate for {convertFrom}/{convertTo}. Add this pair to convert.
            </p>
          )}
        </div>
      </div>

      {/* Rate history chart */}
      <div className="bg-white rounded-xl border border-[#dae1e1] p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#ee7b22]" />
            Rate History
          </h2>
          {pairOptions.length > 0 && (
            <select
              value={chartPair}
              onChange={(e) => setChartPair(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
            >
              {pairOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          )}
        </div>
        {chartData.length > 1 ? (
          <div className="w-full overflow-x-auto">
            <div style={{ width: '100%', minWidth: 320, height: 280 }}>
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} domain={['auto', 'auto']} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="buy"
                    stroke="#1ebcb2"
                    strokeWidth={2}
                    dot={false}
                    name="Buy"
                  />
                  <Line
                    type="monotone"
                    dataKey="sell"
                    stroke="#ee7b22"
                    strokeWidth={2}
                    dot={false}
                    name="Sell"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-slate-400 text-sm">
            {chartData.length === 1
              ? 'Only one data point so far. History builds as this pair updates over time.'
              : 'No history yet. Add rates and let the daily refresh build the trend.'}
          </div>
        )}
      </div>

      {/* Active rates */}
      <div className="bg-white rounded-xl border border-[#dae1e1] overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-[#dae1e1]">
          <h2 className="font-semibold text-slate-900">Active Exchange Rates</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#641f60]" />
          </div>
        ) : rates.length > 0 ? (
          <div className="divide-y divide-[#dae1e1]">
            {rates.map((rate) => {
              const isAuto = rate.auto_update ?? true;
              return (
                <div key={rate.id} className="p-4 sm:p-6 hover:bg-slate-50 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-[#641f60] to-[#ee7b22] flex items-center justify-center text-white flex-shrink-0">
                        <Globe className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-900">
                          <PairLabel from={rate.from_currency} to={rate.to_currency} />
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              isAuto
                                ? 'bg-[#1ebcb2]/10 text-[#0f766e]'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {isAuto ? <Zap className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                            {isAuto ? `Auto · ${rate.spread_percent ?? 1}% spread` : 'Manual'}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                            <Clock className="w-3 h-3" />
                            {isAuto
                              ? `updated ${fmtWhen(rate.last_auto_update)}`
                              : `edited ${fmtWhen(rate.updated_at)}`}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-start gap-4 sm:gap-6">
                      <div className="grid grid-cols-3 gap-3 sm:gap-6 text-center flex-1 sm:flex-initial">
                        <div>
                          <p className="text-xs text-slate-500">Buy</p>
                          <p className="text-base sm:text-lg font-bold text-[#1ebcb2]">
                            {fmtRate(rate.buy_rate)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Sell</p>
                          <p className="text-base sm:text-lg font-bold text-[#ee7b22]">
                            {fmtRate(rate.sell_rate)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Spread</p>
                          <p className="text-base sm:text-lg font-medium text-slate-900">
                            {spread(rate)}%
                          </p>
                        </div>
                      </div>
                      {canManage && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => toggleAuto(rate)}
                            disabled={togglingId === rate.id}
                            className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                              isAuto
                                ? 'text-[#1ebcb2] hover:bg-[#1ebcb2]/10'
                                : 'text-slate-400 hover:text-[#1ebcb2] hover:bg-slate-100'
                            }`}
                            aria-label="Toggle auto-update"
                            title={
                              isAuto
                                ? 'Auto-updating daily. Click to price manually.'
                                : 'Priced manually. Click to track the market.'
                            }
                          >
                            <Zap className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => openEdit(rate)}
                            className="p-2 rounded-lg text-slate-400 hover:text-[#641f60] hover:bg-slate-100 transition-colors"
                            aria-label="Edit rate"
                          >
                            <Pencil className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => toggleActive(rate)}
                            disabled={togglingId === rate.id}
                            className="p-2 rounded-lg text-slate-400 hover:text-[#c46040] hover:bg-slate-100 transition-colors disabled:opacity-50"
                            aria-label="Deactivate rate"
                            title="Deactivate (archives to history)"
                          >
                            {togglingId === rate.id ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <Power className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  {rate.reference_rate !== null && (
                    <p className="text-xs text-slate-400 mt-2">
                      Market mid-rate: {fmtRate(rate.reference_rate)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center px-4">
            <Globe className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No exchange rates configured</p>
            {canManage && (
              <button
                onClick={openCreate}
                className="mt-4 px-4 py-2 bg-[#641f60] hover:bg-[#4a1646] text-white rounded-lg transition-colors"
              >
                Add First Rate
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl shadow-2xl flex flex-col h-full sm:h-auto sm:max-h-[90vh] overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg sm:text-xl font-bold text-[#641f60]">
                {editingRate ? 'Edit Exchange Rate' : 'Add Exchange Rate'}
              </h2>
              <button
                onClick={closeForm}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              id="exchange-rate-form"
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-5 space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    From Currency
                  </label>
                  <CurrencySelect
                    value={formData.from_currency}
                    disabled={!!editingRate}
                    onChange={(v) => setFormData((prev) => ({ ...prev, from_currency: v }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">To Currency</label>
                  <CurrencySelect
                    value={formData.to_currency}
                    disabled={!!editingRate}
                    onChange={(v) => setFormData((prev) => ({ ...prev, to_currency: v }))}
                  />
                </div>
              </div>

              {/* Auto-update + spread */}
              <div className="p-3.5 border border-[#1ebcb2]/30 bg-[#1ebcb2]/[0.05] rounded-lg space-y-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.auto_update}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, auto_update: e.target.checked }))
                    }
                    className="mt-0.5 w-4 h-4 accent-[#1ebcb2]"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">
                      Track the market automatically
                    </span>
                    <span className="block text-xs text-slate-500 mt-0.5">
                      Each morning the mid-rate is fetched and your spread applied. Uncheck to price
                      this pair by hand.
                    </span>
                  </span>
                </label>

                {formData.auto_update && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Your spread (%)
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="50"
                      value={formData.spread_percent}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, spread_percent: e.target.value }))
                      }
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Buy sits {formData.spread_percent || 0}% below the mid-rate, sell the same
                      above. This is your margin.
                    </p>
                    {previewFromSpread && (
                      <div className="mt-2 flex items-center gap-4 text-xs">
                        <span className="text-[#1ebcb2] font-semibold">
                          Buy {fmtRate(previewFromSpread.buy)}
                        </span>
                        <span className="text-[#ee7b22] font-semibold">
                          Sell {fmtRate(previewFromSpread.sell)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={fetchReferenceRate}
                disabled={fetchingRef || formData.from_currency === formData.to_currency}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 border border-[#1ebcb2] text-[#1ebcb2] hover:bg-[#1ebcb2]/10 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {fetchingRef ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Fetch current market rate
              </button>
              <p className="text-xs text-slate-400 -mt-2">
                Pulls today&rsquo;s mid-rate and fills buy/sell using your spread.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Buy Rate *</label>
                  <input
                    type="number"
                    step="0.000001"
                    min="0"
                    required
                    value={formData.buy_rate}
                    onChange={(e) => setFormData((prev) => ({ ...prev, buy_rate: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sell Rate *</label>
                  <input
                    type="number"
                    step="0.000001"
                    min="0"
                    required
                    value={formData.sell_rate}
                    onChange={(e) => setFormData((prev) => ({ ...prev, sell_rate: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Market mid-rate (optional)
                </label>
                <input
                  type="number"
                  step="0.000001"
                  min="0"
                  value={formData.reference_rate}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, reference_rate: e.target.value }))
                  }
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  placeholder="Filled automatically by the daily refresh"
                />
              </div>

              {formData.from_currency !== formData.to_currency && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <PairLabel from={formData.from_currency} to={formData.to_currency} />
                </div>
              )}

              {formError && (
                <div className="p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  {formError}
                </div>
              )}
            </form>

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
                form="exchange-rate-form"
                disabled={submitting}
                className="px-6 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    {editingRate ? 'Save Changes' : 'Add Rate'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deal modal */}
      {showDeal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl shadow-2xl flex flex-col h-full sm:h-auto sm:max-h-[92vh] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-bold text-[#641f60] flex items-center gap-2">
                {dealType === 'buy' ? (
                  <ArrowDownRight className="w-5 h-5 text-[#1ebcb2]" />
                ) : (
                  <ArrowUpRight className="w-5 h-5 text-[#ee7b22]" />
                )}
                {dealType === 'buy' ? 'Buy Currency' : 'Sell Currency'}
              </h2>
              <button
                type="button"
                onClick={closeDeal}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              id="forex-deal-form"
              onSubmit={handleDeal}
              className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 space-y-4"
            >
              {/* Direction toggle, so a dealer who opened the wrong one does
                  not have to close and start again. */}
              <div className="flex bg-slate-100 rounded-lg p-1 text-sm">
                <button
                  type="button"
                  onClick={() => setDealType('buy')}
                  className={`flex-1 px-3 py-1.5 rounded-md font-medium transition-all ${
                    dealType === 'buy' ? 'bg-white text-[#1ebcb2] shadow' : 'text-slate-500'
                  }`}
                >
                  Buy from customer
                </button>
                <button
                  type="button"
                  onClick={() => setDealType('sell')}
                  className={`flex-1 px-3 py-1.5 rounded-md font-medium transition-all ${
                    dealType === 'sell' ? 'bg-white text-[#ee7b22] shadow' : 'text-slate-500'
                  }`}
                >
                  Sell to customer
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Foreign currency till *
                  </label>
                  <select
                    required
                    value={dealForeignFloat}
                    onChange={(e) => setDealForeignFloat(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]"
                  >
                    <option value="">Choose till</option>
                    {floatAccounts.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.currency} — {Number(f.balance || 0).toLocaleString()}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {dealType === 'buy' ? 'Receives the notes' : 'Hands over the notes'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Local currency till *
                  </label>
                  <select
                    required
                    value={dealLocalFloat}
                    onChange={(e) => setDealLocalFloat(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]"
                  >
                    <option value="">Choose till</option>
                    {floatAccounts
                      .filter((f) => !foreignFloat || f.currency !== foreignFloat.currency)
                      .map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.currency} — {Number(f.balance || 0).toLocaleString()}
                        </option>
                      ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {dealType === 'buy' ? 'Pays out the cash' : 'Takes in the cash'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Amount {foreignFloat ? `(${foreignFloat.currency})` : ''} *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={dealAmount}
                    onChange={(e) => setDealAmount(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Rate *</label>
                  <input
                    type="number"
                    step="0.000001"
                    min="0"
                    required
                    value={dealRate}
                    onChange={(e) => setDealRate(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]"
                  />
                  {boardRate != null && (
                    <p className="text-[11px] text-slate-400 mt-1">
                      Board {dealType}: {fmtRate(boardRate)}
                    </p>
                  )}
                </div>
              </div>

              {/* What the customer actually gets, and what the bureau makes.
                  Shown before committing so an off-book rate is a decision
                  rather than a discovery. */}
              {dealLocalAmount != null && foreignFloat && localFloat && (
                <div className="p-3.5 bg-[#1ebcb2]/[0.07] border border-[#1ebcb2]/25 rounded-lg space-y-1.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">
                      {dealType === 'buy' ? 'Customer receives' : 'Customer pays'}
                    </span>
                    <span className="font-bold text-slate-900">
                      {localFloat.currency} {dealLocalAmount.toLocaleString()}
                    </span>
                  </div>
                  {dealMargin != null && Math.abs(dealMargin) > 0.004 && (
                    <div className="flex items-center justify-between pt-1.5 border-t border-[#1ebcb2]/20">
                      <span className="text-slate-600">
                        {dealMargin >= 0 ? 'Gain against board' : 'Cost against board'}
                      </span>
                      <span
                        className={`font-semibold ${
                          dealMargin >= 0 ? 'text-[#1ebcb2]' : 'text-[#c46040]'
                        }`}
                      >
                        {localFloat.currency} {Math.abs(dealMargin).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Customer (optional)
                </label>
                <select
                  value={dealCustomerId}
                  onChange={(e) => setDealCustomerId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]"
                >
                  <option value="">Walk-in customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.customer_type !== 'individual'
                        ? c.business_name || 'Unnamed business'
                        : `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unnamed'}
                    </option>
                  ))}
                </select>
              </div>

              {!dealCustomerId && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Name for the receipt
                  </label>
                  <input
                    type="text"
                    value={dealCustomerName}
                    onChange={(e) => setDealCustomerName(e.target.value)}
                    placeholder="Walk-in customer"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={dealNotes}
                  onChange={(e) => setDealNotes(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]"
                />
              </div>

              {dealError && (
                <div className="p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {dealError}
                </div>
              )}
            </form>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-3 px-5 py-4 border-t border-slate-200 flex-shrink-0 bg-white">
              <button
                type="button"
                onClick={closeDeal}
                className="px-4 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="forex-deal-form"
                disabled={dealSubmitting}
                className={`px-6 py-2.5 text-white font-medium rounded-lg shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 ${
                  dealType === 'buy'
                    ? 'bg-[#1ebcb2] hover:bg-[#159089]'
                    : 'bg-[#ee7b22] hover:bg-[#c46040]'
                }`}
              >
                {dealSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Recording...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Complete Deal
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {receiptData && (
        <ReceiptModal data={receiptData} onClose={() => setReceiptData(null)} />
      )}
    </div>
  );
}