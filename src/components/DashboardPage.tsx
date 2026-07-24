import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { fetchExpenseSummary, type ExpenseSummary } from '../lib/expenses';
import { formatMoney } from '../lib/accountCurrencies';
import {
  useDashboardRates,
  bucketByCurrency,
  convertToBase,
  emptyTotal,
  rateSummary,
  formatAsOf,
  breakdownLine,
  type ConvertedTotal,
} from '../lib/currencyAggregate';
import { lookupRate } from '../lib/forexRates';
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
  Receipt,
  Landmark,
  BookOpen,
  ShieldAlert,
  UserPlus,
  Ban,
  TrendingUp,
} from 'lucide-react';

type ChangeType = 'positive' | 'negative' | 'neutral';

interface StatCard {
  label: string;
  value: string;
  change: string;
  changeType: ChangeType;
  icon: React.ReactNode;
  color: string;
  /** Native-currency breakdown, shown as a title tooltip when present. */
  tooltip?: string;
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

// Minimal shape for the float_accounts columns this page reads. Declared
// explicitly because `float_accounts` isn't in the generated Supabase
// types yet (see the `as any` cast in loadDashboard).
interface FloatRow {
  balance: number;
  branch_id: string | null;
  currency: string | null;
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

  // --- Money figures ----------------------------------------------------
  // Every one of these is a ConvertedTotal, not a bare number. Balances are
  // held in many currencies (KES wallets, USD wallets, UGX loans) and adding
  // the raw amounts together produces a meaningless figure. Each total is
  // bucketed by its own currency and converted into the institution base
  // currency at the active Forex Trading rate, carrying the rates applied
  // and any currency that had no rate path.
  walletTotal: ConvertedTotal;
  depositsToday: ConvertedTotal;
  withdrawalsToday: ConvertedTotal;
  activeLoanCount: number;
  loanOutstanding: ConvertedTotal;
  savingsCount: number;
  savingsTotal: ConvertedTotal;
  floatTotal: ConvertedTotal;
  floatAccountCount: number;

  recentTransactions: RecentTx[];
  pendingApprovals: PendingApproval[];

  // --- Role-specific figures -------------------------------------------
  // Loaded only for the role that needs them, so a teller's dashboard does
  // not pay for an accountant's queries and vice versa.

  /** Teller / cashier: this person's own activity, not the branch's. */
  myTxCountToday: number;
  myCashInToday: ConvertedTotal;
  myCashOutToday: ConvertedTotal;
  myNetToday: ConvertedTotal;

  /** Accountant / finance: what still needs their attention. */
  unpostedJournalCount: number;
  expensesAwaitingPayment: number;
  expensesAwaitingPaymentTotal: ConvertedTotal;

  /** Customer service: onboarding and account health. */
  kycPendingCount: number;
  frozenWalletCount: number;
  newCustomersThisMonth: number;
}

// EMPTY is a factory rather than a constant because the converted totals
// need to know which base currency they are reporting in.
const makeEmpty = (base: string): DashboardData => ({
  customerCount: 0,
  walletCount: 0,
  walletTotal: emptyTotal(base),
  depositsToday: emptyTotal(base),
  withdrawalsToday: emptyTotal(base),
  activeLoanCount: 0,
  loanOutstanding: emptyTotal(base),
  savingsCount: 0,
  savingsTotal: emptyTotal(base),
  floatTotal: emptyTotal(base),
  floatAccountCount: 0,
  recentTransactions: [],
  pendingApprovals: [],
  myTxCountToday: 0,
  myCashInToday: emptyTotal(base),
  myCashOutToday: emptyTotal(base),
  myNetToday: emptyTotal(base),
  unpostedJournalCount: 0,
  expensesAwaitingPayment: 0,
  expensesAwaitingPaymentTotal: emptyTotal(base),
  kycPendingCount: 0,
  frozenWalletCount: 0,
  newCustomersThisMonth: 0,
});

// Who can act on an approval queue. Anyone else would be shown a list they
// have no page to clear it from.
const APPROVAL_ROLES = new Set([
  'super_admin',
  'institution_admin',
  'head_office_admin',
  'branch_manager',
  'compliance_officer',
  'finance_officer',
]);

// Who compares branches. A teller works one till; the comparison is noise.
const BRANCH_OVERVIEW_ROLES = new Set([
  'super_admin',
  'institution_admin',
  'head_office_admin',
  'branch_manager',
  'auditor',
]);

const EMPTY_EXPENSES: ExpenseSummary = {
  totalToday: 0,
  totalThisMonth: 0,
  pendingCount: 0,
  pendingTotal: 0,
};

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

  // Prefer the institution base currency (shared with Daily Operations),
  // falling back to the legacy default_currency, then KES.
  const defaultCurrency =
    (tenant?.settings as { base_currency?: string; default_currency?: string } | null)?.base_currency ||
    (tenant?.settings as { default_currency?: string } | null)?.default_currency ||
    'KES';

  // Active rates from the Forex Trading module. Every money figure below is
  // reported in `defaultCurrency` using these, so the dashboard can state
  // which rate it used and when that rate was set.
  const {
    rates,
    asOf: ratesAsOf,
    loading: ratesLoading,
    error: ratesError,
    reload: reloadRates,
  } = useDashboardRates(tenant?.id);

  // The currency the figures are DISPLAYED in. Defaults to the institution
  // base currency, but Daniel can switch it to view the whole dashboard in
  // USD, SSP, or anything else that has a rate path. Storage is unaffected:
  // this only changes what the cards are converted into.
  const [displayCurrency, setDisplayCurrency] = useState<string>(defaultCurrency);

  // Keep display in step if the institution base currency itself changes.
  useEffect(() => {
    setDisplayCurrency(defaultCurrency);
  }, [defaultCurrency]);

  // Currencies worth offering: the base, plus every currency reachable from
  // it through the active rate graph. Offering a currency with no rate path
  // would just produce a dashboard of excluded figures.
  const currencyOptions = useMemo(() => {
    const codes = new Set<string>([defaultCurrency.toUpperCase()]);
    Object.values(rates).forEach((r) => {
      codes.add(r.from_currency.toUpperCase());
      codes.add(r.to_currency.toUpperCase());
    });
    return Array.from(codes)
      .filter((c) => c === defaultCurrency.toUpperCase() || lookupRate(rates, defaultCurrency, c) !== null)
      .sort();
  }, [rates, defaultCurrency]);

  const [data, setData] = useState<DashboardData>(() => makeEmpty(defaultCurrency));
  const [expenseSummary, setExpenseSummary] = useState<ExpenseSummary>(EMPTY_EXPENSES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Whether to scope to the selected branch. Head office / super admin see the
  // whole tenant; branch-level roles are scoped to their branch.
  const seesAllBranches =
    admin?.role === 'super_admin' ||
    admin?.role === 'institution_admin' ||
    admin?.role === 'head_office_admin';

  const branchId = branch?.id ?? null;

  const loadDashboard = useCallback(async () => {
    if (!tenant) return;
    // Wait for rates. Converting against an empty rate map would push every
    // foreign currency into `unconverted` and flash wrong figures on first
    // paint before correcting itself.
    if (ratesLoading) return;

    setLoading(true);
    setError(null);

    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayIso = todayStart.toISOString();

      // Helper to optionally scope a query to the selected branch.
      const scopeBranch = <T extends { eq: (c: string, v: string) => T }>(q: T): T =>
        !seesAllBranches && branchId ? q.eq('branch_id', branchId) : q;

      // Bucket rows by their own currency, then convert to the base currency
      // at active rates. Used for every money total on this page.
      // Rows are bucketed with the institution base as the fallback for any
      // row missing a currency, then converted into the DISPLAY currency.
      const toBase = (rows: { amount: number; currency: string | null }[]): ConvertedTotal =>
        convertToBase(bucketByCurrency(rows, defaultCurrency), displayCurrency, rates);

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
      // `currency` is selected so balances in different currencies are never
      // added together as if they were the same unit.
      let walletsQuery = supabase
        .from('wallets')
        .select('balance, currency, branch_id')
        .eq('tenant_id', tenant!.id)
        .eq('status', 'active');
      walletsQuery = scopeBranch(walletsQuery);
      const walletsRes = await walletsQuery;
      if (walletsRes.error) throw walletsRes.error;
      const wallets = (walletsRes.data ?? []) as {
        balance: number | null;
        currency: string | null;
      }[];
      const walletTotal = toBase(
        wallets.map((w) => ({ amount: Number(w.balance || 0), currency: w.currency }))
      );

      // --- Active loans (count + outstanding) ---
      let loansQuery = supabase
        .from('loan_accounts')
        .select('total_outstanding, currency, branch_id')
        .eq('tenant_id', tenant!.id)
        .eq('status', 'active');
      loansQuery = scopeBranch(loansQuery);
      const loansRes = await loansQuery;
      if (loansRes.error) throw loansRes.error;
      const loans = (loansRes.data ?? []) as {
        total_outstanding: number | null;
        currency: string | null;
      }[];
      const loanOutstanding = toBase(
        loans.map((l) => ({
          amount: Number(l.total_outstanding || 0),
          currency: l.currency,
        }))
      );

      // --- Savings (count + total balance) ---
      let savingsQuery = supabase
        .from('savings_accounts')
        .select('balance, currency, branch_id')
        .eq('tenant_id', tenant!.id)
        .eq('status', 'active');
      savingsQuery = scopeBranch(savingsQuery);
      const savingsRes = await savingsQuery;
      if (savingsRes.error) throw savingsRes.error;
      const savings = (savingsRes.data ?? []) as {
        balance: number | null;
        currency: string | null;
      }[];
      const savingsTotal = toBase(
        savings.map((s) => ({ amount: Number(s.balance || 0), currency: s.currency }))
      );

      // --- Float (cash-on-hand across float accounts) ---
      // Do NOT filter by a single currency here. Float accounts are held
      // per-currency (KES float, USD float, etc.), and hard-filtering to the
      // tenant default currency silently hides every account in another
      // currency. Read every active float account and convert below.
      //
      // Float accounts can be tenant-wide (branch_id IS NULL, e.g. head-office
      // reserves) as well as branch-scoped, so branch-restricted roles need an
      // OR filter rather than a plain .eq -- otherwise tenant-wide float would
      // disappear from their view (same pattern the Float page uses).
      //
      // Cast: `float_accounts` isn't in the generated Supabase types yet, so
      // without this TypeScript infers `never` for the row shape. Regenerate
      // types once the table is included and this cast can go away.
      let floatQuery = (supabase.from('float_accounts') as any)
        .select('balance, branch_id, currency')
        .eq('tenant_id', tenant!.id)
        .eq('status', 'active');
      if (!seesAllBranches && branchId) {
        floatQuery = floatQuery.or(`branch_id.eq.${branchId},branch_id.is.null`);
      }
      const floatRes = await floatQuery;
      if (floatRes.error) throw floatRes.error;
      const floatAccounts = (floatRes.data ?? []) as FloatRow[];
      const floatAccountCount = floatAccounts.length;
      const floatTotal = toBase(
        floatAccounts.map((f) => ({ amount: Number(f.balance || 0), currency: f.currency }))
      );

      // --- Today's transactions (deposits/withdrawals totals) ---
      let todayTxQuery = supabase
        .from('transactions')
        .select('transaction_type, amount, currency, branch_id')
        .eq('tenant_id', tenant!.id)
        .gte('created_at', todayIso)
        .in('status', ['completed', 'approved', 'processing']);
      todayTxQuery = scopeBranch(todayTxQuery);
      const todayTxRes = await todayTxQuery;
      if (todayTxRes.error) throw todayTxRes.error;
      const todayTx = (todayTxRes.data ?? []) as {
        transaction_type: string;
        amount: number | null;
        currency: string | null;
      }[];

      const txRowsOfType = (types: string[]) =>
        todayTx
          .filter((t) => types.includes(t.transaction_type))
          .map((t) => ({ amount: Number(t.amount || 0), currency: t.currency }));

      const depositsToday = toBase(txRowsOfType(['deposit', 'savings_deposit']));
      const withdrawalsToday = toBase(txRowsOfType(['withdrawal', 'savings_withdrawal']));

      // --- Recent transactions (with customer name) ---
      let recentQuery = supabase
        .from('transactions')
        .select(
          'id, transaction_type, amount, currency, status, created_at, from_customer_id, branch_id'
        )
        .eq('tenant_id', tenant!.id)
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
      // Individual rows keep their OWN currency. A single transaction is a
      // real figure in a real currency and must never be restated.
      const recentTransactions: RecentTx[] = recentRows.map((r) => ({
        id: r.id,
        transaction_type: r.transaction_type,
        amount: Number(r.amount || 0),
        currency: r.currency || defaultCurrency,
        status: r.status,
        created_at: r.created_at,
        customerName: r.from_customer_id ? nameMap.get(r.from_customer_id) ?? 'Customer' : 'External',
      }));

      // --- Pending approvals ---
      // Scoped through the linked transaction's tenant/branch below so that a
      // branch manager only sees approvals for their own branch.
      const approvalsRes = await supabase
        .from('transaction_approvals')
        .select('id, transaction_id, required_role, status, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20);
      if (approvalsRes.error) throw approvalsRes.error;
      const approvalRows = approvalsRes.data ?? [];

      // Fetch the linked transactions for amount/type, scoped to this tenant
      // (and branch when applicable) so cross-tenant/branch rows are excluded.
      const txIds = Array.from(new Set(approvalRows.map((a) => a.transaction_id)));
      const txMap = new Map<
        string,
        { transaction_type: string; amount: number; currency: string }
      >();
      if (txIds.length > 0) {
        let txQuery = supabase
          .from('transactions')
          .select('id, transaction_type, amount, currency, branch_id')
          .eq('tenant_id', tenant!.id)
          .in('id', txIds);
        txQuery = scopeBranch(txQuery);
        const txRes = await txQuery;
        if (txRes.error) throw txRes.error;
        (txRes.data ?? []).forEach((t) =>
          txMap.set(t.id, {
            transaction_type: t.transaction_type,
            amount: Number(t.amount || 0),
            currency: t.currency,
          })
        );
      }
      const pendingApprovals: PendingApproval[] = approvalRows
        .filter((a) => txMap.has(a.transaction_id)) // drop out-of-scope approvals
        .slice(0, 6)
        .map((a) => {
          const tx = txMap.get(a.transaction_id)!;
          return {
            id: a.id,
            transaction_type: tx.transaction_type,
            amount: tx.amount,
            currency: tx.currency || defaultCurrency,
            required_role: a.required_role,
            created_at: a.created_at,
          };
        });

      // --- Expenses summary ---
      const expSummary = await fetchExpenseSummary(
        tenant!.id,
        seesAllBranches ? null : branchId
      );

      // --- Role-specific queries -------------------------------------
      // Only the queries this role's dashboard actually shows are run. A
      // teller never pays for the accountant's journal scan, and vice versa.
      let myTxCountToday = 0;
      let myCashInToday = emptyTotal(displayCurrency);
      let myCashOutToday = emptyTotal(displayCurrency);
      let myNetToday = emptyTotal(displayCurrency);
      let unpostedJournalCount = 0;
      let expensesAwaitingPayment = 0;
      let expensesAwaitingPaymentTotal = emptyTotal(displayCurrency);
      let kycPendingCount = 0;
      let frozenWalletCount = 0;
      let newCustomersThisMonth = 0;

      const role = admin?.role ?? '';

      if ((role === 'teller' || role === 'cashier') && admin?.id) {
        // A teller cares about their OWN till position today, not the
        // branch total: it is what they will be asked to reconcile at close.
        const myTxRes = await supabase
          .from('transactions')
          .select('transaction_type, amount, currency, status')
          .eq('tenant_id', tenant!.id)
          .eq('created_by', admin.id)
          .gte('created_at', todayIso);
        if (myTxRes.error) throw myTxRes.error;

        const myTx = (myTxRes.data ?? []) as {
          transaction_type: string;
          amount: number | null;
          currency: string | null;
          status: string;
        }[];
        // Cancelled and failed movements never touched the drawer, so they
        // are excluded rather than inflating the day's figures.
        const settled = myTx.filter(
          (t) => t.status !== 'cancelled' && t.status !== 'failed' && t.status !== 'reversed'
        );
        myTxCountToday = settled.length;

        const inRows = settled
          .filter(
            (t) => t.transaction_type === 'deposit' || t.transaction_type === 'float_allocation'
          )
          .map((t) => ({ amount: Number(t.amount || 0), currency: t.currency }));

        const outRows = settled
          .filter(
            (t) => t.transaction_type === 'withdrawal' || t.transaction_type === 'float_return'
          )
          .map((t) => ({ amount: Number(t.amount || 0), currency: t.currency }));

        myCashInToday = toBase(inRows);
        myCashOutToday = toBase(outRows);

        // Net is computed from signed rows bucketed together rather than by
        // subtracting the two converted totals, so a currency that appears on
        // only one side still nets correctly and the unconverted list covers
        // both directions.
        myNetToday = toBase([
          ...inRows,
          ...outRows.map((r) => ({ amount: -r.amount, currency: r.currency })),
        ]);
      }

      if (role === 'accountant' || role === 'finance_officer') {
        const [journalRes, unpaidExpRes] = await Promise.all([
          supabase
            .from('journal_entries')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenant!.id)
            .eq('status', 'draft'),
          // Approved but not yet paid: money the institution owes and the
          // accountant is expected to settle.
          supabase
            .from('expenses')
            .select('amount, currency')
            .eq('tenant_id', tenant!.id)
            .eq('status', 'approved'),
        ]);
        if (journalRes.error) throw journalRes.error;
        if (unpaidExpRes.error) throw unpaidExpRes.error;

        unpostedJournalCount = journalRes.count ?? 0;
        const unpaid = (unpaidExpRes.data ?? []) as {
          amount: number | null;
          currency: string | null;
        }[];
        expensesAwaitingPayment = unpaid.length;
        expensesAwaitingPaymentTotal = toBase(
          unpaid.map((e) => ({ amount: Number(e.amount || 0), currency: e.currency }))
        );
      }

      if (role === 'customer_service') {
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        let kycQuery = supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant!.id)
          .eq('kyc_status', 'pending');
        kycQuery = scopeBranch(kycQuery);

        let frozenQuery = supabase
          .from('wallets')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant!.id)
          .eq('status', 'frozen');
        frozenQuery = scopeBranch(frozenQuery);

        let newCustQuery = supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant!.id)
          .gte('created_at', monthStart.toISOString());
        newCustQuery = scopeBranch(newCustQuery);

        const [kycRes, frozenRes, newCustRes] = await Promise.all([
          kycQuery,
          frozenQuery,
          newCustQuery,
        ]);
        if (kycRes.error) throw kycRes.error;
        if (frozenRes.error) throw frozenRes.error;
        if (newCustRes.error) throw newCustRes.error;

        kycPendingCount = kycRes.count ?? 0;
        frozenWalletCount = frozenRes.count ?? 0;
        newCustomersThisMonth = newCustRes.count ?? 0;
      }

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
        floatTotal,
        floatAccountCount,
        recentTransactions,
        pendingApprovals,
        myTxCountToday,
        myCashInToday,
        myCashOutToday,
        myNetToday,
        unpostedJournalCount,
        expensesAwaitingPayment,
        expensesAwaitingPaymentTotal,
        kycPendingCount,
        frozenWalletCount,
        newCustomersThisMonth,
      });
      setExpenseSummary(expSummary);
    } catch (err) {
      console.error('Dashboard load error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      setData(makeEmpty(displayCurrency));
      setExpenseSummary(EMPTY_EXPENSES);
    } finally {
      setLoading(false);
    }
  // admin is a dependency because the role-specific queries above branch on
  // admin.role and admin.id: without it, switching user would keep showing
  // the previous role's figures. `rates` is a dependency so that reloading
  // rates re-states every converted figure.
  }, [tenant, admin, branchId, seesAllBranches, defaultCurrency, displayCurrency, rates, ratesLoading]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  // Refresh pulls fresh rates first, then restates the figures against them.
  const handleRefresh = useCallback(async () => {
    await reloadRates();
    await loadDashboard();
  }, [reloadRates, loadDashboard]);

  // Float card chip: currency/rate context when float spans more than the
  // base currency, otherwise the plain account count.
  const floatChange = rateSummary(
    data.floatTotal,
    `${data.floatAccountCount} account${data.floatAccountCount === 1 ? '' : 's'}`
  );

  // ---------------------------------------------------------------------
  // Role-specific dashboards.
  //
  // Filtering the same eight cards by role would hide boxes without telling
  // anyone anything useful. A teller does not need the institution's total
  // customer count; they need their own till position for the reconciliation
  // they will be asked for at close. So the roles with real day-to-day work
  // get cards built for that work, and everyone else gets the shared set
  // trimmed to what their navigation already permits.
  //
  // Every money value below reads `.total` (the base-currency figure) and
  // carries `rateSummary(...)` in its chip plus a native breakdown tooltip,
  // so a figure is never shown without the rate that produced it.
  // ---------------------------------------------------------------------
  const role = admin?.role ?? '';

  // `fetchExpenseSummary` returns figures already summed in the institution
  // base currency, so they are restated here rather than re-bucketed. If the
  // base has no rate path to the display currency the original figure is kept
  // and labelled, instead of showing a converted number that is really base.
  const baseToDisplay = useCallback(
    (amount: number): { value: number; converted: boolean } => {
      if (displayCurrency === defaultCurrency.toUpperCase()) {
        return { value: amount, converted: true };
      }
      const r = lookupRate(rates, defaultCurrency, displayCurrency);
      if (r === null || !Number.isFinite(r) || r <= 0) {
        return { value: amount, converted: false };
      }
      return { value: amount * r, converted: true };
    },
    [rates, defaultCurrency, displayCurrency]
  );

  const expensesMonth = baseToDisplay(expenseSummary.totalThisMonth);

  const netIsInflow = data.myNetToday.total >= 0;

  const tellerStats: StatCard[] = [
    {
      label: 'My Transactions Today',
      value: data.myTxCountToday.toLocaleString(),
      change: 'processed by you',
      changeType: 'neutral',
      icon: <Activity className="w-6 h-6" />,
      color: 'purple',
    },
    {
      label: 'Cash In Today',
      value: formatMoney(data.myCashInToday.total, displayCurrency),
      change: rateSummary(data.myCashInToday, 'deposits and top-ups'),
      changeType: data.myCashInToday.complete ? 'positive' : 'negative',
      icon: <ArrowDownRight className="w-6 h-6" />,
      color: 'teal',
      tooltip: breakdownLine(data.myCashInToday),
    },
    {
      label: 'Cash Out Today',
      value: formatMoney(data.myCashOutToday.total, displayCurrency),
      change: rateSummary(data.myCashOutToday, 'withdrawals and payouts'),
      changeType: data.myCashOutToday.complete ? 'neutral' : 'negative',
      icon: <ArrowUpRight className="w-6 h-6" />,
      color: 'orange',
      tooltip: breakdownLine(data.myCashOutToday),
    },
    {
      label: 'Net Position',
      value: formatMoney(data.myNetToday.total, displayCurrency),
      change: rateSummary(data.myNetToday, netIsInflow ? 'net inflow' : 'net outflow'),
      changeType: !data.myNetToday.complete ? 'negative' : netIsInflow ? 'positive' : 'negative',
      icon: <Wallet className="w-6 h-6" />,
      color: 'mint',
      tooltip: breakdownLine(data.myNetToday),
    },
    {
      label: 'Float Balance',
      value: formatMoney(data.floatTotal.total, displayCurrency),
      change: floatChange,
      changeType: data.floatTotal.complete ? 'neutral' : 'negative',
      icon: <Landmark className="w-6 h-6" />,
      color: 'deepTeal',
      tooltip: breakdownLine(data.floatTotal),
    },
    {
      label: 'Total Customers',
      value: data.customerCount.toLocaleString(),
      change: 'active',
      changeType: 'neutral',
      icon: <Users className="w-6 h-6" />,
      color: 'plum',
    },
  ];

  const accountantStats: StatCard[] = [
    {
      label: 'Unposted Journals',
      value: data.unpostedJournalCount.toLocaleString(),
      change: data.unpostedJournalCount > 0 ? 'awaiting posting' : 'all posted',
      changeType: data.unpostedJournalCount > 0 ? 'negative' : 'positive',
      icon: <BookOpen className="w-6 h-6" />,
      color: 'purple',
    },
    {
      label: 'Expenses to Pay',
      value: data.expensesAwaitingPayment.toLocaleString(),
      change: `${formatMoney(data.expensesAwaitingPaymentTotal.total, displayCurrency)} approved`,
      changeType: data.expensesAwaitingPayment > 0 ? 'negative' : 'neutral',
      icon: <Receipt className="w-6 h-6" />,
      color: 'orange',
      tooltip: breakdownLine(data.expensesAwaitingPaymentTotal),
    },
    {
      label: 'Expenses (Month)',
      value: formatMoney(expensesMonth.value, expensesMonth.converted ? displayCurrency : defaultCurrency),
      change:
        expenseSummary.pendingCount > 0 ? `${expenseSummary.pendingCount} pending` : 'all clear',
      changeType: expenseSummary.pendingCount > 0 ? 'negative' : 'neutral',
      icon: <TrendingUp className="w-6 h-6" />,
      color: 'plum',
    },
    {
      label: 'Deposits Today',
      value: formatMoney(data.depositsToday.total, displayCurrency),
      change: rateSummary(data.depositsToday, 'today'),
      changeType: data.depositsToday.complete ? 'positive' : 'negative',
      icon: <ArrowDownRight className="w-6 h-6" />,
      color: 'teal',
      tooltip: breakdownLine(data.depositsToday),
    },
    {
      label: 'Withdrawals Today',
      value: formatMoney(data.withdrawalsToday.total, displayCurrency),
      change: rateSummary(data.withdrawalsToday, 'today'),
      changeType: data.withdrawalsToday.complete ? 'neutral' : 'negative',
      icon: <ArrowUpRight className="w-6 h-6" />,
      color: 'mint',
      tooltip: breakdownLine(data.withdrawalsToday),
    },
    {
      label: 'Float Balance',
      value: formatMoney(data.floatTotal.total, displayCurrency),
      change: floatChange,
      changeType: data.floatTotal.complete ? 'neutral' : 'negative',
      icon: <Landmark className="w-6 h-6" />,
      color: 'deepTeal',
      tooltip: breakdownLine(data.floatTotal),
    },
  ];

  const customerServiceStats: StatCard[] = [
    {
      label: 'KYC Pending',
      value: data.kycPendingCount.toLocaleString(),
      change: data.kycPendingCount > 0 ? 'needs verification' : 'all verified',
      changeType: data.kycPendingCount > 0 ? 'negative' : 'positive',
      icon: <ShieldAlert className="w-6 h-6" />,
      color: 'orange',
    },
    {
      label: 'New This Month',
      value: data.newCustomersThisMonth.toLocaleString(),
      change: 'customers onboarded',
      changeType: 'positive',
      icon: <UserPlus className="w-6 h-6" />,
      color: 'teal',
    },
    {
      label: 'Total Customers',
      value: data.customerCount.toLocaleString(),
      change: 'active',
      changeType: 'neutral',
      icon: <Users className="w-6 h-6" />,
      color: 'purple',
    },
    {
      label: 'Frozen Wallets',
      value: data.frozenWalletCount.toLocaleString(),
      change: data.frozenWalletCount > 0 ? 'need attention' : 'none frozen',
      changeType: data.frozenWalletCount > 0 ? 'negative' : 'positive',
      icon: <Ban className="w-6 h-6" />,
      color: 'plum',
    },
    {
      label: 'Wallets',
      value: data.walletCount.toLocaleString(),
      change: `${formatMoney(data.walletTotal.total, displayCurrency)} total`,
      changeType: data.walletTotal.complete ? 'neutral' : 'negative',
      icon: <Wallet className="w-6 h-6" />,
      color: 'mint',
      tooltip: breakdownLine(data.walletTotal),
    },
    {
      label: 'Savings Accounts',
      value: data.savingsCount.toLocaleString(),
      change: `${formatMoney(data.savingsTotal.total, displayCurrency)} balance`,
      changeType: data.savingsTotal.complete ? 'neutral' : 'negative',
      icon: <PiggyBank className="w-6 h-6" />,
      color: 'softOrange',
      tooltip: breakdownLine(data.savingsTotal),
    },
  ];

  const sharedStats: StatCard[] = [
    {
      label: 'Total Customers',
      value: data.customerCount.toLocaleString(),
      change: 'active',
      changeType: 'neutral',
      icon: <Users className="w-6 h-6" />,
      color: 'purple', // #641f60
    },
    {
      label: 'Float Balance',
      value: formatMoney(data.floatTotal.total, displayCurrency),
      change: floatChange,
      changeType: data.floatTotal.complete ? 'neutral' : 'negative',
      icon: <Landmark className="w-6 h-6" />,
      color: 'orange', // #ee7b22
      tooltip: breakdownLine(data.floatTotal),
    },
    {
      label: 'Deposits Today',
      value: formatMoney(data.depositsToday.total, displayCurrency),
      change: rateSummary(data.depositsToday, 'today'),
      changeType: data.depositsToday.complete ? 'positive' : 'negative',
      icon: <ArrowDownRight className="w-6 h-6" />,
      color: 'teal', // #1ebcb2
      tooltip: breakdownLine(data.depositsToday),
    },
    {
      label: 'Withdrawals Today',
      value: formatMoney(data.withdrawalsToday.total, displayCurrency),
      change: rateSummary(data.withdrawalsToday, 'today'),
      changeType: data.withdrawalsToday.complete ? 'neutral' : 'negative',
      icon: <ArrowUpRight className="w-6 h-6" />,
      color: 'mint', // #8dd3cd
      tooltip: breakdownLine(data.withdrawalsToday),
    },
    {
      label: 'Active Loans',
      value: data.activeLoanCount.toLocaleString(),
      change: `${formatMoney(data.loanOutstanding.total, displayCurrency)} outstanding`,
      changeType: data.loanOutstanding.complete ? 'neutral' : 'negative',
      icon: <Banknote className="w-6 h-6" />,
      color: 'deepTeal', // #158f87 (derived from #1ebcb2)
      tooltip: breakdownLine(data.loanOutstanding),
    },
    {
      label: 'Savings Accounts',
      value: data.savingsCount.toLocaleString(),
      change: `${formatMoney(data.savingsTotal.total, displayCurrency)} balance`,
      changeType: data.savingsTotal.complete ? 'neutral' : 'negative',
      icon: <PiggyBank className="w-6 h-6" />,
      color: 'softOrange', // #f5a361 (derived from #ee7b22)
      tooltip: breakdownLine(data.savingsTotal),
    },
    {
      label: 'Wallets',
      value: data.walletCount.toLocaleString(),
      change: `${formatMoney(data.walletTotal.total, displayCurrency)} total`,
      changeType: data.walletTotal.complete ? 'neutral' : 'negative',
      icon: <Wallet className="w-6 h-6" />,
      color: 'cloud', // #dcdfe0
      tooltip: breakdownLine(data.walletTotal),
    },
    {
      label: 'Expenses (Month)',
      value: formatMoney(expensesMonth.value, expensesMonth.converted ? displayCurrency : defaultCurrency),
      change:
        expenseSummary.pendingCount > 0
          ? `${expenseSummary.pendingCount} pending`
          : 'all clear',
      changeType: expenseSummary.pendingCount > 0 ? 'negative' : 'neutral',
      icon: <Receipt className="w-6 h-6" />,
      color: 'plum', // #4a1646 (derived from #641f60)
    },
  ];

  // Roles without a bespoke dashboard get the shared cards trimmed to what
  // their navigation already allows, so the summary never advertises a page
  // they cannot open.
  const SHARED_CARDS_BY_ROLE: Record<string, string[]> = {
    loan_officer: ['Total Customers', 'Active Loans', 'Savings Accounts'],
    forex_officer: ['Total Customers', 'Float Balance', 'Deposits Today', 'Withdrawals Today', 'Wallets'],
    compliance_officer: ['Total Customers', 'Deposits Today', 'Withdrawals Today'],
    auditor: ['Deposits Today', 'Withdrawals Today', 'Expenses (Month)', 'Active Loans'],
  };

  const stats: StatCard[] =
    role === 'teller' || role === 'cashier'
      ? tellerStats
      : role === 'accountant' || role === 'finance_officer'
      ? accountantStats
      : role === 'customer_service'
      ? customerServiceStats
      : SHARED_CARDS_BY_ROLE[role]
      ? sharedStats.filter((c) => SHARED_CARDS_BY_ROLE[role].includes(c.label))
      : sharedStats;

  // Currencies present anywhere on this dashboard that have no rate path to
  // the base currency. Their balances are excluded from the totals above, so
  // this has to be stated rather than left as a silent shortfall.
  const missingRateCurrencies = Array.from(
    new Set(
      [
        data.floatTotal,
        data.walletTotal,
        data.savingsTotal,
        data.loanOutstanding,
        data.depositsToday,
        data.withdrawalsToday,
        data.myCashInToday,
        data.myCashOutToday,
        data.expensesAwaitingPaymentTotal,
      ].flatMap((t) => t.unconverted)
    )
  );

  // Every card gets its own distinct color -- no repeats. Your 5 given hex
  // values are used as-is (purple, orange, teal, mint, and the light
  // #dcdfe0 as a neutral accent), plus 3 tints/shades pulled from the same
  // brand family (deep teal, soft orange, deep plum) so the remaining
  // cards stay unique without introducing outside colors.
  const tileClasses = (
    color: string
  ): { accent: string; iconBg: string; iconText: string; chipBg: string; chipText: string } => {
    const map: Record<
      string,
      { accent: string; iconBg: string; iconText: string; chipBg: string; chipText: string }
    > = {
      purple: {
        accent: 'bg-[#641f60]',
        iconBg: 'bg-[#641f60]/10',
        iconText: 'text-[#641f60]',
        chipBg: 'bg-[#641f60]/10',
        chipText: 'text-[#641f60]',
      },
      orange: {
        accent: 'bg-[#ee7b22]',
        iconBg: 'bg-[#ee7b22]/10',
        iconText: 'text-[#ee7b22]',
        chipBg: 'bg-[#ee7b22]/10',
        chipText: 'text-[#ee7b22]',
      },
      teal: {
        accent: 'bg-[#1ebcb2]',
        iconBg: 'bg-[#1ebcb2]/10',
        iconText: 'text-[#1ebcb2]',
        chipBg: 'bg-[#1ebcb2]/10',
        chipText: 'text-[#1ebcb2]',
      },
      mint: {
        accent: 'bg-[#8dd3cd]',
        iconBg: 'bg-[#8dd3cd]/25',
        iconText: 'text-[#158f87]',
        chipBg: 'bg-[#8dd3cd]/25',
        chipText: 'text-[#158f87]',
      },
      // Your neutral #dcdfe0 as its own accent -- dark purple text/icon for
      // contrast since the base tone itself is very light.
      cloud: {
        accent: 'bg-[#dcdfe0]',
        iconBg: 'bg-[#dcdfe0]',
        iconText: 'text-[#641f60]',
        chipBg: 'bg-[#dcdfe0]',
        chipText: 'text-[#641f60]',
      },
      // Derived shade: deep teal.
      deepTeal: {
        accent: 'bg-[#158f87]',
        iconBg: 'bg-[#158f87]/10',
        iconText: 'text-[#158f87]',
        chipBg: 'bg-[#158f87]/10',
        chipText: 'text-[#158f87]',
      },
      // Derived shade: soft/light orange.
      softOrange: {
        accent: 'bg-[#f5a361]',
        iconBg: 'bg-[#f5a361]/25',
        iconText: 'text-[#c46b1f]',
        chipBg: 'bg-[#f5a361]/25',
        chipText: 'text-[#c46b1f]',
      },
      // Derived shade: deep plum.
      plum: {
        accent: 'bg-[#4a1646]',
        iconBg: 'bg-[#4a1646]/10',
        iconText: 'text-[#4a1646]',
        chipBg: 'bg-[#4a1646]/10',
        chipText: 'text-[#4a1646]',
      },
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
              {branch?.name ? ` - ${branch.name}` : ''}
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
            onClick={handleRefresh}
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

      {/* Rate basis banner. Every converted figure below is stated in the
          base currency, so the rate source and its as-of time belong on the
          page, not buried in a tooltip. */}
      {ratesError ? (
        <div className="bg-[#c46040]/10 border border-[#c46040]/30 rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <AlertCircle className="w-4 h-4 text-[#c46040] flex-shrink-0" />
          <span className="text-[#c46040] font-medium">
            Exchange rates unavailable
          </span>
          <span className="text-slate-600">
            Totals show {displayCurrency} balances only. Other currencies are excluded.
          </span>
          <button
            onClick={() => void reloadRates()}
            className="ml-auto inline-flex items-center gap-1.5 text-[#641f60] font-medium hover:underline"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      ) : (
        <div className="bg-white border border-[#dcdfe0] rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
          <TrendingUp className="w-4 h-4 text-[#1ebcb2] flex-shrink-0" />
          <span className="text-slate-600">Totals shown in</span>

          {/* Display-currency switcher. Only currencies with a rate path from
              the institution base are offered, so a selection can never
              produce a dashboard of excluded figures. */}
          <label className="sr-only" htmlFor="dashboard-display-currency">
            Display currency
          </label>
          <select
            id="dashboard-display-currency"
            value={displayCurrency}
            onChange={(e) => setDisplayCurrency(e.target.value)}
            disabled={currencyOptions.length <= 1}
            className="px-2 py-1 border border-[#dcdfe0] rounded-md bg-white text-[#641f60] font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] disabled:opacity-60 disabled:cursor-not-allowed"
            title={
              currencyOptions.length <= 1
                ? 'Add exchange rate pairs in Forex Trading to view other currencies'
                : 'Restate every figure in this currency'
            }
          >
            {currencyOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <span className="text-slate-600">
            at active Forex Trading rates
            {displayCurrency !== defaultCurrency.toUpperCase() && (
              <span className="text-slate-400"> (base {defaultCurrency})</span>
            )}
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500">as of {formatAsOf(ratesAsOf)}</span>

          {Object.keys(rates).length === 0 && (
            <>
              <span className="text-slate-300">|</span>
              <span className="text-[#ee7b22] font-medium">
                no active currency pairs configured
              </span>
            </>
          )}

          {missingRateCurrencies.length > 0 && (
            <>
              <span className="text-slate-300">|</span>
              <span className="text-[#c46040] font-medium">
                {missingRateCurrencies.join(', ')} excluded, no rate to {displayCurrency}
              </span>
            </>
          )}

          <button
            onClick={handleRefresh}
            className="ml-auto inline-flex items-center gap-1.5 text-[#1ebcb2] hover:text-[#641f60] font-medium transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh rates
          </button>
        </div>
      )}

      {/* Stats - white cards, colored accent per card, bold figures */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {loading || ratesLoading
          ? Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="rounded-2xl p-6 bg-white border border-[#dcdfe0] animate-pulse">
                <div className="w-11 h-11 rounded-xl bg-slate-200 mb-6" />
                <div className="h-8 w-24 bg-slate-200 rounded mb-2" />
                <div className="h-4 w-28 bg-slate-100 rounded" />
              </div>
            ))
          : stats.map((stat, idx) => {
              const t = tileClasses(stat.color);
              const clickable = stat.label === 'Expenses (Month)' || stat.label === 'Float Balance';
              return (
                <div
                  key={idx}
                  title={stat.tooltip}
                  onClick={() => {
                    if (stat.label === 'Expenses (Month)') {
                      window.dispatchEvent(new CustomEvent('navigate', { detail: 'expenses' }));
                    } else if (stat.label === 'Float Balance') {
                      window.dispatchEvent(new CustomEvent('navigate', { detail: 'float' }));
                    }
                  }}
                  className={`relative overflow-hidden rounded-2xl bg-white border border-[#dcdfe0] pl-6 pr-6 py-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${
                    clickable ? 'cursor-pointer' : ''
                  }`}
                >
                  {/* Colored accent bar identifies the card without tinting the whole background */}
                  <div className={`absolute left-0 top-0 h-full w-1.5 ${t.accent}`} />

                  <div className="flex items-start justify-between gap-2 mb-6">
                    <div className={`w-11 h-11 rounded-xl ${t.iconBg} flex items-center justify-center flex-shrink-0`}>
                      <span className={t.iconText}>{stat.icon}</span>
                    </div>
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full text-right leading-tight ${
                        stat.changeType === 'negative'
                          ? 'bg-[#c46040]/10 text-[#c46040]'
                          : `${t.chipBg} ${t.chipText}`
                      }`}
                    >
                      {stat.change}
                    </span>
                  </div>

                  <p className="text-3xl font-extrabold tracking-tight leading-none text-slate-900 truncate">
                    {stat.value}
                  </p>
                  <p className="text-sm font-medium text-slate-500 mt-2">{stat.label}</p>
                </div>
              );
            })}
      </div>

      {/* Recent + approvals */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent transactions */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Recent Transactions</h2>
              <p className="text-xs text-slate-500 mt-0.5">Shown in original currency</p>
            </div>
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

        {/* Pending approvals - only for roles that can actually action them.
            Showing a queue to someone whose navigation has no Approvals page
            would just be a list they can never clear. */}
        {APPROVAL_ROLES.has(role) && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Pending Approvals</h2>
              <p className="text-xs text-slate-500 mt-0.5">Shown in original currency</p>
            </div>
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
        )}
      </div>

      {/* Branch overview - head office and managers only. A teller compares
          nothing across branches; they work one till. */}
      {branches.length > 1 && BRANCH_OVERVIEW_ROLES.has(role) && (
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