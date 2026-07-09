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

  const validateForm = (): string | null => {
    if (!formData.account_code.trim()) return 'Account code is required.';
    if (!formData.account_name.trim()) return 'Account name is required.';
    if (!editingAccount) {
      // duplicate-code guard is also enforced by the DB unique constraint,
      // but checking client-side gives an immediate, friendlier message
      const codeExists = accounts.some(
        (a) => a.account_code.trim().toLowerCase() === formData.account_code.trim().toLowerCase()
      );
      if (codeExists) return `Account code "${formData.account_code.trim()}" is already in use.`;
    }
    return null;
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
            Start building your chart of accounts by adding your first account.
          </p>
          <button
            onClick={() => openCreateForm()}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add First Account
          </button>
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
                  <div className="divide-y divide-slate-100 border-t border-slate-100">
                    {list.length === 0 ? (
                      <div className="px-5 py-6 text-center text-sm text-slate-400">
                        No {label.toLowerCase()} accounts yet.
                      </div>
                    ) : (
                      list.map((account) => (
                        <div
                          key={account.id}
                          className={`px-5 py-3.5 flex items-center gap-4 hover:bg-slate-50 transition-colors ${
                            !account.is_active ? 'opacity-60' : ''
                          }`}
                        >
                          <div className="w-20 flex-shrink-0">
                            <span className="text-sm font-mono font-medium text-slate-700">
                              {account.account_code}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-slate-900 truncate">
                                {account.account_name}
                              </p>
                              {account.is_system_account && (
                                <span title="System account — code and type are locked">
                                  <Lock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                </span>
                              )}
                            </div>
                            {account.account_category && (
                              <p className="text-xs text-slate-500">{account.account_category}</p>
                            )}
                            {account.parent_account_id && (
                              <p className="text-xs text-slate-400">
                                Under: {accountName(account.parent_account_id)}
                              </p>
                            )}
                          </div>
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                              account.is_active
                                ? 'bg-[#1ebcb2]/10 text-[#1ebcb2]'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {account.is_active ? 'Active' : 'Inactive'}
                          </span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => openEditForm(account)}
                              className="p-2 rounded-lg text-slate-400 hover:text-[#641f60] hover:bg-slate-100 transition-colors"
                              aria-label="Edit account"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleActive(account)}
                              disabled={togglingId === account.id}
                              className="p-2 rounded-lg text-slate-400 hover:text-[#c46040] hover:bg-slate-100 transition-colors disabled:opacity-50"
                              aria-label={account.is_active ? 'Deactivate account' : 'Activate account'}
                            >
                              {togglingId === account.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : account.is_active ? (
                                <Ban className="w-4 h-4" />
                              ) : (
                                <CheckCircle className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      ))
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