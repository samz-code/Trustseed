import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { formatMoney } from '../lib/accountCurrencies';
import type { TransactionStatus } from '../types';
import {
  Loader2,
  RefreshCw,
  AlertCircle,
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
  Building2,
  ShieldAlert,
  BarChart3,
  Crown,
} from 'lucide-react';

// ============================================================================
// Types & metric configuration
// ============================================================================

interface BranchLike {
  id: string;
  name: string;
  code?: string | null;
  is_head_office?: boolean | null;
  status?: string | null;
}

interface Metrics {
  volume: number; // total transaction value in the period
  count: number; // number of transactions
  newCustomers: number; // customers created in the period
  repayments: number; // loan repayment value
  deposits: number; // deposit / savings-deposit value
}

const emptyMetrics = (): Metrics => ({
  volume: 0,
  count: 0,
  newCustomers: 0,
  repayments: 0,
  deposits: 0,
});

type MetricKey = 'composite' | keyof Metrics;

const METRICS: { key: MetricKey; label: string; kind: 'money' | 'number' | 'score' }[] = [
  { key: 'composite', label: 'Composite score', kind: 'score' },
  { key: 'volume', label: 'Transaction volume', kind: 'money' },
  { key: 'count', label: 'Transactions', kind: 'number' },
  { key: 'newCustomers', label: 'New customers', kind: 'number' },
  { key: 'repayments', label: 'Loan repayments', kind: 'money' },
  { key: 'deposits', label: 'Deposits', kind: 'money' },
];

// Weights for the composite score (must sum to 1).
const WEIGHTS: Record<keyof Metrics, number> = {
  volume: 0.3,
  count: 0.2,
  newCustomers: 0.2,
  repayments: 0.15,
  deposits: 0.15,
};

const PERIODS: { key: string; label: string; days: number; calendarToday?: boolean }[] = [
  { key: 'today', label: 'Today', days: 1, calendarToday: true },
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
];

type Tier = 'best' | 'average' | 'low';

const TIER_META: Record<Tier, { label: string; bar: string; chipBg: string; chipText: string; dot: string }> = {
  best: { label: 'Best', bar: '#1ebcb2', chipBg: 'bg-[#1ebcb2]/10', chipText: 'text-[#1ebcb2]', dot: 'bg-[#1ebcb2]' },
  average: { label: 'Average', bar: '#ee7b22', chipBg: 'bg-[#ee7b22]/10', chipText: 'text-[#ee7b22]', dot: 'bg-[#ee7b22]' },
  low: { label: 'Needs attention', bar: '#c46040', chipBg: 'bg-[#c46040]/10', chipText: 'text-[#c46040]', dot: 'bg-[#c46040]' },
};

const CONSIDERED_STATUSES: readonly TransactionStatus[] = ['completed', 'approved', 'processing'];
const DEPOSIT_TYPES = new Set(['deposit', 'savings_deposit']);
const REPAYMENT_TYPES = new Set(['loan_repayment', 'repayment']);

// ============================================================================
// Helpers
// ============================================================================

function windowFor(period: (typeof PERIODS)[number]): { start: Date; prevStart: Date } {
  const now = new Date();
  let start: Date;
  if (period.calendarToday) {
    start = new Date();
    start.setHours(0, 0, 0, 0);
  } else {
    start = new Date(now.getTime() - period.days * 86_400_000);
  }
  const lengthMs = now.getTime() - start.getTime();
  const prevStart = new Date(start.getTime() - lengthMs);
  return { start, prevStart };
}

function computeScores(metricsByBranch: Map<string, Metrics>): Map<string, number> {
  // Max per metric across branches, used to normalise each metric to 0..1.
  const maxes: Metrics = emptyMetrics();
  for (const m of metricsByBranch.values()) {
    (Object.keys(maxes) as (keyof Metrics)[]).forEach((k) => {
      if (m[k] > maxes[k]) maxes[k] = m[k];
    });
  }
  const scores = new Map<string, number>();
  for (const [id, m] of metricsByBranch.entries()) {
    let score = 0;
    (Object.keys(WEIGHTS) as (keyof Metrics)[]).forEach((k) => {
      const norm = maxes[k] > 0 ? m[k] / maxes[k] : 0;
      score += WEIGHTS[k] * norm;
    });
    scores.set(id, score * 100);
  }
  return scores;
}

function classify(value: number, mean: number): Tier {
  if (mean <= 0) return 'average';
  if (value > 0 && value >= mean * 1.1) return 'best';
  if (value <= mean * 0.9) return 'low';
  return 'average';
}

// ============================================================================
// Component
// ============================================================================

interface BranchRow {
  branch: BranchLike;
  metrics: Metrics;
  prevMetrics: Metrics;
  score: number;
  prevScore: number;
}

export function BranchPerformancePage() {
  const { tenant, admin, branches } = useAuth();

  const canViewAll =
    admin?.role === 'super_admin' ||
    admin?.role === 'institution_admin' ||
    admin?.role === 'head_office_admin';

  const baseCurrency =
    (tenant?.settings as { base_currency?: string; default_currency?: string } | null)?.base_currency ||
    (tenant?.settings as { default_currency?: string } | null)?.default_currency ||
    'KES';

  const [periodKey, setPeriodKey] = useState('30d');
  const [metricKey, setMetricKey] = useState<MetricKey>('composite');

  const [rows, setRows] = useState<BranchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const period = useMemo(() => PERIODS.find((p) => p.key === periodKey) ?? PERIODS[2], [periodKey]);

  const load = useCallback(async () => {
    if (!tenant || !canViewAll) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { start, prevStart } = windowFor(period);
      const startIso = start.toISOString();
      const prevIso = prevStart.toISOString();

      const [txRes, custRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('transaction_type, amount, branch_id, created_at, status')
          .eq('tenant_id', tenant.id)
          .gte('created_at', prevIso)
          .in('status', CONSIDERED_STATUSES),
        supabase
          .from('customers')
          .select('branch_id, created_at')
          .eq('tenant_id', tenant.id)
          .gte('created_at', prevIso),
      ]);

      if (txRes.error) throw txRes.error;
      if (custRes.error) throw custRes.error;

      // Seed every branch so those with no activity still appear.
      const cur = new Map<string, Metrics>();
      const prev = new Map<string, Metrics>();
      for (const b of branches) {
        cur.set(b.id, emptyMetrics());
        prev.set(b.id, emptyMetrics());
      }
      const bucketFor = (createdAt: string, id: string): Metrics | null => {
        const map = createdAt >= startIso ? cur : prev;
        return map.get(id) ?? null; // null => branch not in our list; skip
      };

      for (const t of txRes.data ?? []) {
        if (!t.branch_id) continue; // tenant-wide rows aren't attributable to a branch
        const m = bucketFor(t.created_at as string, t.branch_id as string);
        if (!m) continue;
        const amt = Number(t.amount || 0);
        m.volume += amt;
        m.count += 1;
        if (DEPOSIT_TYPES.has(t.transaction_type as string)) m.deposits += amt;
        if (REPAYMENT_TYPES.has(t.transaction_type as string)) m.repayments += amt;
      }

      for (const c of custRes.data ?? []) {
        if (!c.branch_id) continue;
        const m = bucketFor(c.created_at as string, c.branch_id as string);
        if (!m) continue;
        m.newCustomers += 1;
      }

      const curScores = computeScores(cur);
      const prevScores = computeScores(prev);

      const built: BranchRow[] = branches.map((b) => ({
        branch: b as BranchLike,
        metrics: cur.get(b.id) ?? emptyMetrics(),
        prevMetrics: prev.get(b.id) ?? emptyMetrics(),
        score: curScores.get(b.id) ?? 0,
        prevScore: prevScores.get(b.id) ?? 0,
      }));

      setRows(built);
    } catch (err) {
      console.error('Branch performance load error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load branch performance');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tenant, canViewAll, period, branches]);

  useEffect(() => {
    load();
  }, [load]);

  // Value of the currently selected metric for a row.
  const valueOf = useCallback(
    (row: BranchRow, key: MetricKey = metricKey): number =>
      key === 'composite' ? row.score : row.metrics[key],
    [metricKey]
  );
  const prevValueOf = useCallback(
    (row: BranchRow): number => (metricKey === 'composite' ? row.prevScore : row.prevMetrics[metricKey]),
    [metricKey]
  );

  const metricDef = METRICS.find((m) => m.key === metricKey)!;

  const formatValue = useCallback(
    (value: number, kind = metricDef.kind): string => {
      if (kind === 'money') return formatMoney(value, baseCurrency);
      if (kind === 'score') return `${value.toFixed(1)}`;
      return Math.round(value).toLocaleString();
    },
    [baseCurrency, metricDef.kind]
  );

  // Ranked rows + tiering by the selected metric.
  const ranked = useMemo(() => {
    const values = rows.map((r) => valueOf(r));
    const mean = values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
    const maxValue = values.length ? Math.max(...values, 0) : 0;
    return rows
      .map((row) => {
        const value = valueOf(row);
        const prevValue = prevValueOf(row);
        const trendPct =
          prevValue > 0 ? ((value - prevValue) / prevValue) * 100 : value > 0 ? 100 : 0;
        return {
          ...row,
          value,
          prevValue,
          trendPct,
          tier: classify(value, mean),
          barPct: maxValue > 0 ? (value / maxValue) * 100 : 0,
        };
      })
      .sort((a, b) => b.value - a.value)
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }, [rows, valueOf, prevValueOf]);

  const distribution = useMemo(() => {
    const d: Record<Tier, number> = { best: 0, average: 0, low: 0 };
    ranked.forEach((r) => (d[r.tier] += 1));
    return d;
  }, [ranked]);

  const topPerformer = ranked[0];
  const lowPerformer = ranked.length > 1 ? ranked[ranked.length - 1] : undefined;

  const exportCsv = () => {
    const header = [
      'Rank',
      'Branch',
      'Code',
      'Tier',
      'Composite',
      'Transaction Volume',
      'Transactions',
      'New Customers',
      'Loan Repayments',
      'Deposits',
      `Trend % (${metricDef.label})`,
    ];
    const escape = (v: string | number) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = ranked.map((r) =>
      [
        r.rank,
        r.branch.name,
        r.branch.code ?? '',
        TIER_META[r.tier].label,
        r.score.toFixed(1),
        r.metrics.volume.toFixed(2),
        r.metrics.count,
        r.metrics.newCustomers,
        r.metrics.repayments.toFixed(2),
        r.metrics.deposits.toFixed(2),
        r.trendPct.toFixed(1),
      ]
        .map(escape)
        .join(',')
    );
    const csv = [header.map(escape).join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `branch-performance-${period.key}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --------------------------------------------------------------------------
  // Access gate
  // --------------------------------------------------------------------------
  if (!canViewAll) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-10 text-center max-w-lg mx-auto mt-8">
        <div className="w-14 h-14 rounded-full bg-[#c46040]/10 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-7 h-7 text-[#c46040]" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Head Office access only</h2>
        <p className="text-slate-500">
          Branch performance comparison is available to institution and head-office administrators. Your dashboard
          shows the data for your assigned branch.
        </p>
      </div>
    );
  }

  const TrendBadge = ({ pct }: { pct: number }) => {
    const flat = Math.abs(pct) < 0.05;
    const up = pct > 0;
    const cls = flat ? 'text-slate-400' : up ? 'text-[#1ebcb2]' : 'text-[#c46040]';
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium ${cls}`}>
        {flat ? <Minus className="w-3.5 h-3.5" /> : up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
        {flat ? '0%' : `${up ? '+' : ''}${pct.toFixed(0)}%`}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#641f60]">Branch Performance</h1>
          <p className="text-slate-600 mt-1">
            Compare and rank branches across key indicators · {tenant?.name}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg border border-[#dae1e1] overflow-hidden">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriodKey(p.key)}
                className={`px-3 py-2 text-sm font-medium ${
                  periodKey === p.key ? 'bg-[#641f60] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <select
            value={metricKey}
            onChange={(e) => setMetricKey(e.target.value as MetricKey)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
            aria-label="Ranking metric"
          >
            {METRICS.map((m) => (
              <option key={m.key} value={m.key}>
                Rank by: {m.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={load}
            className="px-3 py-2 border border-[#dae1e1] rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={loading || ranked.length === 0}
            className="px-3 py-2 bg-[#ee7b22] hover:bg-[#c46040] text-white rounded-lg transition-colors flex items-center gap-2 text-sm font-medium disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-[#c46040]/10 border border-[#c46040]/30 rounded-xl p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-[#c46040]/15 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-6 h-6 text-[#c46040]" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-[#c46040]">Couldn&rsquo;t load branch performance</h3>
            <p className="text-sm text-slate-600">{error}</p>
          </div>
          <button
            onClick={load}
            className="px-4 py-2 bg-[#ee7b22] hover:bg-[#c46040] text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {branches.length <= 1 && !loading && (
        <div className="bg-[#ee7b22]/10 border border-[#ee7b22]/30 rounded-xl p-4 text-sm text-[#641f60] flex items-start gap-2">
          <Building2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>
            Branch comparison is most useful with multiple branches. This institution currently has{' '}
            {branches.length} branch{branches.length === 1 ? '' : 'es'}.
          </p>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[#641f60]" />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                <Crown className="w-4 h-4 text-[#1ebcb2]" />
                Top performer
              </div>
              <p className="text-lg font-bold text-slate-900 truncate">
                {topPerformer ? topPerformer.branch.name : '—'}
              </p>
              <p className="text-sm text-slate-500 truncate">
                {topPerformer ? `${metricDef.label}: ${formatValue(topPerformer.value)}` : 'No data'}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                <TrendingDown className="w-4 h-4 text-[#c46040]" />
                Needs attention
              </div>
              <p className="text-lg font-bold text-slate-900 truncate">
                {lowPerformer ? lowPerformer.branch.name : '—'}
              </p>
              <p className="text-sm text-slate-500 truncate">
                {lowPerformer ? `${metricDef.label}: ${formatValue(lowPerformer.value)}` : 'Comparison needs 2+ branches'}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                <Building2 className="w-4 h-4 text-[#641f60]" />
                Branches compared
              </div>
              <p className="text-2xl font-bold text-slate-900">{ranked.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                <BarChart3 className="w-4 h-4 text-[#ee7b22]" />
                Tier spread
              </div>
              <div className="flex items-center gap-3 text-xs">
                {(['best', 'average', 'low'] as Tier[]).map((t) => (
                  <span key={t} className="inline-flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${TIER_META[t].dot}`} />
                    <span className="text-slate-600">{TIER_META[t].label}</span>
                    <span className="font-semibold text-slate-900">{distribution[t]}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Comparison chart (dependency-free horizontal bars) */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
              <h2 className="font-semibold text-slate-900">Comparison · {metricDef.label}</h2>
              <div className="flex items-center gap-3 text-xs">
                {(['best', 'average', 'low'] as Tier[]).map((t) => (
                  <span key={t} className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: TIER_META[t].bar }} />
                    <span className="text-slate-500">{TIER_META[t].label}</span>
                  </span>
                ))}
              </div>
            </div>
            <div className="p-5 space-y-3">
              {ranked.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No branch data to compare.</p>
              ) : (
                ranked.map((r) => (
                  <div key={r.branch.id} className="flex items-center gap-3">
                    <div className="w-32 sm:w-40 flex-shrink-0 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {r.rank}. {r.branch.name}
                      </p>
                      <p className="text-xs text-slate-400 truncate">{r.branch.code ?? ''}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="h-7 bg-slate-100 rounded-md overflow-hidden">
                        <div
                          className="h-full rounded-md transition-all duration-500 flex items-center justify-end"
                          style={{
                            width: `${Math.max(r.barPct, r.value > 0 ? 6 : 0)}%`,
                            backgroundColor: TIER_META[r.tier].bar,
                          }}
                        />
                      </div>
                    </div>
                    <div className="w-28 sm:w-36 flex-shrink-0 text-right">
                      <p className="text-sm font-semibold text-slate-900 truncate">{formatValue(r.value)}</p>
                      <TrendBadge pct={r.trendPct} />
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
              Trend compares this period against the preceding {period.label.toLowerCase()}. Money metrics are summed
              across currencies and shown in {baseCurrency}; enable FX conversion for exact cross-currency totals.
            </div>
          </div>

          {/* Ranking table with full KPI breakdown */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-[#ee7b22]" />
              <h2 className="font-semibold text-slate-900">Branch ranking &amp; KPIs</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-400 border-b border-slate-100">
                    <th className="px-4 py-3 font-medium">#</th>
                    <th className="px-4 py-3 font-medium">Branch</th>
                    <th className="px-4 py-3 font-medium">Tier</th>
                    <th className="px-4 py-3 font-medium text-right">Composite</th>
                    <th className="px-4 py-3 font-medium text-right">Volume</th>
                    <th className="px-4 py-3 font-medium text-right">Txns</th>
                    <th className="px-4 py-3 font-medium text-right">New Cust.</th>
                    <th className="px-4 py-3 font-medium text-right">Repayments</th>
                    <th className="px-4 py-3 font-medium text-right">Deposits</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ranked.map((r) => (
                    <tr key={r.branch.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-500">{r.rank}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-slate-900 truncate">{r.branch.name}</span>
                          {r.branch.is_head_office && (
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">HQ</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${TIER_META[r.tier].chipBg} ${TIER_META[r.tier].chipText}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${TIER_META[r.tier].dot}`} />
                          {TIER_META[r.tier].label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">{r.score.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right text-slate-700 whitespace-nowrap">
                        {formatMoney(r.metrics.volume, baseCurrency)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">{r.metrics.count.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{r.metrics.newCustomers.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-slate-700 whitespace-nowrap">
                        {formatMoney(r.metrics.repayments, baseCurrency)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 whitespace-nowrap">
                        {formatMoney(r.metrics.deposits, baseCurrency)}
                      </td>
                    </tr>
                  ))}
                  {ranked.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                        No branches to rank.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}