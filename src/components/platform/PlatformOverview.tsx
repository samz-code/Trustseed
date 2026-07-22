import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import type { PlatformMetrics, Subscription, Tenant } from '../../types';
import { money, count, compact, shortDate } from './platformFormat';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  Building2,
  Users,
  UsersRound,
  GitBranch,
  ArrowRightLeft,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Loader2,
  CheckCircle,
  PauseCircle,
  ArrowUpRight,
} from 'lucide-react';

interface MonthPoint {
  month: string;
  mrr: number;
  institutions: number;
}

export function PlatformOverview() {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [series, setSeries] = useState<MonthPoint[]>([]);
  const [recent, setRecent] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [metricsRes, subsRes, tenantsRes] = await Promise.all([
        supabase.rpc('platform_metrics'),
        supabase.from('subscriptions').select('monthly_fee, status, created_at'),
        supabase.from('tenants').select('*').order('created_at', { ascending: false }),
      ]);
      if (metricsRes.error) throw metricsRes.error;
      if (subsRes.error) throw subsRes.error;
      if (tenantsRes.error) throw tenantsRes.error;

      setMetrics(metricsRes.data as PlatformMetrics);

      const tenants = (tenantsRes.data ?? []) as Tenant[];
      setRecent(tenants.slice(0, 6));

      // Build a REAL cumulative series from created_at. Each month shows the
      // MRR and institution count as they stood at the end of that month.
      // No smoothing, no projection: if signups clustered, the line steps.
      const subs = (subsRes.data ?? []) as Pick<
        Subscription,
        'monthly_fee' | 'status' | 'created_at'
      >[];

      const monthKey = (iso: string) => {
        const d = new Date(iso);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      };

      const allKeys = new Set<string>();
      subs.forEach((s) => s.created_at && allKeys.add(monthKey(s.created_at)));
      tenants.forEach((t) => t.created_at && allKeys.add(monthKey(t.created_at)));

      const sortedKeys = Array.from(allKeys).sort().slice(-12);

      const points: MonthPoint[] = sortedKeys.map((key) => {
        const cutoff = new Date(`${key}-01T00:00:00Z`);
        cutoff.setUTCMonth(cutoff.getUTCMonth() + 1);

        const mrr = subs
          .filter(
            (s) =>
              s.status === 'active' && s.created_at && new Date(s.created_at) < cutoff
          )
          .reduce((sum, s) => sum + Number(s.monthly_fee || 0), 0);

        const institutions = tenants.filter(
          (t) => t.created_at && new Date(t.created_at) < cutoff
        ).length;

        const [y, m] = key.split('-');
        const labelDate = new Date(Number(y), Number(m) - 1, 1);
        return {
          month: labelDate.toLocaleDateString('en-US', { month: 'short' }),
          mrr,
          institutions,
        };
      });

      setSeries(points);
    } catch (err) {
      console.error('Error loading platform overview:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load platform metrics. Has platform_admin_migration.sql been run?'
      );
      setMetrics(null);
      setSeries([]);
      setRecent([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const secondary = useMemo(
    () =>
      metrics
        ? [
            {
              label: 'Staff users',
              value: count(metrics.users_total),
              icon: <Users className="w-4 h-4" />,
            },
            {
              label: 'End customers',
              value: count(metrics.customers_total),
              icon: <UsersRound className="w-4 h-4" />,
            },
            {
              label: 'Branches',
              value: count(metrics.branches_total),
              icon: <GitBranch className="w-4 h-4" />,
            },
            {
              label: 'Transactions',
              value: count(metrics.transactions_total),
              icon: <ArrowRightLeft className="w-4 h-4" />,
            },
          ]
        : [],
    [metrics]
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Platform Overview</h1>
          <p className="text-[15px] text-slate-500 mt-1">
            Live metrics across every subscribing institution
          </p>
        </div>
        <button
          onClick={loadAll}
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
            onClick={loadAll}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-md transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 animate-pulse">
              <div className="h-3 w-20 bg-slate-200 rounded mb-4" />
              <div className="h-9 w-32 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      ) : metrics ? (
        <>
          {/* Primary metrics */}
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="relative overflow-hidden bg-gradient-to-br from-[#641f60] to-[#3d1239] rounded-xl p-6 text-white shadow-lg shadow-[#641f60]/20">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white/60">
                <TrendingUp className="w-3.5 h-3.5" />
                Monthly recurring revenue
              </div>
              <p className="text-5xl font-bold mt-3 tabular-nums tracking-tight">
                {money(metrics.mrr)}
              </p>
              <p className="text-sm text-white/50 mt-2">
                {money(metrics.mrr * 12)} annualised &middot; USD
              </p>
              <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-white/[0.06]" />
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                <Building2 className="w-3.5 h-3.5" />
                Institutions
              </div>
              <p className="text-5xl font-bold text-slate-900 mt-3 tabular-nums tracking-tight">
                {count(metrics.institutions_total)}
              </p>
              <div className="flex items-center gap-4 mt-3 text-sm">
                <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                  <CheckCircle className="w-3 h-3" />
                  {count(metrics.institutions_active)} active
                </span>
                {metrics.institutions_suspended > 0 && (
                  <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                    <PauseCircle className="w-3 h-3" />
                    {count(metrics.institutions_suspended)} suspended
                  </span>
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                <ArrowRightLeft className="w-3.5 h-3.5" />
                Transaction volume
              </div>
              <p className="text-5xl font-bold text-slate-900 mt-3 tabular-nums tracking-tight">
                {compact(metrics.transaction_volume)}
              </p>
              {/* Tenants transact in KES, USD, SSP and others. Summing them
                  gives an indicative scale figure, not a real dollar total,
                  and it is labelled as such rather than shown with a $. */}
              <p className="text-sm text-slate-400 mt-2">
                Mixed currencies &middot; indicative scale only
              </p>
            </div>
          </div>

          {/* Chart + secondary */}
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Revenue growth</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Cumulative MRR at each month end, from subscription records
                  </p>
                </div>
              </div>
              {series.length > 1 ? (
                <div style={{ width: '100%', height: 280 }}>
                  <ResponsiveContainer>
                    <AreaChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                      <defs>
                        <linearGradient id="mrrFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ee7b22" stopOpacity={0.28} />
                          <stop offset="100%" stopColor="#ee7b22" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) => compact(v)}
                      />
                      <Tooltip
                        formatter={(v: number) => [money(v), 'MRR']}
                        contentStyle={{
                          borderRadius: 8,
                          border: '1px solid #e2e8f0',
                          fontSize: 12,
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="mrr"
                        stroke="#ee7b22"
                        strokeWidth={2}
                        fill="url(#mrrFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[280px] flex flex-col items-center justify-center text-center">
                  <TrendingUp className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-sm text-slate-500">Not enough history to chart yet</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">
                    The trend fills in as subscriptions are created across different months.
                  </p>
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
              <div className="px-6 py-4">
                <h2 className="text-base font-bold text-slate-900">Platform totals</h2>
              </div>
              {secondary.map((item) => (
                <div key={item.label} className="px-6 py-3.5 flex items-center justify-between">
                  <span className="flex items-center gap-2.5 text-[15px] text-slate-600">
                    <span className="text-slate-400">{item.icon}</span>
                    {item.label}
                  </span>
                  <span className="text-sm font-bold text-slate-900 text-[15px] tabular-nums">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent institutions */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Recently joined</h2>
              <span className="text-xs text-slate-400">Last {recent.length}</span>
            </div>
            {recent.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {recent.map((t) => (
                  <div key={t.id} className="px-6 py-3 flex items-center gap-3.5 hover:bg-slate-50/70">
                    <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-3.5 h-3.5 text-slate-500" />
                    </div>
                    <span className="text-[15px] font-medium text-slate-900 truncate flex-1">
                      {t.name}
                    </span>
                    <span className="text-xs font-semibold capitalize px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-600">
                      {t.plan}
                    </span>
                    <span
                      className={`text-xs font-semibold capitalize ${
                        t.status === 'active' ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                    >
                      {t.status}
                    </span>
                    <span className="text-[13px] text-slate-400 tabular-nums hidden sm:block w-24 text-right">
                      {shortDate(t.created_at)}
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center text-sm text-slate-500">No institutions yet</div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}