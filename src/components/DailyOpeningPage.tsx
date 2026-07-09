import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Tables, InsertTables, Json } from '../lib/supabase';
import type { TenantSettings } from '../types';
import { useTenantExchangeRates, lookupRate } from '../lib/forexRates';
import {
  CURRENCY_OPTIONS,
  REFERENCE_ACCOUNTS,
  REFERENCE_ACCOUNT_LABELS,
  type AccountCurrencyMap,
  currencyForKey,
  formatMoney,
  resolveAccountCurrencies,
  accountCurrenciesDiffer,
} from '../lib/accountCurrencies';
import {
  Sunrise,
  Loader2,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Lock,
  Wallet,
  Banknote,
  Landmark,
  Smartphone,
  Coins,
  Check,
  Save,
  Globe,
  ArrowRight,
  ChevronDown,
} from 'lucide-react';

// ============================================================================
// Real flag badges — inline SVG instead of emoji flags. Emoji flags (used by
// CURRENCY_OPTIONS / currencyFlag() previously) render as plain two-letter
// codes on Windows and some Android browsers because those platforms don't
// ship the regional-indicator glyphs. Inline SVG is crisp everywhere and
// needs no font support. Shared visual language with Transactions/Transfers/
// Wallets pages.
// ============================================================================

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

function CurrencyBadge({ code, size = 20 }: { code: string; size?: number }) {
  const clipId = `daily-open-flag-${code}`;
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

// Custom dropdown (not a native <select>) so a real flag SVG can render next
// to each option — native <option> elements only support plain text, which
// is why emoji were being used there in the first place.
function FlagCurrencySelect({
  value,
  onChange,
  options,
  baseCurrency,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  baseCurrency?: string;
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
        className="w-full flex items-center gap-2 px-2 py-2 border border-slate-300 rounded-md bg-white text-left hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1ebcb2]"
      >
        <CurrencyBadge code={value} size={18} />
        <span className="flex-1 min-w-0 truncate text-sm font-medium text-slate-800">
          {value}
          {baseCurrency && value === baseCurrency ? ' (base)' : ''}
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {options.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => {
                onChange(code);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                code === value ? 'bg-[#1ebcb2]/10' : ''
              }`}
            >
              <CurrencyBadge code={code} size={18} />
              <span className={code === value ? 'text-[#641f60] font-medium' : 'text-slate-700'}>
                {code}
                {baseCurrency && code === baseCurrency ? ' (base)' : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type DailyOperation = Tables<'daily_operations'>;

interface BalanceRow {
  key: string;
  label: string;
  amount: string;
}

// Real-time forex: poll in the background on top of the manual refresh
// button, so the conversion math staff sees never goes stale mid-session.
const AUTO_REFRESH_INTERVAL_MS = 45_000;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function ChannelIcon({ channelKey, className }: { channelKey: string; className?: string }) {
  if (channelKey.startsWith('cash_')) return <Banknote className={className} />;
  if (channelKey === 'bank') return <Landmark className={className} />;
  if (channelKey === 'mtn_momo' || channelKey === 'mpesa') return <Smartphone className={className} />;
  return <Wallet className={className} />;
}

// Distinct brand-color accent per channel type instead of every card being
// flat white — cash = teal, mobile money = orange, bank = purple.
function channelAccent(key: string): { border: string; iconBg: string; iconColor: string } {
  if (key.startsWith('cash_')) return { border: 'border-t-[#1ebcb2]', iconBg: 'bg-[#1ebcb2]/10', iconColor: 'text-[#1ebcb2]' };
  if (key === 'mtn_momo' || key === 'mpesa') return { border: 'border-t-[#ee7b22]', iconBg: 'bg-[#ee7b22]/10', iconColor: 'text-[#ee7b22]' };
  if (key === 'bank') return { border: 'border-t-[#641f60]', iconBg: 'bg-[#641f60]/10', iconColor: 'text-[#641f60]' };
  return { border: 'border-t-slate-300', iconBg: 'bg-slate-100', iconColor: 'text-slate-500' };
}

function buildRows(
  currencies: string[],
  prefill: Record<string, number>,
  existing: BalanceRow[]
): BalanceRow[] {
  const existingMap = new Map(existing.map((r) => [r.key, r.amount]));

  const valueFor = (key: string): string => {
    const kept = existingMap.get(key);
    if (kept !== undefined) return kept;
    return prefill[key] !== undefined ? String(prefill[key]) : '';
  };

  const currencyRows: BalanceRow[] = currencies.map((c) => ({
    key: `cash_${c}`,
    label: `Cash (${c})`,
    amount: valueFor(`cash_${c}`),
  }));

  const fixedRows: BalanceRow[] = REFERENCE_ACCOUNTS.map((acc) => ({
    key: acc,
    label: REFERENCE_ACCOUNT_LABELS[acc],
    amount: valueFor(acc),
  }));

  return [...currencyRows, ...fixedRows];
}

function parseBalances(json: Json): Record<string, number> {
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
      const num = typeof v === 'number' ? v : parseFloat(String(v));
      if (!Number.isNaN(num)) out[k] = num;
    }
    return out;
  }
  return {};
}

type TenantSettingsShape = Partial<TenantSettings> & {
  base_currency?: string;
  account_currencies?: AccountCurrencyMap;
  [key: string]: unknown;
};

function StatusPill({ state }: { state: 'pending' | 'open' | 'closed' | 'blocked' }) {
  const styles: Record<typeof state, string> = {
    pending: 'bg-[#ee7b22]/10 text-[#ee7b22] border-[#ee7b22]/30',
    open: 'bg-[#1ebcb2]/10 text-[#1ebcb2] border-[#1ebcb2]/30',
    closed: 'bg-[#641f60]/10 text-[#641f60] border-[#641f60]/30',
    blocked: 'bg-[#c46040]/10 text-[#c46040] border-[#c46040]/30',
  };
  const labels: Record<typeof state, string> = {
    pending: 'Not opened',
    open: 'Open',
    closed: 'Closed',
    blocked: 'Blocked',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${styles[state]}`}>
      {labels[state]}
    </span>
  );
}

// --- Live rates indicator ----------------------------------------------------

function useTicker(intervalMs = 1000) {
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}

function elapsedLabel(sinceMs: number | null): string {
  if (sinceMs === null) return 'never';
  const seconds = Math.max(0, Math.floor((Date.now() - sinceMs) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function LiveRatesBadge({
  lastUpdated,
  loading,
  onRefresh,
}: {
  lastUpdated: number | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  useTicker(1000);
  return (
    <div className="flex items-center gap-2 flex-wrap shrink-0">
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium bg-[#1ebcb2]/10 text-[#1ebcb2]">
        <span className="relative flex h-2 w-2">
          <span
            className={`absolute inline-flex h-full w-full rounded-full bg-[#1ebcb2] opacity-75 ${
              loading ? 'animate-ping' : 'animate-pulse'
            }`}
          />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1ebcb2]" />
        </span>
        Live &middot; {loading ? 'updating…' : `updated ${elapsedLabel(lastUpdated)}`}
      </span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:border-[#641f60] hover:text-[#641f60] disabled:opacity-50 transition-all"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        Refresh
      </button>
    </div>
  );
}

export function DailyOpeningPage() {
  const { tenant, branch, admin } = useAuth();

  const [todaysOp, setTodaysOp] = useState<DailyOperation | null>(null);
  const [unclosedPriorOp, setUnclosedPriorOp] = useState<DailyOperation | null>(null);
  const [lastClosingBalances, setLastClosingBalances] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [rows, setRows] = useState<BalanceRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>(['KES']);
  const [baseCurrency, setBaseCurrency] = useState<string>('KES');
  const [accountCurrencies, setAccountCurrencies] = useState<AccountCurrencyMap>({});
  const [manualRates, setManualRates] = useState<Record<string, string>>({});
  // Live-API fallback: when a pair isn't configured in Forex Trading, we
  // auto-fetch a mid-market rate from the same free API the Forex page uses
  // (open.er-api.com) instead of immediately asking for manual entry.
  const [liveRates, setLiveRates] = useState<Record<string, number>>({});
  const [liveRateLoading, setLiveRateLoading] = useState<Record<string, boolean>>({});
  const [liveRateError, setLiveRateError] = useState<Record<string, string>>({});
  const settingsInitialized = useRef(false);

  const [savingDefault, setSavingDefault] = useState(false);
  const [defaultSaved, setDefaultSaved] = useState(false);
  const [defaultSaveError, setDefaultSaveError] = useState<string | null>(null);

  const { rates: fxRates, loading: fxLoading, error: fxError, reload: reloadFx } = useTenantExchangeRates(tenant?.id);

  // --- Real-time forex: poll in the background + track "updated Xs ago" ----
  const [lastRatesUpdate, setLastRatesUpdate] = useState<number | null>(null);
  const prevFxLoadingRef = useRef(fxLoading);
  useEffect(() => {
    if (prevFxLoadingRef.current && !fxLoading) setLastRatesUpdate(Date.now());
    prevFxLoadingRef.current = fxLoading;
  }, [fxLoading]);

  const reloadFxRef = useRef(reloadFx);
  useEffect(() => {
    reloadFxRef.current = reloadFx;
  }, [reloadFx]);
  useEffect(() => {
    const id = setInterval(() => reloadFxRef.current(), AUTO_REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const tenantSettings = useMemo<TenantSettingsShape>(
    () => (tenant?.settings ?? {}) as TenantSettingsShape,
    [tenant]
  );
  const tenantDefaultCurrencies = useMemo(
    () => (tenantSettings.enabled_currencies?.length ? tenantSettings.enabled_currencies : ['KES']),
    [tenantSettings]
  );
  const tenantDefaultBase = useMemo(
    () => tenantSettings.base_currency ?? tenantSettings.default_currency ?? tenantDefaultCurrencies[0] ?? 'KES',
    [tenantSettings, tenantDefaultCurrencies]
  );
  const tenantDefaultAccountCurrencies = useMemo(
    () => resolveAccountCurrencies(tenantSettings.account_currencies, tenantDefaultBase),
    [tenantSettings, tenantDefaultBase]
  );

  useEffect(() => {
    if (!settingsInitialized.current && tenant) {
      setSelectedCurrencies(tenantDefaultCurrencies);
      setBaseCurrency(tenantDefaultBase);
      setAccountCurrencies(tenantDefaultAccountCurrencies);
      settingsInitialized.current = true;
    }
  }, [tenant, tenantDefaultCurrencies, tenantDefaultBase, tenantDefaultAccountCurrencies]);

  const loadState = useCallback(async () => {
    if (!tenant || !branch) return;
    setLoading(true);
    setLoadError(null);
    try {
      const today = todayIso();

      const { data: todayRow, error: todayError } = await supabase
        .from('daily_operations')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('branch_id', branch.id)
        .eq('operation_date', today)
        .maybeSingle();
      if (todayError) throw todayError;
      setTodaysOp(todayRow);

      const { data: priorRows, error: priorError } = await supabase
        .from('daily_operations')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('branch_id', branch.id)
        .neq('operation_date', today)
        .order('operation_date', { ascending: false })
        .limit(5);
      if (priorError) throw priorError;

      const unclosed = (priorRows ?? []).find((r) => r.state !== 'closed') ?? null;
      setUnclosedPriorOp(unclosed);

      const lastClosed = (priorRows ?? []).find((r) => r.state === 'closed');
      setLastClosingBalances(lastClosed ? parseBalances(lastClosed.closing_balances) : {});
    } catch (err) {
      console.error('Error loading daily opening state:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load daily opening status');
    } finally {
      setLoading(false);
    }
  }, [tenant, branch]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  useEffect(() => {
    if (todaysOp) return;
    setRows((prev) => buildRows(selectedCurrencies, lastClosingBalances, prev));
  }, [selectedCurrencies, lastClosingBalances, todaysOp]);

  const toggleCurrency = (code: string) => {
    setFormError(null);
    setSelectedCurrencies((prev) => {
      let next: string[];
      if (prev.includes(code)) {
        if (prev.length === 1) return prev; // keep at least one selected
        next = prev.filter((c) => c !== code);
      } else {
        next = [...prev, code].sort();
      }
      setBaseCurrency((currentBase) => {
        const nextBase = next.includes(currentBase) ? currentBase : next[0];
        setAccountCurrencies((prevAcc) => {
          const updated: AccountCurrencyMap = { ...prevAcc };
          for (const acc of REFERENCE_ACCOUNTS) {
            if (!next.includes(updated[acc])) updated[acc] = nextBase;
          }
          return updated;
        });
        return nextBase;
      });
      return next;
    });
  };

  const setBase = (code: string) => {
    setBaseCurrency(code);
    setAccountCurrencies((prevAcc) => {
      const updated: AccountCurrencyMap = { ...prevAcc };
      for (const acc of REFERENCE_ACCOUNTS) {
        if (!selectedCurrencies.includes(updated[acc])) updated[acc] = code;
      }
      return updated;
    });
  };

  const setAccountCurrency = (account: string, code: string) => {
    setFormError(null);
    setAccountCurrencies((prev) => ({ ...prev, [account]: code }));
  };

  const updateManualRate = (code: string, value: string) => {
    setManualRates((prev) => ({ ...prev, [code]: value }));
  };

  const handleSaveDefaultCurrencies = async () => {
    if (!tenant) return;
    setSavingDefault(true);
    setDefaultSaveError(null);
    setDefaultSaved(false);
    try {
      const existingSettings = (tenant.settings ?? {}) as TenantSettings;
      const updatedSettings = {
        ...existingSettings,
        enabled_currencies: selectedCurrencies,
        default_currency: baseCurrency,
        base_currency: baseCurrency,
        account_currencies: accountCurrencies,
      };
      const { error } = await supabase
        .from('tenants')
        .update({
          settings: updatedSettings,
        })
        .eq('id', tenant.id);
      if (error) throw error;
      setDefaultSaved(true);
    } catch (err) {
      console.error('Error saving default currencies:', err);
      setDefaultSaveError(err instanceof Error ? err.message : 'Failed to save default currencies');
    } finally {
      setSavingDefault(false);
    }
  };

  const updateRow = (key: string, amount: string) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, amount } : r)));
  };

  // Fetches a mid-market rate for `code -> base` from open.er-api.com (free,
  // no API key) and caches it. This runs automatically for any currency
  // that isn't configured in Forex Trading, so staff aren't blocked on
  // manual entry unless the live lookup itself fails too.
  const fetchLiveRate = useCallback(async (code: string, base: string) => {
    const key = `${code}->${base}`;
    setLiveRateLoading((prev) => ({ ...prev, [key]: true }));
    setLiveRateError((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    try {
      const res = await fetch(`https://open.er-api.com/v6/latest/${code}`);
      if (!res.ok) throw new Error(`Rate service returned ${res.status}`);
      const data = await res.json();
      const rate = data?.rates?.[base];
      if (typeof rate !== 'number') throw new Error(`No live rate available for ${code}/${base}`);
      setLiveRates((prev) => ({ ...prev, [key]: rate }));
    } catch (err) {
      console.error(`Error fetching live rate for ${key}:`, err);
      setLiveRateError((prev) => ({
        ...prev,
        [key]: err instanceof Error ? err.message : 'Failed to fetch live rate',
      }));
    } finally {
      setLiveRateLoading((prev) => ({ ...prev, [key]: false }));
    }
  }, []);

  const resolvedRate = useCallback(
    (code: string): number | null => {
      if (code === baseCurrency) return 1;
      const fx = lookupRate(fxRates, code, baseCurrency, 'buy');
      if (fx !== null) return fx;
      const liveKey = `${code}->${baseCurrency}`;
      if (liveRates[liveKey] !== undefined) return liveRates[liveKey];
      const manual = parseFloat(manualRates[code] ?? '');
      return Number.isFinite(manual) && manual > 0 ? manual : null;
    },
    [fxRates, baseCurrency, manualRates, liveRates]
  );

  const rateSource = useCallback(
    (code: string): 'base' | 'forex' | 'live' | 'loading' | 'manual' | 'missing' => {
      if (code === baseCurrency) return 'base';
      if (lookupRate(fxRates, code, baseCurrency, 'buy') !== null) return 'forex';
      const liveKey = `${code}->${baseCurrency}`;
      if (liveRates[liveKey] !== undefined) return 'live';
      if (liveRateLoading[liveKey]) return 'loading';
      const manual = parseFloat(manualRates[code] ?? '');
      if (Number.isFinite(manual) && manual > 0) return 'manual';
      return 'missing';
    },
    [fxRates, baseCurrency, manualRates, liveRates, liveRateLoading]
  );

  const totalInBase = useMemo(
    () =>
      rows.reduce((sum, r) => {
        const amt = parseFloat(r.amount) || 0;
        const code = currencyForKey(r.key, accountCurrencies, baseCurrency);
        const rate = resolvedRate(code);
        return sum + amt * (rate ?? 0);
      }, 0),
    [rows, accountCurrencies, baseCurrency, resolvedRate]
  );

  const activeCurrencies = useMemo(() => {
    const set = new Set<string>(selectedCurrencies);
    for (const acc of REFERENCE_ACCOUNTS) {
      if (accountCurrencies[acc]) set.add(accountCurrencies[acc]);
    }
    return Array.from(set).sort();
  }, [selectedCurrencies, accountCurrencies]);

  const currenciesNeedingRates = activeCurrencies.filter((c) => c !== baseCurrency);
  const missingRateCurrencies = currenciesNeedingRates.filter((c) => rateSource(c) === 'missing');

  // Auto-fetch a live rate for any currency that Forex Trading doesn't have
  // configured yet. Only fires once per pair per session (skips if already
  // cached, currently loading, or already failed) — the Refresh button
  // retries failures explicitly.
  useEffect(() => {
    currenciesNeedingRates.forEach((code) => {
      if (lookupRate(fxRates, code, baseCurrency, 'buy') !== null) return;
      const key = `${code}->${baseCurrency}`;
      if (liveRates[key] !== undefined) return;
      if (liveRateLoading[key]) return;
      if (liveRateError[key]) return;
      fetchLiveRate(code, baseCurrency);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currenciesNeedingRates.join(','), fxRates, baseCurrency]);

  const validate = (): string | null => {
    if (unclosedPriorOp) {
      return `${new Date(unclosedPriorOp.operation_date).toLocaleDateString()} has not been closed yet. Complete Daily Closing for that day before opening today.`;
    }
    if (selectedCurrencies.length === 0) {
      return 'Select at least one currency for today.';
    }
    if (missingRateCurrencies.length > 0) {
      return `No exchange rate found for ${missingRateCurrencies.join(', ')} → ${baseCurrency}. Add the pair in Forex Trading, or enter a manual rate below.`;
    }
    const hasAnyAmount = rows.some((r) => r.amount.trim() !== '' && parseFloat(r.amount) >= 0);
    if (!hasAnyAmount) return 'Enter at least one opening balance.';
    for (const r of rows) {
      if (r.amount.trim() !== '' && parseFloat(r.amount) < 0) {
        return `${r.label} cannot be negative.`;
      }
    }
    return null;
  };

  const handleOpen = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!tenant || !branch || !admin) {
      setFormError('No institution or branch context found. Please sign in again.');
      return;
    }

    const validationError = validate();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const balances: Record<string, number> = {};
      rows.forEach((r) => {
        balances[r.key] = parseFloat(r.amount) || 0;
      });

      const insert: InsertTables<'daily_operations'> = {
        tenant_id: tenant.id,
        branch_id: branch.id,
        operation_date: todayIso(),
        state: 'active',
        opening_balances: balances,
        opened_by: admin.id,
        opened_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('daily_operations').insert(insert);
      if (error) {
        if ((error as { code?: string }).code === '23505') {
          throw new Error('Today has already been opened for this branch.');
        }
        throw error;
      }

      // Persist the account-currency configuration used today so that Daily
      // Closing values the same balances with the same currencies. Best-effort:
      // the day is already open, so a settings hiccup here should not fail it.
      try {
        const existingSettings = (tenant.settings ?? {}) as TenantSettings;
        const needsUpdate =
          accountCurrenciesDiffer(accountCurrencies, tenantDefaultAccountCurrencies) ||
          (existingSettings as TenantSettingsShape).base_currency !== baseCurrency;
        if (needsUpdate) {
          await supabase
            .from('tenants')
            .update({
              settings: {
                ...existingSettings,
                base_currency: baseCurrency,
                account_currencies: accountCurrencies,
              },
            })
            .eq('id', tenant.id);
        }
      } catch (persistErr) {
        console.warn('Opened the day, but failed to persist currency settings:', persistErr);
      }

      await loadState();
    } catch (err) {
      console.error('Error opening the day:', err);
      setFormError(err instanceof Error ? err.message : 'Failed to complete daily opening');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefreshRates = useCallback(() => {
    reloadFx();
    currenciesNeedingRates.forEach((code) => {
      if (lookupRate(fxRates, code, baseCurrency, 'buy') !== null) return;
      const key = `${code}->${baseCurrency}`;
      if (liveRateLoading[key]) return;
      fetchLiveRate(code, baseCurrency);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadFx, currenciesNeedingRates.join(','), fxRates, baseCurrency, fetchLiveRate]);

  const pageStatus: 'pending' | 'open' | 'closed' | 'blocked' = unclosedPriorOp
    ? 'blocked'
    : !todaysOp
    ? 'pending'
    : todaysOp.state === 'closed'
    ? 'closed'
    : 'open';

  const defaultsDiffer =
    baseCurrency !== tenantDefaultBase ||
    selectedCurrencies.length !== tenantDefaultCurrencies.length ||
    selectedCurrencies.some((c) => !tenantDefaultCurrencies.includes(c)) ||
    accountCurrenciesDiffer(accountCurrencies, tenantDefaultAccountCurrencies);

  const accountCurrencyChoices = useMemo(() => {
    const set = new Set<string>(selectedCurrencies);
    set.add(baseCurrency);
    return Array.from(set).sort();
  }, [selectedCurrencies, baseCurrency]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <Loader2 className="w-8 h-8 animate-spin text-[#641f60]" />
        <p className="text-sm text-slate-500">Loading today&rsquo;s status&hellip;</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#ee7b22] to-[#c46040] text-white shadow-lg shrink-0">
            <Sunrise className="w-7 h-7" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-[#641f60]">Daily Opening</h1>
              {branch && <StatusPill state={pageStatus} />}
            </div>
            <p className="text-slate-600 mt-1">
              {branch
                ? `${branch.name} — ${new Date().toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}`
                : 'Select a branch to continue'}
            </p>
          </div>
        </div>
      </div>

      {loadError && (
        <div className="bg-[#c46040]/10 border border-[#c46040]/30 rounded-xl p-4 flex flex-wrap items-center gap-4" role="alert">
          <div className="w-11 h-11 rounded-full bg-[#c46040]/15 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-6 h-6 text-[#c46040]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-[#c46040]">Something went wrong</h3>
            <p className="text-sm text-slate-600 break-words">{loadError}</p>
          </div>
          <button
            onClick={loadState}
            className="px-4 py-2 bg-[#ee7b22] hover:bg-[#c46040] text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 shrink-0"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {!branch ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-500">
          <Wallet className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          No branch is currently selected.
        </div>
      ) : unclosedPriorOp ? (
        <div className="bg-[#c46040]/5 border border-[#c46040]/30 rounded-xl p-6 flex items-start gap-4">
          <div className="w-11 h-11 rounded-full bg-[#c46040]/15 flex items-center justify-center flex-shrink-0">
            <Lock className="w-6 h-6 text-[#c46040]" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-[#c46040] mb-1">Previous day not yet closed</h3>
            <p className="text-sm text-slate-700 break-words">
              {new Date(unclosedPriorOp.operation_date).toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}{' '}
              is still <span className="font-medium capitalize">{unclosedPriorOp.state.replace(/_/g, ' ')}</span>. Go
              to Daily Closing and finish that day before opening today.
            </p>
          </div>
        </div>
      ) : todaysOp ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 bg-[#1ebcb2]/10 border-b border-[#1ebcb2]/20 flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-[#1ebcb2] shrink-0" />
            <div className="min-w-0">
              <h3 className="font-semibold text-[#641f60]">
                {todaysOp.state === 'closed' ? 'Today is already closed' : 'Already opened for today'}
              </h3>
              <p className="text-sm text-slate-600">
                Opened at {todaysOp.opened_at ? new Date(todaysOp.opened_at).toLocaleTimeString() : '—'}
              </p>
            </div>
          </div>
          <div className="p-6">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Opening Balances</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {Object.entries(parseBalances(todaysOp.opening_balances)).map(([key, value]) => {
                const accent = channelAccent(key);
                return (
                  <div
                    key={key}
                    className={`border border-slate-200 border-t-4 ${accent.border} rounded-xl bg-white shadow-sm p-4 text-center min-w-0`}
                  >
                    <div className={`w-9 h-9 rounded-full ${accent.iconBg} flex items-center justify-center mx-auto mb-2`}>
                      <ChannelIcon channelKey={key} className={`w-4 h-4 ${accent.iconColor}`} />
                    </div>
                    <p className="text-xs text-slate-500 capitalize mb-1 truncate">{key.replace(/_/g, ' ')}</p>
                    <p className="font-semibold text-slate-900 text-sm break-words">
                      {formatMoney(value, currencyForKey(key, tenantDefaultAccountCurrencies, tenantDefaultBase))}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleOpen} className="space-y-6">
          {/* Currency selection */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#1ebcb2]/10 flex items-center justify-center flex-shrink-0">
                <Coins className="w-5 h-5 text-[#1ebcb2]" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-900">Currencies for Today</h3>
                <p className="text-sm text-slate-500">
                  Choose which currencies this branch will handle today.
                </p>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div className="flex flex-wrap gap-2">
                {CURRENCY_OPTIONS.map((c) => {
                  const active = selectedCurrencies.includes(c.code);
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => toggleCurrency(c.code)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all shrink-0 ${
                        active
                          ? 'border-[#1ebcb2] bg-[#1ebcb2]/10 text-[#641f60]'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                      aria-pressed={active}
                    >
                      {active && <Check className="w-3.5 h-3.5 text-[#1ebcb2] shrink-0" />}
                      <CurrencyBadge code={c.code} size={18} />
                      <span>{c.code}</span>
                    </button>
                  );
                })}
              </div>

              {selectedCurrencies.length > 1 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">Base currency</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedCurrencies.map((code) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => setBase(code)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all shrink-0 ${
                          baseCurrency === code
                            ? 'border-[#641f60] bg-[#641f60]/10 text-[#641f60]'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <CurrencyBadge code={code} size={16} />
                        {code}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Reference account currencies — configurable, defaulting to base */}
              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">
                  Reference account currencies
                </p>
                <p className="text-xs text-slate-400 mb-3">
                  Set the currency each channel is held in. Defaults to the base currency ({baseCurrency}).
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {REFERENCE_ACCOUNTS.map((acc) => (
                    <div key={acc} className="border border-slate-200 rounded-lg p-3 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center shrink-0">
                          <ChannelIcon channelKey={acc} className="w-4 h-4 text-slate-400" />
                        </div>
                        <span className="text-sm font-medium text-slate-700 truncate">
                          {REFERENCE_ACCOUNT_LABELS[acc]}
                        </span>
                      </div>
                      <label htmlFor={`acc-cur-${acc}`} className="sr-only">
                        {REFERENCE_ACCOUNT_LABELS[acc]} currency
                      </label>
                      <FlagCurrencySelect
                        value={accountCurrencies[acc] ?? baseCurrency}
                        onChange={(code) => setAccountCurrency(acc, code)}
                        options={accountCurrencyChoices}
                        baseCurrency={baseCurrency}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleSaveDefaultCurrencies}
                  disabled={savingDefault || !defaultsDiffer}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:border-[#641f60] hover:text-[#641f60] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {savingDefault ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save as institution default
                </button>
                {defaultSaved && !defaultsDiffer && (
                  <span className="text-xs text-[#1ebcb2] font-medium flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Saved
                  </span>
                )}
                {defaultSaveError && <span className="text-xs text-[#c46040] break-words">{defaultSaveError}</span>}
              </div>
            </div>
          </div>

          {/* Today's rates, sourced from Forex Trading — now live */}
          {currenciesNeedingRates.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-[#ee7b22]/10 flex items-center justify-center flex-shrink-0">
                    <Globe className="w-5 h-5 text-[#ee7b22]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900">Today&rsquo;s Rates</h3>
                    <p className="text-sm text-slate-500">
                      Pulled from Forex Trading &middot; buy rate, converting into {baseCurrency}.
                    </p>
                  </div>
                </div>
                <LiveRatesBadge lastUpdated={lastRatesUpdate} loading={fxLoading} onRefresh={handleRefreshRates} />
              </div>

              {fxError && (
                <div className="mx-6 mt-4 p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm break-words">
                  {fxError}
                </div>
              )}

              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {currenciesNeedingRates.map((code) => {
                  const source = rateSource(code);
                  const fx = lookupRate(fxRates, code, baseCurrency, 'buy');
                  const liveKey = `${code}->${baseCurrency}`;
                  const liveValue = liveRates[liveKey];
                  const liveErr = liveRateError[liveKey];
                  return (
                    <div key={code} className="border border-slate-200 rounded-lg p-3 min-w-0 transition-all hover:shadow-sm">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-sm font-medium text-slate-700 whitespace-nowrap flex items-center gap-1.5">
                          <CurrencyBadge code={code} size={16} />1 {code} =
                          <CurrencyBadge code={baseCurrency} size={16} />
                          {baseCurrency}
                        </span>
                        {source === 'forex' && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#1ebcb2]/10 text-[#1ebcb2] shrink-0">
                            Forex
                          </span>
                        )}
                        {source === 'live' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 shrink-0">
                            <Globe className="w-2.5 h-2.5" />
                            Live API
                          </span>
                        )}
                        {source === 'loading' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            Fetching
                          </span>
                        )}
                        {source === 'manual' && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#ee7b22]/10 text-[#ee7b22] shrink-0">
                            Manual
                          </span>
                        )}
                        {source === 'missing' && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#c46040]/10 text-[#c46040] shrink-0">
                            Missing
                          </span>
                        )}
                      </div>

                      {source === 'forex' && fx !== null ? (
                        <p className="text-lg font-bold text-slate-900">
                          {fx.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                        </p>
                      ) : source === 'live' && liveValue !== undefined ? (
                        <div>
                          <p className="text-lg font-bold text-slate-900">
                            {liveValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Auto-fetched &middot; not yet saved in Forex Trading
                          </p>
                        </div>
                      ) : source === 'loading' ? (
                        <div className="flex items-center gap-2 py-1.5 text-sm text-slate-400">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Fetching live rate&hellip;
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <input
                            type="number"
                            step="0.000001"
                            min="0"
                            value={manualRates[code] ?? ''}
                            onChange={(e) => updateManualRate(code, e.target.value)}
                            placeholder="Enter rate manually"
                            className="w-full min-w-0 box-border px-3 py-2 border border-slate-300 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                          />
                          <p className="text-xs text-slate-400 flex items-start gap-1">
                            <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                            {liveErr ? `Live lookup failed (${liveErr}). Enter manually, or ` : 'Not configured in Forex Trading. '}
                            <button
                              type="button"
                              onClick={() => fetchLiveRate(code, baseCurrency)}
                              className="text-[#1ebcb2] hover:underline font-medium"
                            >
                              retry live fetch
                            </button>
                            .
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Balance entry */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#ee7b22]/10 flex items-center justify-center flex-shrink-0">
                <Sunrise className="w-5 h-5 text-[#ee7b22]" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-900">Verify Opening Balances</h3>
                <p className="text-sm text-slate-500">
                  Enter the confirmed cash and float balances to start today&rsquo;s operations.
                </p>
              </div>
            </div>

            <div className="p-6 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {rows.map((row) => {
                  const rowCurrency = currencyForKey(row.key, accountCurrencies, baseCurrency);
                  const accent = channelAccent(row.key);
                  return (
                    <div
                      key={row.key}
                      className={`border border-slate-200 border-t-4 ${accent.border} rounded-xl bg-white shadow-sm p-4 focus-within:ring-1 focus-within:ring-[#1ebcb2] hover:shadow-md transition-all min-w-0`}
                    >
                      <div className={`w-9 h-9 rounded-full ${accent.iconBg} flex items-center justify-center mx-auto mb-2`}>
                        <ChannelIcon channelKey={row.key} className={`w-4 h-4 ${accent.iconColor}`} />
                      </div>
                      <label
                        htmlFor={`open-${row.key}`}
                        className="block text-center text-xs font-medium text-slate-600 mb-2 truncate"
                        title={row.label}
                      >
                        {row.label}
                      </label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
                          {rowCurrency}
                        </span>
                        <input
                          id={`open-${row.key}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.amount}
                          onChange={(e) => updateRow(row.key, e.target.value)}
                          className="w-full min-w-0 box-border pl-10 pr-2 py-2 border border-slate-300 rounded-md text-right text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {formError && (
                <div
                  className="p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm flex items-start gap-2"
                  role="alert"
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span className="break-words">{formError}</span>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs text-slate-500 uppercase tracking-wide">
                  Total, converted to {baseCurrency}
                </p>
                <p className="text-lg font-semibold text-slate-900 break-words">
                  {formatMoney(totalInBase, baseCurrency)}
                </p>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg disabled:opacity-50 transition-all shrink-0"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sunrise className="w-5 h-5" />}
                Confirm & Open
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}