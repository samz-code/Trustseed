import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type {
  PlatformInvoice,
  PlatformInvoiceStatus,
  PlatformPaymentMethod,
  Tenant,
} from '../../types';
import { money, moneyExact, count, shortDate, label } from './platformFormat';
import { InvoiceReceiptModal, type InvoiceReceiptContext } from './InvoiceReceipt';
import { CurrencySelect, CurrencyFlag } from './CurrencySelect';
import {
  Search,
  AlertCircle,
  RefreshCw,
  Loader2,
  Download,
  CheckCircle,
  Clock,
  XCircle,
  Ban,
  MoreHorizontal,
  ArrowUpDown,
  FileText,
  Pencil,
  X,
  Wand2,
  Save,
} from 'lucide-react';

interface InvoiceRow extends PlatformInvoice {
  tenantName: string;
}

type SortKey = 'tenant' | 'number' | 'amount' | 'status' | 'due';

const STATUS_STYLE: Record<string, { dot: string; pill: string; icon: React.ReactNode }> = {
  paid: {
    dot: 'bg-emerald-500',
    pill: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    icon: <CheckCircle className="w-3 h-3" />,
  },
  open: {
    dot: 'bg-sky-500',
    pill: 'text-sky-700 bg-sky-50 border-sky-200',
    icon: <Clock className="w-3 h-3" />,
  },
  overdue: {
    dot: 'bg-rose-500',
    pill: 'text-rose-700 bg-rose-50 border-rose-200',
    icon: <XCircle className="w-3 h-3" />,
  },
  void: {
    dot: 'bg-slate-400',
    pill: 'text-slate-600 bg-slate-100 border-slate-200',
    icon: <Ban className="w-3 h-3" />,
  },
};

// Settlement rails. 'momo' covers MTN, Airtel and Tigo style wallets outside
// M-Pesa, which is what most Uganda / Tanzania / Rwanda institutions use.
const PAYMENT_METHODS: { value: PlatformPaymentMethod; label: string; hint: string }[] = [
  { value: 'mpesa', label: 'M-Pesa', hint: 'Safaricom, Kenya' },
  { value: 'momo', label: 'Mobile Money', hint: 'MTN, Airtel, Tigo' },
  { value: 'paypal', label: 'PayPal', hint: 'Settles in USD' },
  { value: 'bank', label: 'Bank transfer', hint: 'Wire or EFT' },
  { value: 'card', label: 'Card', hint: 'Visa or Mastercard' },
  { value: 'manual', label: 'Manual / other', hint: 'Cash or offline' },
];

// Rails that settle in local currency, so the amount and FX rate are
// required rather than optional.
const LOCAL_SETTLING_METHODS: PlatformPaymentMethod[] = ['mpesa', 'momo'];

// Rails that settle directly in USD. An institution paying a $500 invoice by
// PayPal sends $500 and Trust Seed receives dollars, so there is no local
// amount and no exchange rate to record. Showing those fields would invite
// meaningless data, so they are hidden entirely for these methods.
const USD_SETTLING_METHODS: PlatformPaymentMethod[] = ['paypal', 'card'];

/**
 * Subscription invoices across all institutions.
 *
 * Invoices are generated automatically each month by pg_cron calling
 * generate_platform_invoices(). The button here runs the same function on
 * demand; it is safely re-runnable because of the unique (tenant_id,
 * period_start) constraint, so pressing it twice creates nothing extra.
 *
 * When recording a payment made in local currency, the FX rate is captured
 * ON THE INVOICE. A receipt printed later reads that stored rate rather than
 * looking up today's, which would misstate what was actually collected.
 */
export function PlatformInvoices() {
  const { platformAdmin } = useAuth();

  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('due');
  const [sortAsc, setSortAsc] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Mark-as-paid form
  const [viewing, setViewing] = useState<InvoiceRow | null>(null);
  const [paying, setPaying] = useState<InvoiceRow | null>(null);
  const [payForm, setPayForm] = useState({
    method: 'mpesa' as PlatformPaymentMethod,
    amountLocal: '',
    localCurrency: 'KES',
    fxRate: '',
    reference: '',
  });
  const [savingPayment, setSavingPayment] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [fetchingRate, setFetchingRate] = useState(false);
  // Tracks whether the rate on screen came from the market feed or was typed.
  // Recorded in the invoice notes so a later reader knows which it was.
  const [rateSource, setRateSource] = useState<'market' | 'manual' | null>(null);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [invRes, tenantRes] = await Promise.all([
        supabase.from('platform_invoices').select('*'),
        supabase.from('tenants').select('id, name'),
      ]);
      if (invRes.error) throw invRes.error;
      if (tenantRes.error) throw tenantRes.error;

      const names = new Map<string, string>();
      ((tenantRes.data ?? []) as Pick<Tenant, 'id' | 'name'>[]).forEach((t) =>
        names.set(t.id, t.name)
      );

      setInvoices(
        ((invRes.data ?? []) as PlatformInvoice[]).map((i) => ({
          ...i,
          tenantName: names.get(i.tenant_id) ?? 'Unknown institution',
        }))
      );
    } catch (err) {
      console.error('Error loading invoices:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load invoices. Has platform_invoices_migration.sql been run?'
      );
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const runGeneration = async () => {
    setGenerating(true);
    setError(null);
    setNotice(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc('generate_platform_invoices');
      if (rpcErr) throw rpcErr;

      const row = Array.isArray(data) ? data[0] : data;
      const created = Number(row?.created ?? 0);
      const skipped = Number(row?.skipped ?? 0);
      setNotice(
        created > 0
          ? `Generated ${created} invoice${created === 1 ? '' : 's'}.${
              skipped > 0 ? ` ${skipped} already existed.` : ''
            }`
          : `No new invoices. ${skipped} already existed for this period.`
      );
      await loadInvoices();
    } catch (err) {
      console.error('Error generating invoices:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate invoices');
    } finally {
      setGenerating(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = invoices.filter((i) => {
      const matchesSearch =
        q === '' ||
        i.tenantName.toLowerCase().includes(q) ||
        i.invoice_number.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || i.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
    const dir = sortAsc ? 1 : -1;
    return [...rows].sort((a, b) => {
      switch (sortKey) {
        case 'tenant':
          return a.tenantName.localeCompare(b.tenantName) * dir;
        case 'number':
          return a.invoice_number.localeCompare(b.invoice_number) * dir;
        case 'amount':
          return (Number(a.amount_usd) - Number(b.amount_usd)) * dir;
        case 'status':
          return a.status.localeCompare(b.status) * dir;
        case 'due':
        default:
          return (new Date(a.due_at).getTime() - new Date(b.due_at).getTime()) * dir;
      }
    });
  }, [invoices, search, statusFilter, sortKey, sortAsc]);

  const totals = useMemo(() => {
    const sum = (rows: InvoiceRow[]) => rows.reduce((s, i) => s + Number(i.amount_usd || 0), 0);
    const paid = invoices.filter((i) => i.status === 'paid');
    const overdue = invoices.filter((i) => i.status === 'overdue');
    const open = invoices.filter((i) => i.status === 'open');
    return {
      collected: sum(paid),
      outstanding: sum(open) + sum(overdue),
      overdueAmount: sum(overdue),
      overdueCount: overdue.length,
    };
  }, [invoices]);

  // Pulls today's mid-market rate for USD -> the chosen currency.
  //
  // This only PRE-FILLS. The figure that belongs on the invoice is the rate
  // the money actually moved at - what M-Pesa or the bank applied - not what
  // the market happened to say when the button was clicked. So the field
  // stays editable and an override is treated as the more authoritative
  // number, not an error.
  const fetchMarketRate = useCallback(async (currency: string) => {
    if (!currency || currency === 'USD') {
      setPayForm((p) => ({ ...p, fxRate: currency === 'USD' ? '1' : p.fxRate }));
      setRateSource(currency === 'USD' ? 'market' : null);
      return;
    }
    setFetchingRate(true);
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!res.ok) throw new Error(`Rate service returned ${res.status}`);
      const data = await res.json();
      const rate = data?.rates?.[currency];
      if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
        throw new Error(`No rate available for USD/${currency}`);
      }
      setPayForm((p) => ({ ...p, fxRate: Number(rate).toFixed(4) }));
      setRateSource('market');
    } catch (err) {
      console.error('Error fetching FX rate:', err);
      // Non-fatal: leave the field for manual entry rather than blocking.
      setRateSource(null);
      setPayError(
        err instanceof Error
          ? `Couldn't fetch today's rate (${err.message}). Enter it manually.`
          : "Couldn't fetch today's rate. Enter it manually."
      );
    } finally {
      setFetchingRate(false);
    }
  }, []);

  // Re-fetch whenever the currency changes while the form is open.
  useEffect(() => {
    if (!paying) return;
    if (USD_SETTLING_METHODS.includes(payForm.method)) return;
    fetchMarketRate(payForm.localCurrency);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paying, payForm.localCurrency, payForm.method]);

  // Cross-check: what the local amount is actually worth at the entered rate.
  // Surfaces an underpayment or a mistyped rate before the record is saved.
  const impliedUsd = useMemo(() => {
    const amt = parseFloat(payForm.amountLocal);
    const rate = parseFloat(payForm.fxRate);
    if (!paying || Number.isNaN(amt) || Number.isNaN(rate) || rate <= 0) return null;
    const value = amt / rate;
    const expected = Number(paying.amount_usd);
    const diff = value - expected;
    return {
      value,
      expected,
      diff,
      pct: expected > 0 ? (diff / expected) * 100 : 0,
    };
  }, [payForm.amountLocal, payForm.fxRate, paying]);

  const openPayForm = (inv: InvoiceRow) => {
    setPaying(inv);
    setPayForm({
      method: 'mpesa',
      amountLocal: '',
      localCurrency: 'KES',
      fxRate: '',
      reference: '',
    });
    setPayError(null);
    setRateSource(null);
    setMenuId(null);
  };

  const savePayment = async () => {
    if (!paying) return;
    setPayError(null);

    // Local-currency settlement requires both the amount and the rate: a
    // receipt showing one without the other cannot be reconciled later.
    // USD rails never carry a local amount or rate, regardless of what may
    // be left in the form fields from a previously selected method.
    const isUsdRail = USD_SETTLING_METHODS.includes(payForm.method);
    const usesLocal =
      !isUsdRail &&
      (LOCAL_SETTLING_METHODS.includes(payForm.method) || payForm.amountLocal.trim() !== '');
    const localAmt = parseFloat(payForm.amountLocal);
    const rate = parseFloat(payForm.fxRate);

    if (usesLocal) {
      if (!payForm.amountLocal.trim() || Number.isNaN(localAmt) || localAmt <= 0) {
        setPayError('Enter the amount actually received in local currency.');
        return;
      }
      if (!payForm.fxRate.trim() || Number.isNaN(rate) || rate <= 0) {
        setPayError('Enter the exchange rate used for this payment.');
        return;
      }
    }

    setSavingPayment(true);
    try {
      const { error: uErr } = await supabase
        .from('platform_invoices')
        .update({
          status: 'paid' as PlatformInvoiceStatus,
          paid_at: new Date().toISOString(),
          payment_method: payForm.method,
          amount_paid_usd: Number(paying.amount_usd),
          amount_paid_local: usesLocal ? localAmt : null,
          local_currency: usesLocal ? payForm.localCurrency.trim().toUpperCase() : null,
          fx_rate: usesLocal ? rate : null,
          provider_reference: payForm.reference.trim() || null,
          notes: usesLocal
            ? `FX rate ${rateSource === 'market' ? 'from market feed' : 'entered manually'} at time of payment.`
            : null,
        })
        .eq('id', paying.id);
      if (uErr) throw uErr;

      await loadInvoices();
      setPaying(null);
    } catch (err) {
      console.error('Error recording payment:', err);
      setPayError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setSavingPayment(false);
    }
  };

  const voidInvoice = async (inv: InvoiceRow) => {
    setBusyId(inv.id);
    setMenuId(null);
    setError(null);
    try {
      const { error: uErr } = await supabase
        .from('platform_invoices')
        .update({ status: 'void' as PlatformInvoiceStatus })
        .eq('id', inv.id);
      if (uErr) throw uErr;
      await loadInvoices();
    } catch (err) {
      console.error('Error voiding invoice:', err);
      setError(err instanceof Error ? err.message : 'Failed to void invoice');
    } finally {
      setBusyId(null);
    }
  };

  // Opens the full receipt modal: preview, A4 / thermal switch, print,
  // PDF download and send buttons.
  const openReceipt = (inv: InvoiceRow) => {
    setMenuId(null);
    setViewing(inv);
  };

  const receiptContext = (inv: InvoiceRow): InvoiceReceiptContext => ({
    institutionName: inv.tenantName,
    issuerName: 'Trust Seed',
    issuerEmail: platformAdmin?.email ?? null,
    logoUrl: '/logo.png',
  });

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const Th = ({ text, sortAs, right }: { text: string; sortAs?: SortKey; right?: boolean }) => (
    <th
      className={`px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 ${
        right ? 'text-right' : 'text-left'
      } ${sortAs ? 'cursor-pointer select-none hover:text-slate-800' : ''}`}
      onClick={sortAs ? () => toggleSort(sortAs) : undefined}
    >
      <span className={`inline-flex items-center gap-1 ${right ? 'flex-row-reverse' : ''}`}>
        {text}
        {sortAs && (
          <ArrowUpDown
            className={`w-3 h-3 ${sortKey === sortAs ? 'text-[#ee7b22]' : 'text-slate-300'}`}
          />
        )}
      </span>
    </th>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Invoices</h1>
          <p className="text-[15px] text-slate-500 mt-1">
            Subscription billing records, generated monthly and billed in USD
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadInvoices}
            disabled={loading}
            className="px-4 py-2 border border-slate-300 bg-white rounded-md hover:bg-slate-50 transition-colors flex items-center gap-2 text-sm text-slate-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={runGeneration}
            disabled={generating}
            className="px-4 py-2 bg-[#ee7b22] hover:bg-[#c46040] text-white text-sm font-semibold rounded-md shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
            title="Runs the same function pg_cron calls monthly. Safe to press twice."
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            Generate this month
          </button>
        </div>
      </div>

      {notice && (
        <div className="bg-sky-50 border border-sky-200 rounded-lg px-4 py-3 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-sky-600 flex-shrink-0" />
          <p className="text-sm text-sky-800 flex-1">{notice}</p>
          <button
            onClick={() => setNotice(null)}
            className="text-sky-700 hover:text-sky-900"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <p className="text-sm text-rose-800 flex-1">{error}</p>
          <button
            onClick={loadInvoices}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-md"
          >
            Retry
          </button>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200 border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-white px-6 py-5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Collected</div>
          <p className="text-3xl font-bold text-emerald-600 mt-2 tabular-nums">
            {money(totals.collected)}
          </p>
          <p className="text-xs text-slate-400 mt-1">All paid invoices</p>
        </div>
        <div className="bg-white px-6 py-5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Outstanding
          </div>
          <p className="text-3xl font-bold text-slate-900 mt-2 tabular-nums">
            {money(totals.outstanding)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Open and overdue</p>
        </div>
        <div className="bg-white px-6 py-5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Overdue</div>
          <p
            className={`text-3xl font-bold mt-2 tabular-nums ${
              totals.overdueAmount > 0 ? 'text-rose-600' : 'text-slate-900'
            }`}
          >
            {money(totals.overdueAmount)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {count(totals.overdueCount)} invoice{totals.overdueCount === 1 ? '' : 's'}
          </p>
        </div>
        <div className="bg-white px-6 py-5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Total</div>
          <p className="text-3xl font-bold text-slate-900 mt-2 tabular-nums">
            {count(invoices.length)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Invoices on record</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search institution or invoice number..."
              className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md text-[15px] focus:outline-none focus:ring-2 focus:ring-[#ee7b22]/40 focus:border-[#ee7b22]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-md text-[15px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#ee7b22]/40"
          >
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="void">Void</option>
          </select>
          <span className="text-sm text-slate-400 whitespace-nowrap">
            {count(filtered.length)} shown
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : filtered.length > 0 ? (
          /* Cards rather than a table: every action is one visible click
             instead of being hidden behind a row menu. */
          <div className="p-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((inv) => {
              const st = STATUS_STYLE[inv.status] ?? STATUS_STYLE.void;
              const canPay = inv.status !== 'paid' && inv.status !== 'void';
              return (
                <div
                  key={inv.id}
                  className="border border-slate-200 rounded-xl bg-white hover:shadow-md hover:border-slate-300 transition-all overflow-hidden flex flex-col"
                >
                  {/* Card header */}
                  <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 text-[15px] truncate">
                        {inv.tenantName}
                      </p>
                      <p className="font-mono text-[11px] text-slate-400 mt-0.5">
                        {inv.invoice_number}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-semibold flex-shrink-0 ${st.pill}`}
                    >
                      {st.icon}
                      {label(inv.status)}
                    </span>
                  </div>

                  {/* Amount */}
                  <div className="px-4 pb-3">
                    <p className="text-2xl font-bold text-slate-900 tabular-nums leading-none">
                      {moneyExact(Number(inv.amount_usd))}
                    </p>
                    {inv.status === 'paid' && inv.amount_paid_local != null && (
                      <p className="text-xs text-slate-400 mt-1 tabular-nums">
                        Settled {inv.local_currency}{' '}
                        {Number(inv.amount_paid_local).toLocaleString('en-US', {
                          maximumFractionDigits: 0,
                        })}
                        {inv.fx_rate != null && ` at ${Number(inv.fx_rate).toFixed(2)}`}
                      </p>
                    )}
                  </div>

                  {/* Meta */}
                  <div className="px-4 pb-3 grid grid-cols-3 gap-2 text-[11px] border-t border-slate-100 pt-3">
                    <div>
                      <p className="text-slate-400 uppercase tracking-wider font-semibold">Plan</p>
                      <p className="text-slate-700 capitalize mt-0.5">{inv.plan}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 uppercase tracking-wider font-semibold">Period</p>
                      <p className="text-slate-700 mt-0.5 tabular-nums">
                        {shortDate(inv.period_start)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 uppercase tracking-wider font-semibold">Due</p>
                      <p
                        className={`mt-0.5 tabular-nums ${
                          inv.status === 'overdue' ? 'text-rose-600 font-semibold' : 'text-slate-700'
                        }`}
                      >
                        {shortDate(inv.due_at)}
                      </p>
                    </div>
                  </div>

                  {/* Actions — visible, not hidden in a menu */}
                  <div className="mt-auto px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                    <button
                      onClick={() => openReceipt(inv)}
                      className="flex-1 px-2.5 py-1.5 border border-slate-300 bg-white text-slate-700 text-xs font-semibold rounded-md hover:bg-slate-100 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {inv.status === 'paid' ? 'Receipt' : 'Invoice'}
                    </button>
                    {canPay && (
                      <button
                        onClick={() => openPayForm(inv)}
                        className="flex-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Record payment
                      </button>
                    )}
                    {canPay && (
                      <button
                        onClick={() => voidInvoice(inv)}
                        disabled={busyId === inv.id}
                        className="px-2 py-1.5 border border-slate-300 bg-white text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50"
                        title="Void invoice"
                        aria-label="Void invoice"
                      >
                        {busyId === inv.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Ban className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <FileText className="w-10 h-10 text-slate-300 mb-3" />
            <h3 className="text-sm font-semibold text-slate-900 mb-1">No invoices found</h3>
            <p className="text-sm text-slate-500 text-center max-w-sm">
              {search || statusFilter !== 'all'
                ? 'Nothing matches the current search or filter.'
                : 'Invoices generate automatically each month. Use "Generate this month" to run it now.'}
            </p>
          </div>
        )}
      </div>

      {/* Receipt modal — preview, A4 / thermal, print, PDF, send */}
      {viewing && (
        <InvoiceReceiptModal
          invoice={viewing}
          ctx={receiptContext(viewing)}
          onClose={() => setViewing(null)}
        />
      )}

      {/* Record payment modal */}
      {paying && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setPaying(null)}
          />
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl max-h-[88vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-bold text-slate-900">Record payment</h2>
                <p className="text-xs text-slate-500 truncate">
                  {paying.invoice_number} &middot; {paying.tenantName}
                </p>
              </div>
              <button
                onClick={() => setPaying(null)}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex-shrink-0"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                <span className="text-sm text-slate-500">Invoice amount</span>
                <span className="text-lg font-bold text-slate-900 tabular-nums">
                  {moneyExact(Number(paying.amount_usd))}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Payment method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map((m) => {
                    const active = payForm.method === m.value;
                    return (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setPayForm((p) => ({ ...p, method: m.value }))}
                        className={`px-3 py-2 rounded-lg border text-left transition-all ${
                          active
                            ? 'border-[#ee7b22] bg-[#ee7b22]/[0.07] ring-1 ring-[#ee7b22]/20'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span
                          className={`block text-sm font-semibold ${
                            active ? 'text-[#641f60]' : 'text-slate-800'
                          }`}
                        >
                          {m.label}
                        </span>
                        <span className="block text-[11px] text-slate-500">{m.hint}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* USD rails settle in dollars: there is no local amount and no
                  rate, so we confirm the figure rather than asking for data
                  that does not exist. */}
              {USD_SETTLING_METHODS.includes(payForm.method) && (
                <div className="p-3 border border-emerald-200 bg-emerald-50/60 rounded-lg flex items-start gap-2.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-emerald-900">
                    <p className="font-semibold">
                      Settles in USD &mdash; {moneyExact(Number(paying.amount_usd))}
                    </p>
                    <p className="mt-0.5 text-emerald-800">
                      No exchange rate applies. Record the provider reference below so the payment
                      can be traced.
                    </p>
                  </div>
                </div>
              )}

              {/* Local settlement. Required for M-Pesa and MoMo; optional for
                  bank and manual. Both the amount and the rate are captured so
                  the receipt can be reconciled against what was collected. */}
              {!USD_SETTLING_METHODS.includes(payForm.method) && (
              <div className="p-3 border border-slate-200 rounded-lg space-y-3 bg-slate-50/60">
                <p className="text-xs font-semibold text-slate-600">
                  Local currency settlement
                  {LOCAL_SETTLING_METHODS.includes(payForm.method) && (
                    <span className="ml-1 font-normal text-slate-400">
                      (required for {payForm.method === 'mpesa' ? 'M-Pesa' : 'mobile money'})
                    </span>
                  )}
                </p>
                <div className="grid grid-cols-5 gap-2">
                  <div className="col-span-2">
                    <label className="block text-[11px] text-slate-500 mb-1">Currency</label>
                    <CurrencySelect
                      value={payForm.localCurrency}
                      onChange={(v) => setPayForm((p) => ({ ...p, localCurrency: v }))}
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-[11px] text-slate-500 mb-1">Amount received</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400 pointer-events-none">
                        {payForm.localCurrency}
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={payForm.amountLocal}
                        onChange={(e) => setPayForm((p) => ({ ...p, amountLocal: e.target.value }))}
                        placeholder="64750"
                        className="w-full pl-11 pr-2 py-2 border border-slate-300 rounded-md text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#ee7b22]/40"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      Exchange rate used
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-600">
                        (1 USD =
                        <CurrencyFlag code={payForm.localCurrency} size={13} />
                        {payForm.localCurrency})
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => fetchMarketRate(payForm.localCurrency)}
                      disabled={fetchingRate || payForm.localCurrency === 'USD'}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1ebcb2] hover:text-[#159089] disabled:opacity-40"
                    >
                      {fetchingRate ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )}
                      Fetch today&rsquo;s rate
                    </button>
                  </div>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={payForm.fxRate}
                    onChange={(e) => {
                      setPayForm((p) => ({ ...p, fxRate: e.target.value }));
                      setRateSource('manual');
                    }}
                    placeholder="e.g. 129.5"
                    className="w-full px-2 py-2 border border-slate-300 rounded-md text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#ee7b22]/40"
                  />

                  {rateSource && (
                    <p
                      className={`text-[11px] mt-1 inline-flex items-center gap-1 ${
                        rateSource === 'market' ? 'text-[#0f766e]' : 'text-slate-500'
                      }`}
                    >
                      {rateSource === 'market' ? (
                        <>
                          <CheckCircle className="w-3 h-3" />
                          Today&rsquo;s market rate
                        </>
                      ) : (
                        <>
                          <Pencil className="w-3 h-3" />
                          Entered manually
                        </>
                      )}
                    </p>
                  )}

                  <p className="text-[11px] text-slate-400 mt-1">
                    Override this with the rate the payment actually settled at. Whatever is saved
                    here is what the receipt will show, permanently.
                  </p>

                  {/* Cross-check so a wrong rate or short payment is caught
                      before saving, not after. */}
                  {impliedUsd && (
                    <div
                      className={`mt-2 px-2.5 py-2 rounded-md border text-[11px] ${
                        Math.abs(impliedUsd.pct) < 1
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : Math.abs(impliedUsd.pct) < 5
                          ? 'bg-amber-50 border-amber-200 text-amber-800'
                          : 'bg-rose-50 border-rose-200 text-rose-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>That works out to</span>
                        <span className="font-bold tabular-nums">
                          {moneyExact(impliedUsd.value)}
                        </span>
                      </div>
                      {Math.abs(impliedUsd.pct) >= 1 && (
                        <div className="flex items-center justify-between mt-0.5">
                          <span>
                            {impliedUsd.diff > 0 ? 'Over' : 'Under'} invoice by
                          </span>
                          <span className="font-bold tabular-nums">
                            {moneyExact(Math.abs(impliedUsd.diff))} (
                            {Math.abs(impliedUsd.pct).toFixed(1)}%)
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Reference{' '}
                  {payForm.method === 'mpesa'
                    ? '(M-Pesa receipt no.)'
                    : payForm.method === 'momo'
                    ? '(MoMo transaction ID)'
                    : payForm.method === 'paypal'
                    ? '(PayPal transaction ID)'
                    : ''}
                </label>
                <input
                  type="text"
                  value={payForm.reference}
                  onChange={(e) => setPayForm((p) => ({ ...p, reference: e.target.value }))}
                  placeholder={
                    payForm.method === 'paypal' ? 'e.g. 7X4839201K5566871' : 'e.g. SJK4H7XY2P'
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#ee7b22]/40"
                />
              </div>

              {payError && (
                <div className="px-3 py-2 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-700">
                  {payError}
                </div>
              )}
            </div>

            <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center gap-2">
              <button
                onClick={() => setPaying(null)}
                className="flex-1 px-3 py-2 border border-slate-300 bg-white text-slate-700 text-sm font-medium rounded-md hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={savePayment}
                disabled={savingPayment}
                className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-md flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {savingPayment ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Mark as paid
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}