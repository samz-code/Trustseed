import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Users,
  Wallet,
  AlertCircle,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle,
  Banknote,
  PiggyBank,
  RefreshCw,
} from 'lucide-react';

type ChangeType = 'positive' | 'negative' | 'neutral';

interface StatCard {
  label: string;
  value: string;
  change: string;
  changeType: ChangeType;
  icon: React.ReactNode;
  color: string;
}

interface RecentTx {
  id: string;
  transaction_type: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  customerName: string;
}

interface PendingApproval {
  id: string;
  transaction_type: string;
  amount: number;
  currency: string;
  required_role: string;
  created_at: string;
}

interface DashboardData {
  customerCount: number;
  walletCount: number;
  walletTotal: number;
  depositsToday: number;
  withdrawalsToday: number;
  activeLoanCount: number;
  loanOutstanding: number;
  savingsCount: number;
  savingsTotal: number;
  recentTransactions: RecentTx[];
  pendingApprovals: PendingApproval[];
}

const EMPTY: DashboardData = {
  customerCount: 0,
  walletCount: 0,
  walletTotal: 0,
  depositsToday: 0,
  withdrawalsToday: 0,
  activeLoanCount: 0,
  loanOutstanding: 0,
  savingsCount: 0,
  savingsTotal: 0,
  recentTransactions: [],
  pendingApprovals: [],
};

function formatMoney(value: number, currency = 'KES'): string {
  const symbol = currency === 'USD' ? '$' : currency === 'KES' ? 'KSh ' : `${currency} `;
  return `${symbol}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function customerLabel(row: {
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
} | null): string {
  if (!row) return 'Unknown';
  if (row.business_name) return row.business_name;
  const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
  return name || 'Unknown';
}

export function DashboardPage() {
  const { tenant, admin, branch, branches } = useAuth();

  const [data, setData] = useState<DashboardData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const defaultCurrency =
    (tenant?.settings as { default_currency?: string } | null)?.default_currency || 'KES';

  // Whether to scope to the selected branch. Head office / super admin see the
  // whole tenant; branch-level roles are scoped to their branch.
  const seesAllBranches =
    admin?.role === 'super_admin' ||
    admin?.role === 'institution_admin' ||
    admin?.role === 'head_office_admin';

  const branchId = branch?.id ?? null;

  const loadDashboard = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    setError(null);

    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayIso = todayStart.toISOString();

      // Helper to optionally scope a query to the selected branch.
      const scopeBranch = <T extends { eq: (c: string, v: string) => T }>(q: T): T =>
        !seesAllBranches && branchId ? q.eq('branch_id', branchId) : q;

      // --- Customers count ---
      let customersQuery = supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant!.id)
        .eq('status', 'active');
      customersQuery = scopeBranch(customersQuery);
      const customersRes = await customersQuery;
      if (customersRes.error) throw customersRes.error;

      // --- Wallets (count + total balance) ---
      let walletsQuery = supabase
        .from('wallets')
        .select('balance, branch_id')
        .eq('tenant_id', tenant!.id)
        .eq('status', 'active');
      walletsQuery = scopeBranch(walletsQuery);
      const walletsRes = await walletsQuery;
      if (walletsRes.error) throw walletsRes.error;
      const wallets = walletsRes.data ?? [];
      const walletTotal = wallets.reduce((sum, w) => sum + Number(w.balance || 0), 0);

      // --- Active loans (count + outstanding) ---
      let loansQuery = supabase
        .from('loan_accounts')
        .select('total_outstanding, branch_id')
        .eq('tenant_id', tenant!.id)
        .eq('status', 'active');
      loansQuery = scopeBranch(loansQuery);
      const loansRes = await loansQuery;
      if (loansRes.error) throw loansRes.error;
      const loans = loansRes.data ?? [];
      const loanOutstanding = loans.reduce((sum, l) => sum + Number(l.total_outstanding || 0), 0);

      // --- Savings (count + total balance) ---
      let savingsQuery = supabase
        .from('savings_accounts')
        .select('balance, branch_id')
        .eq('tenant_id', tenant!.id)
        .eq('status', 'active');
      savingsQuery = scopeBranch(savingsQuery);
      const savingsRes = await savingsQuery;
      if (savingsRes.error) throw savingsRes.error;
      const savings = savingsRes.data ?? [];
      const savingsTotal = savings.reduce((sum, s) => sum + Number(s.balance || 0), 0);

      // --- Today's transactions (deposits/withdrawals totals) ---
      let todayTxQuery = supabase
        .from('transactions')
        .select('transaction_type, amount, branch_id')
       .eq('tenant_id', tenant!.id)
       .gte('created_at', todayIso)
       .in('status', ['completed', 'approved', 'processing']);
      todayTxQuery = scopeBranch(todayTxQuery);
      const todayTxRes = await todayTxQuery;
      if (todayTxRes.error) throw todayTxRes.error;
      const todayTx = todayTxRes.data ?? [];
      const depositsToday = todayTx
        .filter((t) => t.transaction_type === 'deposit' || t.transaction_type === 'savings_deposit')
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);
      const withdrawalsToday = todayTx
        .filter(
          (t) =>
            t.transaction_type === 'withdrawal' || t.transaction_type === 'savings_withdrawal'
        )
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);

      // --- Recent transactions (with customer name) ---
      let recentQuery = supabase
        .from('transactions')
        .select(
          'id, transaction_type, amount, currency, status, created_at, from_customer_id, branch_id'
        )
        .order('created_at', { ascending: false })
        .limit(6);
      recentQuery = scopeBranch(recentQuery);
      const recentRes = await recentQuery;
      if (recentRes.error) throw recentRes.error;
      const recentRows = recentRes.data ?? [];

      // Resolve customer names in one round-trip.
      const customerIds = Array.from(
        new Set(recentRows.map((r) => r.from_customer_id).filter((v): v is string => !!v))
      );
      const nameMap = new Map<string, string>();
      if (customerIds.length > 0) {
        const custRes = await supabase
          .from('customers')
          .select('id, first_name, last_name, business_name')
          .in('id', customerIds);
        if (custRes.error) throw custRes.error;
        (custRes.data ?? []).forEach((c) => nameMap.set(c.id, customerLabel(c)));
      }
      const recentTransactions: RecentTx[] = recentRows.map((r) => ({
        id: r.id,
        transaction_type: r.transaction_type,
        amount: Number(r.amount || 0),
        currency: r.currency,
        status: r.status,
        created_at: r.created_at,
        customerName: r.from_customer_id ? nameMap.get(r.from_customer_id) ?? 'Customer' : 'External',
      }));

      // --- Pending approvals ---
      const approvalsRes = await supabase
        .from('transaction_approvals')
        .select('id, transaction_id, required_role, status, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(6);
      if (approvalsRes.error) throw approvalsRes.error;
      const approvalRows = approvalsRes.data ?? [];

      // Fetch the linked transactions for amount/type.
      const txIds = Array.from(new Set(approvalRows.map((a) => a.transaction_id)));
      const txMap = new Map<string, { transaction_type: string; amount: number; currency: string }>();
      if (txIds.length > 0) {
        const txRes = await supabase
          .from('transactions')
          .select('id, transaction_type, amount, currency')
          .in('id', txIds);
        if (txRes.error) throw txRes.error;
        (txRes.data ?? []).forEach((t) =>
          txMap.set(t.id, {
            transaction_type: t.transaction_type,
            amount: Number(t.amount || 0),
            currency: t.currency,
          })
        );
      }
      const pendingApprovals: PendingApproval[] = approvalRows.map((a) => {
        const tx = txMap.get(a.transaction_id);
        return {
          id: a.id,
          transaction_type: tx?.transaction_type ?? 'transaction',
          amount: tx?.amount ?? 0,
          currency: tx?.currency ?? defaultCurrency,
          required_role: a.required_role,
          created_at: a.created_at,
        };
      });

      setData({
        customerCount: customersRes.count ?? 0,
        walletCount: wallets.length,
        walletTotal,
        depositsToday,
        withdrawalsToday,
        activeLoanCount: loans.length,
        loanOutstanding,
        savingsCount: savings.length,
        savingsTotal,
        recentTransactions,
        pendingApprovals,
      });
    } catch (err) {
      console.error('Dashboard load error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      setData(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [tenant, branchId, seesAllBranches, defaultCurrency]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const stats: StatCard[] = [
    {
      label: 'Total Customers',
      value: data.customerCount.toLocaleString(),
      change: 'active',
      changeType: 'neutral',
      icon: <Users className="w-6 h-6" />,
      color: 'purple',
    },
    {
      label: 'Deposits Today',
      value: formatMoney(data.depositsToday, defaultCurrency),
      change: 'today',
      changeType: 'positive',
      icon: <ArrowDownRight className="w-6 h-6" />,
      color: 'teal',
    },
    {
      label: 'Withdrawals Today',
      value: formatMoney(data.withdrawalsToday, defaultCurrency),
      change: 'today',
      changeType: 'neutral',
      icon: <ArrowUpRight className="w-6 h-6" />,
      color: 'orange',
    },
    {
      label: 'Active Loans',
      value: data.activeLoanCount.toLocaleString(),
      change: `${formatMoney(data.loanOutstanding, defaultCurrency)} outstanding`,
      changeType: 'neutral',
      icon: <Banknote className="w-6 h-6" />,
      color: 'purple',
    },
    {
      label: 'Savings Accounts',
      value: data.savingsCount.toLocaleString(),
      change: `${formatMoney(data.savingsTotal, defaultCurrency)} balance`,
      changeType: 'neutral',
      icon: <PiggyBank className="w-6 h-6" />,
      color: 'teal',
    },
    {
      label: 'Wallets',
      value: data.walletCount.toLocaleString(),
      change: `${formatMoney(data.walletTotal, defaultCurrency)} total`,
      changeType: 'neutral',
      icon: <Wallet className="w-6 h-6" />,
      color: 'orange',
    },
  ];

  const colorClasses = (color: string): { bg: string; text: string } => {
    const map: Record<string, { bg: string; text: string }> = {
      purple: { bg: 'bg-[#641f60]/10', text: 'text-[#641f60]' },
      teal: { bg: 'bg-[#1ebcb2]/10', text: 'text-[#1ebcb2]' },
      orange: { bg: 'bg-[#ee7b22]/10', text: 'text-[#ee7b22]' },
    };
    return map[color] || map.purple;
  };

  return (
    <div className="space-y-6">
      {/* Welcome banner (brand purple) */}
      <div className="bg-gradient-to-r from-[#641f60] to-[#4a1646] rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              Welcome back, {admin?.full_name?.split(' ')[0] || 'there'}!
            </h1>
            <p className="text-white/80 mt-1">
              {tenant?.name}
              {branch?.name ? ` — ${branch.name}` : ''}
              {seesAllBranches && branches.length > 1 ? ' (all branches)' : ''}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-white/60">Account Plan</p>
            <p className="text-lg font-semibold capitalize">{tenant?.plan || 'starter'}</p>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-[#c46040]/10 border border-[#c46040]/30 rounded-xl p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-[#c46040]/15 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-6 h-6 text-[#c46040]" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-[#c46040]">Couldn&rsquo;t load dashboard data</h3>
            <p className="text-sm text-slate-600">{error}</p>
          </div>
          <button
            onClick={loadDashboard}
            className="px-4 py-2 bg-[#ee7b22] hover:bg-[#c46040] text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {/* First-day-setup nudge */}
      {branch && !branch.first_day_setup_completed && (
        <div className="bg-[#ee7b22]/10 border border-[#ee7b22]/30 rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#ee7b22]/15 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-[#ee7b22]" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-[#641f60]">First Day Setup Required</h3>
            <p className="text-sm text-slate-600">
              Complete the initial balance setup before starting operations for this branch.
            </p>
          </div>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'daily-opening' }))}
            className="px-4 py-2 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg transition-colors"
          >
            Start Setup
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
                <div className="w-10 h-10 rounded-lg bg-slate-200 mb-3" />
                <div className="h-7 w-20 bg-slate-200 rounded mb-2" />
                <div className="h-4 w-24 bg-slate-100 rounded" />
              </div>
            ))
          : stats.map((stat, idx) => {
              const c = colorClasses(stat.color);
              return (
                <div
                  key={idx}
                  className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2.5 rounded-lg ${c.bg}`}>
                      <span className={c.text}>{stat.icon}</span>
                    </div>
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                      {stat.change}
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 truncate">{stat.value}</h3>
                  <p className="text-sm text-slate-500 mt-1">{stat.label}</p>
                </div>
              );
            })}
      </div>

      {/* Recent + approvals */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent transactions */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Recent Transactions</h2>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'transactions' }))}
              className="text-sm text-[#1ebcb2] hover:text-[#641f60] font-medium transition-colors"
            >
              View All
            </button>
          </div>

          {loading ? (
            <div className="divide-y divide-slate-100">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="px-5 py-4 flex items-center gap-4 animate-pulse">
                  <div className="w-10 h-10 rounded-lg bg-slate-200" />
                  <div className="flex-1">
                    <div className="h-4 w-32 bg-slate-200 rounded mb-2" />
                    <div className="h-3 w-20 bg-slate-100 rounded" />
                  </div>
                  <div className="h-4 w-16 bg-slate-200 rounded" />
                </div>
              ))}
            </div>
          ) : data.recentTransactions.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {data.recentTransactions.map((tx: RecentTx) => {
                const isOut =
                  tx.transaction_type.includes('withdrawal') ||
                  tx.transaction_type === 'loan_disbursement';
                return (
                  <div key={tx.id} className="px-5 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        isOut ? 'bg-[#ee7b22]/10 text-[#ee7b22]' : 'bg-[#1ebcb2]/10 text-[#1ebcb2]'
                      }`}
                    >
                      {isOut ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">{tx.customerName}</p>
                      <p className="text-sm text-slate-500 capitalize">
                        {tx.transaction_type.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">
                        {isOut ? '-' : '+'}
                        {formatMoney(tx.amount, tx.currency)}
                      </p>
                      <p className="text-xs text-slate-500">{formatTime(tx.created_at)}</p>
                    </div>
                    <div
                      className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                        tx.status === 'completed'
                          ? 'bg-[#1ebcb2]/10 text-[#1ebcb2]'
                          : tx.status === 'failed' || tx.status === 'cancelled'
                          ? 'bg-[#c46040]/10 text-[#c46040]'
                          : 'bg-[#ee7b22]/10 text-[#ee7b22]'
                      }`}
                    >
                      {tx.status}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-5 py-12 text-center">
              <Activity className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No transactions yet</p>
              <p className="text-sm text-slate-400">
                Transactions will appear here once operations begin.
              </p>
            </div>
          )}
        </div>

        {/* Pending approvals */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Pending Approvals</h2>
            {!loading && (
              <span className="px-2.5 py-1 bg-[#ee7b22]/10 text-[#ee7b22] rounded-full text-xs font-medium">
                {data.pendingApprovals.length} pending
              </span>
            )}
          </div>

          {loading ? (
            <div className="divide-y divide-slate-100">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="px-5 py-4 animate-pulse">
                  <div className="h-4 w-28 bg-slate-200 rounded mb-2" />
                  <div className="h-3 w-20 bg-slate-100 rounded mb-2" />
                  <div className="h-5 w-24 bg-slate-200 rounded" />
                </div>
              ))}
            </div>
          ) : data.pendingApprovals.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {data.pendingApprovals.map((item: PendingApproval) => (
                <div key={item.id} className="px-5 py-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between mb-1">
                    <p className="font-medium text-slate-900 capitalize">
                      {item.transaction_type.replace(/_/g, ' ')}
                    </p>
                    <span className="text-xs text-slate-500">{formatTime(item.created_at)}</span>
                  </div>
                  <p className="text-lg font-semibold text-slate-900">
                    {formatMoney(item.amount, item.currency)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 capitalize">
                    Awaiting: {item.required_role.replace(/_/g, ' ')}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-8 text-center">
              <CheckCircle className="w-10 h-10 text-[#1ebcb2] mx-auto mb-2" />
              <p className="text-slate-500">No pending approvals</p>
            </div>
          )}
        </div>
      </div>

      {/* Branch overview (only when multiple branches) */}
      {branches.length > 1 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="font-semibold text-slate-900">Branch Overview</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 p-5">
            {branches.map((b: typeof branches[number]) => (
              <div
                key={b.id}
                className={`p-4 rounded-lg border transition-colors ${
                  b.id === branch?.id
                    ? 'border-[#1ebcb2] bg-[#1ebcb2]/5'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-slate-900">{b.name}</span>
                  {b.is_head_office && (
                    <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600">HQ</span>
                  )}
                </div>
                <p className="text-sm text-slate-500">{b.code}</p>
                <div className="mt-3 flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      b.status === 'active' ? 'bg-[#1ebcb2]' : 'bg-slate-300'
                    }`}
                  />
                  <span className="text-xs text-slate-600 capitalize">{b.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}