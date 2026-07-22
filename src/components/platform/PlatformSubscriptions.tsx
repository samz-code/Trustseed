import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import type { Subscription, Tenant } from '../../types';
import { money, moneyExact, count, shortDate, label } from './platformFormat';
import {
  Search,
  AlertCircle,
  RefreshCw,
  Loader2,
  TrendingUp,
  CheckCircle,
  Clock,
  XCircle,
  PauseCircle,
  MoreHorizontal,
  ArrowUpDown,
  Receipt,
} from 'lucide-react';

interface SubRow extends Subscription {
  tenantName: string;
}

type SortKey = 'tenant' | 'plan' | 'fee' | 'status' | 'renews';

const STATUS_STYLE: Record<string, { dot: string; text: string; icon: React.ReactNode }> = {
  active: {
    dot: 'bg-emerald-500',
    text: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    icon: <CheckCircle className="w-3 h-3" />,
  },
  past_due: {
    dot: 'bg-rose-500',
    text: 'text-rose-700 bg-rose-50 border-rose-200',
    icon: <XCircle className="w-3 h-3" />,
  },
  grace_period: {
    dot: 'bg-amber-500',
    text: 'text-amber-700 bg-amber-50 border-amber-200',
    icon: <Clock className="w-3 h-3" />,
  },
  suspended: {
    dot: 'bg-amber-500',
    text: 'text-amber-700 bg-amber-50 border-amber-200',
    icon: <PauseCircle className="w-3 h-3" />,
  },
  canceled: {
    dot: 'bg-slate-400',
    text: 'text-slate-600 bg-slate-100 border-slate-200',
    icon: <AlertCircle className="w-3 h-3" />,
  },
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.canceled;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-semibold ${s.text}`}>
      {s.icon}
      {label(status)}
    </span>
  );
}

function PlanTag({ plan }: { plan: string }) {
  const cls =
    plan === 'enterprise'
      ? 'bg-[#641f60]/10 text-[#641f60] border-[#641f60]/20'
      : plan === 'professional'
      ? 'bg-[#1ebcb2]/10 text-[#0f766e] border-[#1ebcb2]/30'
      : 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span className={`inline-block px-2 py-0.5 rounded border text-xs font-semibold capitalize ${cls}`}>
      {plan}
    </span>
  );
}

/**
 * Subscription billing across every institution.
 *
 * All amounts are USD: Trust Seed bills subscribers in dollars regardless of
 * the currency each institution operates in internally. MRR sums monthly_fee
 * on ACTIVE rows only, so it reads zero honestly when nothing is active
 * rather than being estimated from a headcount.
 */
export function PlatformSubscriptions() {
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('fee');
  const [sortAsc, setSortAsc] = useState(false);

  const loadSubs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [subRes, tenantRes] = await Promise.all([
        supabase.from('subscriptions').select('*'),
        supabase.from('tenants').select('id, name'),
      ]);
      if (subRes.error) throw subRes.error;
      if (tenantRes.error) throw tenantRes.error;

      const names = new Map<string, string>();
      ((tenantRes.data ?? []) as Pick<Tenant, 'id' | 'name'>[]).forEach((t) => names.set(t.id, t.name));

      setSubs(
        ((subRes.data ?? []) as Subscription[]).map((s) => ({
          ...s,
          tenantName: names.get(s.tenant_id) ?? 'Unknown institution',
        }))
      );
    } catch (err) {
      console.error('Error loading subscriptions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load subscriptions');
      setSubs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubs();
  }, [loadSubs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = subs.filter((s) => {
      const matchesSearch = q === '' || s.tenantName.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    const dir = sortAsc ? 1 : -1;
    return [...rows].sort((a, b) => {
      switch (sortKey) {
        case 'tenant':
          return a.tenantName.localeCompare(b.tenantName) * dir;
        case 'plan':
          return a.plan.localeCompare(b.plan) * dir;
        case 'status':
          return a.status.localeCompare(b.status) * dir;
        case 'renews':
          return (
            (new Date(a.current_period_end ?? 0).getTime() -
              new Date(b.current_period_end ?? 0).getTime()) * dir
          );
        case 'fee':
        default:
          return (Number(a.monthly_fee || 0) - Number(b.monthly_fee || 0)) * dir;
      }
    });
  }, [subs, search, statusFilter, sortKey, sortAsc]);

  const totals = useMemo(() => {
    const active = subs.filter((s) => s.status === 'active');
    const mrr = active.reduce((sum, s) => sum + Number(s.monthly_fee || 0), 0);
    return {
      mrr,
      arr: mrr * 12,
      activeCount: active.length,
      atRisk: subs.filter((s) => s.status === 'past_due' || s.status === 'grace_period').length,
    };
  }, [subs]);

  const setStatus = async (sub: Subscription, status: Subscription['status']) => {
    setBusyId(sub.id);
    setMenuId(null);
    setError(null);
    try {
      const { error: uErr } = await supabase.from('subscriptions').update({ status }).eq('id', sub.id);
      if (uErr) throw uErr;
      await loadSubs();
    } catch (err) {
      console.error('Error updating subscription:', err);
      setError(err instanceof Error ? err.message : 'Failed to update subscription');
    } finally {
      setBusyId(null);
    }
  };

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortAsc((v) => !v);
    } else {
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
          <ArrowUpDown className={`w-3 h-3 ${sortKey === sortAs ? 'text-[#ee7b22]' : 'text-slate-300'}`} />
        )}
      </span>
    </th>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Subscriptions &amp; Billing</h1>
          <p className="text-[15px] text-slate-500 mt-1">
            Recurring revenue across all institutions, billed in USD
          </p>
        </div>
        <button
          onClick={loadSubs}
          disabled={loading}
          className="px-4 py-2 border border-slate-300 bg-white rounded-md hover:bg-slate-50 transition-colors flex items-center gap-2 text-sm text-slate-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <p className="text-sm text-rose-800 flex-1">{error}</p>
          <button
            onClick={loadSubs}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-md transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Metric strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200 border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-white px-6 py-5">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
            <TrendingUp className="w-3.5 h-3.5" />
            MRR
          </div>
          <p className="text-3xl font-bold text-slate-900 mt-2 tabular-nums">{money(totals.mrr)}</p>
          <p className="text-xs text-slate-400 mt-1">Active subscriptions only</p>
        </div>
        <div className="bg-white px-6 py-5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Annualised</div>
          <p className="text-3xl font-bold text-slate-900 mt-2 tabular-nums">{money(totals.arr)}</p>
          <p className="text-xs text-slate-400 mt-1">MRR &times; 12</p>
        </div>
        <div className="bg-white px-6 py-5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Active</div>
          <p className="text-3xl font-bold text-slate-900 mt-2 tabular-nums">{count(totals.activeCount)}</p>
          <p className="text-xs text-slate-400 mt-1">of {count(subs.length)} total</p>
        </div>
        <div className="bg-white px-6 py-5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">At risk</div>
          <p
            className={`text-2xl font-bold mt-1.5 tabular-nums ${
              totals.atRisk > 0 ? 'text-rose-600' : 'text-slate-900'
            }`}
          >
            {count(totals.atRisk)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Past due or in grace</p>
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
              placeholder="Search institution..."
              className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md text-[15px] focus:outline-none focus:ring-2 focus:ring-[#ee7b22]/40 focus:border-[#ee7b22]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-md text-[15px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#ee7b22]/40"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="past_due">Past due</option>
            <option value="grace_period">Grace period</option>
            <option value="suspended">Suspended</option>
            <option value="canceled">Canceled</option>
          </select>
          <span className="text-sm text-slate-400 whitespace-nowrap">{count(filtered.length)} shown</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <Th text="Institution" sortAs="tenant" />
                  <Th text="Plan" sortAs="plan" />
                  <Th text="Status" sortAs="status" />
                  <Th text="Cycle" />
                  <Th text="Renews" sortAs="renews" />
                  <Th text="Monthly" sortAs="fee" right />
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s) => {
                  const style = STATUS_STYLE[s.status] ?? STATUS_STYLE.canceled;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition-colors group">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`} />
                          <span className="font-semibold text-slate-900 text-[15px] truncate max-w-[220px]">
                            {s.tenantName}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <PlanTag plan={s.plan} />
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusPill status={s.status} />
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-500 capitalize">{s.billing_cycle}</td>
                      <td className="px-5 py-3.5 text-sm text-slate-500 tabular-nums">
                        {shortDate(s.current_period_end)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="font-bold text-slate-900 text-[15px] tabular-nums">
                          {moneyExact(Number(s.monthly_fee || 0))}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 relative">
                        <button
                          onClick={() => setMenuId(menuId === s.id ? null : s.id)}
                          disabled={busyId === s.id}
                          className="p-1.5 rounded text-slate-300 hover:text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50 group-hover:text-slate-400"
                          aria-label="Actions"
                        >
                          {busyId === s.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <MoreHorizontal className="w-4 h-4" />
                          )}
                        </button>
                        {menuId === s.id && (
                          <div className="absolute right-2 top-9 w-48 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden z-30 py-1">
                            <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Set status
                            </p>
                            {s.status !== 'active' && (
                              <button
                                onClick={() => setStatus(s, 'active')}
                                className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                Active
                              </button>
                            )}
                            {s.status !== 'past_due' && (
                              <button
                                onClick={() => setStatus(s, 'past_due')}
                                className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-rose-50 hover:text-rose-700 flex items-center gap-2"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Past due
                              </button>
                            )}
                            {s.status !== 'grace_period' && (
                              <button
                                onClick={() => setStatus(s, 'grace_period')}
                                className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-700 flex items-center gap-2"
                              >
                                <Clock className="w-3.5 h-3.5" />
                                Grace period
                              </button>
                            )}
                            {s.status !== 'canceled' && (
                              <button
                                onClick={() => setStatus(s, 'canceled')}
                                className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                              >
                                <PauseCircle className="w-3.5 h-3.5" />
                                Canceled
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500"
                  >
                    Total shown
                  </td>
                  <td className="px-5 py-3.5 text-right font-bold text-slate-900 text-[15px] tabular-nums">
                    {moneyExact(filtered.reduce((sum, s) => sum + Number(s.monthly_fee || 0), 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <Receipt className="w-10 h-10 text-slate-300 mb-3" />
            <h3 className="text-sm font-semibold text-slate-900 mb-1">No subscriptions found</h3>
            <p className="text-sm text-slate-500 text-center max-w-sm">
              {search || statusFilter !== 'all'
                ? 'Nothing matches the current search or filter.'
                : 'Subscriptions appear here as institutions subscribe.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}