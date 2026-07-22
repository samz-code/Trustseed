import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Tables, InsertTables } from '../lib/supabase';
import {
  Plus,
  Search,
  Calculator,
  X,
  Loader2,
  RefreshCw,
  AlertCircle,
  Lock,
  Pencil,
  Ban,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Wallet,
  Landmark,
  Scale,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

type Account = Tables<'chart_of_accounts'>;
type AccountType = Account['account_type'];

interface AccountForm {
  account_code: string;
  account_name: string;
  account_type: AccountType;
  account_category: string;
  parent_account_id: string;
  description: string;
}

const EMPTY_FORM: AccountForm = {
  account_code: '',
  account_name: '',
  account_type: 'asset',
  account_category: '',
  parent_account_id: '',
  description: '',
};

const ACCOUNT_TYPES: { value: AccountType; label: string; icon: React.ReactNode }[] = [
  { value: 'asset', label: 'Assets', icon: <Wallet className="w-5 h-5" /> },
  { value: 'liability', label: 'Liabilities', icon: <Landmark className="w-5 h-5" /> },
  { value: 'equity', label: 'Equity', icon: <Scale className="w-5 h-5" /> },
  { value: 'revenue', label: 'Revenue', icon: <TrendingUp className="w-5 h-5" /> },
  { value: 'expense', label: 'Expenses', icon: <TrendingDown className="w-5 h-5" /> },
];

const TYPE_COLORS: Record<AccountType, { bg: string; text: string }> = {
  asset: { bg: 'bg-[#1ebcb2]/10', text: 'text-[#1ebcb2]' },
  liability: { bg: 'bg-[#ee7b22]/10', text: 'text-[#ee7b22]' },
  equity: { bg: 'bg-[#641f60]/10', text: 'text-[#641f60]' },
  revenue: { bg: 'bg-[#1ebcb2]/10', text: 'text-[#1ebcb2]' },
  expense: { bg: 'bg-[#c46040]/10', text: 'text-[#c46040]' },
};

// Singular label for a type (e.g. "Assets" -> "Asset"), safe even if a label
// doesn't happen to end in "s".
function singularType(type: AccountType): string {
  const label = ACCOUNT_TYPES.find((t) => t.value === type)?.label ?? type;
  return label.endsWith('s') ? label.slice(0, -1) : label;
}

export function ChartOfAccountsPage() {
  const { tenant } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedTypes, setCollapsedTypes] = useState<Set<AccountType>>(new Set());

  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [formData, setFormData] = useState<AccountForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('account_code', { ascending: true });

      if (error) throw error;
      setAccounts(data ?? []);
    } catch (err) {
      console.error('Error loading chart of accounts:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load chart of accounts');
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const filteredAccounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q === '') return accounts;
    return accounts.filter(
      (a) =>
        a.account_code.toLowerCase().includes(q) ||
        a.account_name.toLowerCase().includes(q) ||
        (a.account_category ?? '').toLowerCase().includes(q)
    );
  }, [accounts, searchQuery]);

  const groupedByType = useMemo(() => {
    const groups: Record<AccountType, Account[]> = {
      asset: [],
      liability: [],
      equity: [],
      revenue: [],
      expense: [],
    };
    for (const a of filteredAccounts) {
      // Guard against unexpected/legacy account types not in the known set,
      // so a stray value can never crash the grouping.
      if (groups[a.account_type]) groups[a.account_type].push(a);
    }
    return groups;
  }, [filteredAccounts]);

  const isSearching = searchQuery.trim() !== '';
  const noSearchResults = isSearching && filteredAccounts.length === 0;

  const toggleTypeCollapsed = (type: AccountType) => {
    setCollapsedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const accountName = (id: string | null): string => {
    if (!id) return '—';
    const acc = accounts.find((a) => a.id === id);
    return acc ? `${acc.account_code} · ${acc.account_name}` : 'Unknown';
  };

  // Standard accounting code ranges. Getting these wrong is not cosmetic:
  // this chart currently holds cash classified as an expense AND as equity,
  // which makes the trial balance wrong by construction. The old validation
  // only checked that the fields were non-empty, which is how that happened.
  const CODE_RANGES: { type: AccountType; min: number; max: number; label: string }[] = [
    { type: 'asset', min: 1000, max: 1999, label: '1000-1999' },
    { type: 'liability', min: 2000, max: 2999, label: '2000-2999' },
    { type: 'equity', min: 3000, max: 3999, label: '3000-3999' },
    { type: 'revenue', min: 4000, max: 4999, label: '4000-4999' },
    { type: 'expense', min: 5000, max: 5999, label: '5000-5999' },
  ];

  const expectedTypeForCode = (code: string): AccountType | null => {
    const n = parseInt(code.trim(), 10);
    if (Number.isNaN(n)) return null;
    return CODE_RANGES.find((r) => n >= r.min && n <= r.max)?.type ?? null;
  };

  const rangeForType = (type: AccountType): string =>
    CODE_RANGES.find((r) => r.type === type)?.label ?? '';

  // Shown as a warning under the code field, not blocking: an institution may
  // have a legitimate reason for an unusual code, but should see the mismatch.
  const codeTypeWarning = useMemo((): string | null => {
    const code = formData.account_code.trim();
    if (!code) return null;
    const expected = expectedTypeForCode(code);
    if (!expected) return null;
    if (expected !== formData.account_type) {
      return `Code ${code} is normally ${singularType(expected).toLowerCase()} (${rangeForType(
        expected
      )}), but this is set as ${singularType(formData.account_type).toLowerCase()}.`;
    }
    return null;
  }, [formData.account_code, formData.account_type]);

  const validateForm = (): string | null => {
    const code = formData.account_code.trim();
    const name = formData.account_name.trim();

    if (!code) return 'Account code is required.';
    if (!name) return 'Account name is required.';

    // A code like "NT-)!" or "gh5678" cannot be sorted, grouped or reported on
    // sensibly. Digits only, which is what every standard chart uses.
    if (!/^\d{3,6}$/.test(code)) {
      return 'Account code must be 3 to 6 digits, e.g. 1000. Letters and punctuation cannot be sorted or grouped into statements.';
    }

    if (!editingAccount) {
      const codeExists = accounts.some(
        (a) => a.account_code.trim().toLowerCase() === code.toLowerCase()
      );
      if (codeExists) return `Account code "${code}" is already in use.`;

      // Three accounts called "cash on hand" with three different types is
      // how this chart ended up unusable. Catch the duplicate at entry.
      const nameExists = accounts.some(
        (a) =>
          a.is_active &&
          a.account_name.trim().toLowerCase() === name.toLowerCase()
      );
      if (nameExists) {
        return `An active account named "${name}" already exists. Use a different name, or edit the existing one.`;
      }
    }

    return null;
  };

  // A standard MFI/SACCO chart. Offered when an institution has none, because
  // journal entries have to post somewhere: without accounts, the general
  // ledger and trial balance stay empty no matter how much money moves.
  const STANDARD_CHART: {
    account_code: string;
    account_name: string;
    account_type: AccountType;
    account_category: string;
  }[] = [
    { account_code: '1000', account_name: 'Cash on Hand', account_type: 'asset', account_category: 'cash' },
    { account_code: '1010', account_name: 'Bank Account', account_type: 'asset', account_category: 'bank' },
    { account_code: '1020', account_name: 'Mobile Money Float', account_type: 'asset', account_category: 'cash' },
    { account_code: '1200', account_name: 'Loans Receivable', account_type: 'asset', account_category: 'receivable' },
    { account_code: '1210', account_name: 'Interest Receivable', account_type: 'asset', account_category: 'receivable' },
    { account_code: '2000', account_name: 'Customer Deposits', account_type: 'liability', account_category: 'payable' },
    { account_code: '2100', account_name: 'Savings Payable', account_type: 'liability', account_category: 'payable' },
    { account_code: '3000', account_name: 'Owner Equity', account_type: 'equity', account_category: 'equity' },
    { account_code: '3100', account_name: 'Retained Earnings', account_type: 'equity', account_category: 'equity' },
    { account_code: '4000', account_name: 'Interest Income', account_type: 'revenue', account_category: 'income' },
    { account_code: '4100', account_name: 'Fee Income', account_type: 'revenue', account_category: 'income' },
    { account_code: '4200', account_name: 'Forex Gain', account_type: 'revenue', account_category: 'income' },
    { account_code: '5000', account_name: 'Operating Expenses', account_type: 'expense', account_category: 'expense' },
    { account_code: '5100', account_name: 'Staff Costs', account_type: 'expense', account_category: 'expense' },
    { account_code: '5200', account_name: 'Loan Loss Provision', account_type: 'expense', account_category: 'expense' },
  ];

  const [seeding, setSeeding] = useState(false);

  const seedStandardChart = async () => {
    if (!tenant) return;
    setSeeding(true);
    setLoadError(null);
    try {
      // Only add what is missing, so this is safe to press twice and safe on
      // a chart that already has some accounts.
      const existingCodes = new Set(accounts.map((a) => a.account_code.trim()));
      const toInsert = STANDARD_CHART.filter((a) => !existingCodes.has(a.account_code)).map((a) => ({
        tenant_id: tenant.id,
        ...a,
        is_active: true,
        allow_manual_entry: true,
        is_system_account: false,
      }));

      if (toInsert.length === 0) {
        setLoadError('Every standard account already exists in this chart.');
        return;
      }

      const { error } = await supabase.from('chart_of_accounts').insert(toInsert as never);
      if (error) throw error;
      await loadAccounts();
    } catch (err) {
      console.error('Error seeding chart of accounts:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to add the standard accounts');
    } finally {
      setSeeding(false);
    }
  };

  const openCreateForm = (presetType?: AccountType) => {
    setEditingAccount(null);
    setFormData({ ...EMPTY_FORM, account_type: presetType ?? 'asset' });
    setFormError(null);
    setShowForm(true);
  };

  const openEditForm = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      account_code: account.account_code,
      account_name: account.account_name,
      account_type: account.account_type,
      account_category: account.account_category ?? '',
      parent_account_id: account.parent_account_id ?? '',
      description: account.description ?? '',
    });
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingAccount(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!tenant) {
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
      if (editingAccount) {
        // Editing: code and type are immutable (especially for system accounts),
        // only name/category/parent/description can change.
        const { error } = await supabase
          .from('chart_of_accounts')
          .update({
            account_name: formData.account_name.trim(),
            account_category: formData.account_category.trim() || null,
            parent_account_id: formData.parent_account_id || null,
            description: formData.description.trim() || null,
          })
          .eq('id', editingAccount.id)
          .eq('tenant_id', tenant.id);

        if (error) throw error;
      } else {
        const insert: InsertTables<'chart_of_accounts'> = {
          tenant_id: tenant.id,
          account_code: formData.account_code.trim(),
          account_name: formData.account_name.trim(),
          account_type: formData.account_type,
          account_category: formData.account_category.trim() || null,
          parent_account_id: formData.parent_account_id || null,
          description: formData.description.trim() || null,
          is_active: true,
          allow_manual_entry: true,
          is_system_account: false,
        };

        const { error } = await supabase.from('chart_of_accounts').insert(insert);
        if (error) {
          // Postgres unique_violation
          if ((error as { code?: string }).code === '23505') {
            throw new Error(`Account code "${formData.account_code.trim()}" is already in use.`);
          }
          throw error;
        }
      }

      await loadAccounts();
      closeForm();
    } catch (err) {
      console.error('Error saving account:', err);
      setFormError(err instanceof Error ? err.message : 'Failed to save account');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (account: Account) => {
    if (!tenant) return;
    setTogglingId(account.id);
    try {
      const { error } = await supabase
        .from('chart_of_accounts')
        .update({ is_active: !account.is_active })
        .eq('id', account.id)
        .eq('tenant_id', tenant.id);

      if (error) throw error;
      await loadAccounts();
    } catch (err) {
      console.error('Error toggling account status:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to update account status');
    } finally {
      setTogglingId(null);
    }
  };

  // Candidate parents: same account_type, excluding the account being edited
  // (an account cannot be its own parent). Descendant exclusion is not enforced
  // here (single-level hierarchy assumed, matching the schema).
  const parentCandidates = accounts.filter(
    (a) => a.account_type === formData.account_type && a.id !== editingAccount?.id
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#641f60]">Chart of Accounts</h1>
          <p className="text-slate-600 mt-1">
            Manage your general ledger account structure
          </p>
        </div>
        <button
          onClick={() => openCreateForm()}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all"
        >
          <Plus className="w-5 h-5" />
          Add Account
        </button>
      </div>

      {/* Load error */}
      {loadError && (
        <div className="bg-[#c46040]/10 border border-[#c46040]/30 rounded-xl p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-[#c46040]/15 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-6 h-6 text-[#c46040]" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-[#c46040]">Couldn&rsquo;t load the chart of accounts</h3>
            <p className="text-sm text-slate-600">{loadError}</p>
          </div>
          <button
            onClick={loadAccounts}
            className="px-4 py-2 bg-[#ee7b22] hover:bg-[#c46040] text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by code, name, or category..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
          />
        </div>
      </div>

      {/* Account groups */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#641f60]" />
        </div>
      ) : accounts.length === 0 && !loadError ? (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-12 px-4">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <Calculator className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">No accounts yet</h3>
          <p className="text-slate-500 text-center max-w-sm">
            Journal entries have to post somewhere. Until this chart has accounts, the general
            ledger and trial balance stay empty no matter how much money moves.
          </p>
          <div className="mt-4 flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={seedStandardChart}
              disabled={seeding}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {seeding ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-5 h-5" />
              )}
              Use standard MFI chart
            </button>
            <button
              onClick={() => openCreateForm()}
              className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add manually
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-3 text-center max-w-sm">
            The standard chart covers cash, loans, deposits, income and expenses, following the
            usual code ranges.
          </p>
        </div>
      ) : noSearchResults ? (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-12 px-4">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <Search className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">No matching accounts</h3>
          <p className="text-slate-500 text-center max-w-sm">
            Nothing matches &ldquo;{searchQuery.trim()}&rdquo;. Try a different code, name, or category.
          </p>
          <button
            onClick={() => setSearchQuery('')}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {ACCOUNT_TYPES.map(({ value: type, label, icon }) => {
            const list = groupedByType[type];
            const isCollapsed = collapsedTypes.has(type);
            const colors = TYPE_COLORS[type];
            const typeTotal = list.length;

            if (list.length === 0 && isSearching) return null;

            return (
              <div key={type} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* Header row: not a <button>, so it can safely contain the
                    "Add" and collapse buttons without nesting buttons. */}
                <div className="w-full px-5 py-4 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => toggleTypeCollapsed(type)}
                    aria-expanded={!isCollapsed}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left rounded-lg -mx-1 px-1 py-1 hover:bg-slate-50 transition-colors"
                  >
                    <div className={`p-2 rounded-lg ${colors.bg} ${colors.text}`}>{icon}</div>
                    <h2 className="font-semibold text-slate-900">{label}</h2>
                    <span className="text-xs text-slate-400">
                      {typeTotal} account{typeTotal === 1 ? '' : 's'}
                    </span>
                  </button>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => openCreateForm(type)}
                      className="text-xs font-medium text-[#1ebcb2] hover:text-[#641f60] transition-colors"
                    >
                      + Add
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleTypeCollapsed(type)}
                      aria-label={isCollapsed ? `Expand ${label}` : `Collapse ${label}`}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="border-t border-slate-100 p-4">
                    {list.length === 0 ? (
                      <div className="py-6 text-center text-sm text-slate-400">
                        No {label.toLowerCase()} accounts yet.
                      </div>
                    ) : (
                      /* Cards rather than rows: an account has a code, a name,
                         a category, a parent and a status, and squeezing all
                         of that into one line meant most of it was truncated
                         or dropped. */
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {list.map((account) => {
                          const expected = expectedTypeForCode(account.account_code);
                          const mismatched = expected != null && expected !== account.account_type;
                          return (
                            <div
                              key={account.id}
                              className={`relative rounded-xl border bg-white p-4 transition-all hover:shadow-md ${
                                account.is_active
                                  ? mismatched
                                    ? 'border-[#ee7b22]/40'
                                    : 'border-slate-200 hover:border-slate-300'
                                  : 'border-slate-200 bg-slate-50/60 opacity-70'
                              }`}
                            >
                              {/* A coloured edge keeps the type readable at a
                                  glance when scanning a wall of cards. */}
                              <div
                                className={`absolute left-0 top-4 bottom-4 w-1 rounded-r ${colors.text.replace(
                                  'text-',
                                  'bg-'
                                )}`}
                              />

                              <div className="pl-3">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <span className="font-mono text-sm font-semibold text-slate-700">
                                    {account.account_code}
                                  </span>
                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    {account.is_system_account && (
                                      <span title="System account — code and type are locked">
                                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                                      </span>
                                    )}
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                        account.is_active
                                          ? 'bg-[#1ebcb2]/10 text-[#1ebcb2]'
                                          : 'bg-slate-100 text-slate-500'
                                      }`}
                                    >
                                      {account.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                  </div>
                                </div>

                                <p className="font-semibold text-slate-900 leading-snug mb-1">
                                  {account.account_name}
                                </p>

                                <div className="min-h-[32px] space-y-0.5">
                                  {account.account_category && (
                                    <p className="text-xs text-slate-500 capitalize">
                                      {account.account_category}
                                    </p>
                                  )}
                                  {account.parent_account_id && (
                                    <p className="text-xs text-slate-400 truncate">
                                      Under: {accountName(account.parent_account_id)}
                                    </p>
                                  )}
                                </div>

                                {/* Flagged, not hidden: this chart holds cash
                                    filed as an expense and again as equity,
                                    which is why the trial balance cannot
                                    balance. Naming it is the first step to
                                    fixing it. */}
                                {mismatched && expected && (
                                  <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-[#ee7b22]/10 px-2 py-1.5">
                                    <AlertCircle className="w-3.5 h-3.5 text-[#ee7b22] flex-shrink-0 mt-0.5" />
                                    <p className="text-[11px] text-[#ee7b22] leading-tight">
                                      Code {account.account_code} is normally{' '}
                                      {singularType(expected).toLowerCase()}, but this is filed as{' '}
                                      {singularType(account.account_type).toLowerCase()}.
                                    </p>
                                  </div>
                                )}

                                <div className="mt-3 flex items-center gap-1 border-t border-slate-100 pt-2.5">
                                  <button
                                    type="button"
                                    onClick={() => openEditForm(account)}
                                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-[#641f60] transition-colors"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => toggleActive(account)}
                                    disabled={togglingId === account.id}
                                    className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                                      account.is_active
                                        ? 'text-slate-600 hover:bg-[#c46040]/10 hover:text-[#c46040]'
                                        : 'text-slate-600 hover:bg-[#1ebcb2]/10 hover:text-[#1ebcb2]'
                                    }`}
                                  >
                                    {togglingId === account.id ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : account.is_active ? (
                                      <>
                                        <Ban className="w-3.5 h-3.5" />
                                        Deactivate
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle className="w-3.5 h-3.5" />
                                        Activate
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-[#641f60]">
                {editingAccount ? 'Edit Account' : 'Add New Account'}
              </h2>
              <button
                type="button"
                onClick={closeForm}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {editingAccount?.is_system_account && (
                <div className="p-3 bg-[#641f60]/5 border border-[#641f60]/20 rounded-lg text-sm text-[#641f60] flex items-center gap-2">
                  <Lock className="w-4 h-4 flex-shrink-0" />
                  System account — code and type are locked, but you can update the name, category, and description.
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Account Code *</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingAccount}
                    value={formData.account_code}
                    onChange={(e) => setFormData((prev) => ({ ...prev, account_code: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500"
                    placeholder="1000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Account Type *</label>
                  <select
                    required
                    disabled={!!editingAccount}
                    value={formData.account_type}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        account_type: e.target.value as AccountType,
                        parent_account_id: '',
                      }))
                    }
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500"
                  >
                    {ACCOUNT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {singularType(t.value)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Account Name *</label>
                <input
                  type="text"
                  required
                  value={formData.account_name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, account_name: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  placeholder="Cash on Hand"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <input
                  type="text"
                  value={formData.account_category}
                  onChange={(e) => setFormData((prev) => ({ ...prev, account_category: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  placeholder="cash, bank, receivable, payable..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Parent Account</label>
                <select
                  value={formData.parent_account_id}
                  onChange={(e) => setFormData((prev) => ({ ...prev, parent_account_id: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                >
                  <option value="">None (top-level account)</option>
                  {parentCandidates.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.account_code} · {a.account_name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1">
                  Only accounts of the same type ({ACCOUNT_TYPES.find((t) => t.value === formData.account_type)?.label}) are shown.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  placeholder="Optional notes about this account"
                />
              </div>

              {formError && (
                <div className="p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm">
                  {formError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-4 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      {editingAccount ? 'Save Changes' : 'Create Account'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}