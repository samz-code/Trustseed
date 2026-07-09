import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { SavingsProduct, SavingsAccount, Customer } from '../types';
import type { InsertTables } from '../lib/supabase';
import { formatMoney, currencyFlag } from '../lib/accountCurrencies';
import {
  Plus,
  PiggyBank,
  TrendingUp,
  DollarSign,
  Loader2,
  X,
  AlertCircle,
  RefreshCw,
  ArrowDownCircle,
  ArrowUpCircle,
} from 'lucide-react';

interface SavingsPageProps {
  tab?: 'products' | 'accounts';
}

interface AccountForm {
  customer_id: string;
  product_id: string;
  initial_balance: string;
}

const EMPTY_ACCOUNT_FORM: AccountForm = {
  customer_id: '',
  product_id: '',
  initial_balance: '0',
};

type TxType = 'deposit' | 'withdrawal';

// Savings records may carry their own currency; fall back to the institution
// base currency so nothing is silently assumed to be USD.
type WithCurrency = { currency?: string | null };

export function SavingsPage({ tab = 'products' }: SavingsPageProps) {
  const { tenant, branch } = useAuth();
  const [activeTab, setActiveTab] = useState(tab);
  const [products, setProducts] = useState<SavingsProduct[]>([]);
  const [accounts, setAccounts] = useState<(SavingsAccount & { customer?: Customer })[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<AccountForm>(EMPTY_ACCOUNT_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [txAccount, setTxAccount] = useState<(SavingsAccount & { customer?: Customer }) | null>(null);
  const [txType, setTxType] = useState<TxType>('deposit');
  const [txAmount, setTxAmount] = useState('');
  const [txNotes, setTxNotes] = useState('');
  const [txError, setTxError] = useState<string | null>(null);
  const [txSubmitting, setTxSubmitting] = useState(false);

  const baseCurrency =
    (tenant?.settings as { base_currency?: string; default_currency?: string } | undefined)?.base_currency ??
    tenant?.settings?.default_currency ??
    'KES';

  const currencyOf = useCallback(
    (record: WithCurrency | null | undefined): string => record?.currency || baseCurrency,
    [baseCurrency]
  );

  const loadData = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [productsRes, accountsRes, customersRes] = await Promise.all([
        supabase.from('savings_products').select('*').eq('tenant_id', tenant.id),
        supabase
          .from('savings_accounts')
          .select('*, customer:customers(*)')
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('customers')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('status', 'active')
          .order('first_name', { ascending: true }),
      ]);

      if (productsRes.error) throw productsRes.error;
      if (accountsRes.error) throw accountsRes.error;
      if (customersRes.error) throw customersRes.error;

      setProducts(((productsRes.data as unknown) as SavingsProduct[]) ?? []);
      setAccounts(((accountsRes.data as unknown) as Array<SavingsAccount & { customer?: Customer }>) ?? []);
      setCustomers(((customersRes.data as unknown) as Customer[]) ?? []);
    } catch (err) {
      console.error('Error loading savings data:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load savings data');
      setProducts([]);
      setAccounts([]);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    loadData();
  }, [loadData, branch]);

  // Totals are grouped by currency so mixed-currency portfolios aren't summed
  // into a meaningless single figure.
  const totalsByCurrency = useMemo(() => {
    const map = new Map<string, number>();
    accounts.forEach((a) => {
      const code = currencyOf(a as WithCurrency);
      map.set(code, (map.get(code) ?? 0) + (a.balance || 0));
    });
    return Array.from(map.entries())
      .map(([code, total]) => ({ code, total }))
      .sort((a, b) => b.total - a.total);
  }, [accounts, currencyOf]);

  const activeProducts = products.filter((p) => p.status === 'active');

  const openTransactionModal = (account: SavingsAccount & { customer?: Customer }, type: TxType) => {
    setTxAccount(account);
    setTxType(type);
    setTxAmount('');
    setTxNotes('');
    setTxError(null);
  };

  const closeTransactionModal = () => {
    setTxAccount(null);
    setTxAmount('');
    setTxNotes('');
    setTxError(null);
  };

  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxError(null);

    if (!txAccount) return;
    const amount = parseFloat(txAmount);
    if (!txAmount || Number.isNaN(amount) || amount <= 0) {
      setTxError('Enter a valid amount greater than zero.');
      return;
    }

    setTxSubmitting(true);
    try {
      const { error } = await (supabase.rpc as any)('process_savings_transaction', {
        p_account_id: txAccount.id,
        p_type: txType,
        p_amount: amount,
        p_notes: txNotes.trim() || null,
      });
      if (error) throw error;

      await loadData();
      closeTransactionModal();
    } catch (err) {
      console.error('Error processing savings transaction:', err);
      setTxError(err instanceof Error ? err.message : `Failed to process ${txType}`);
    } finally {
      setTxSubmitting(false);
    }
  };

  const openCreateAccountForm = () => {
    setFormData(EMPTY_ACCOUNT_FORM);
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setFormData(EMPTY_ACCOUNT_FORM);
    setFormError(null);
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!tenant) {
      setFormError('No institution context found. Please sign in again.');
      return;
    }
    if (!formData.customer_id) {
      setFormError('Please select a customer.');
      return;
    }
    if (!formData.product_id) {
      setFormError('Please select a savings product.');
      return;
    }

    const product = products.find((p) => p.id === formData.product_id);
    const initialBalance = parseFloat(formData.initial_balance) || 0;

    if (product && initialBalance < product.min_opening_balance) {
      setFormError(
        `Initial balance must be at least ${formatMoney(
          product.min_opening_balance,
          currencyOf(product as WithCurrency)
        )} for this product.`
      );
      return;
    }

    setSubmitting(true);
    try {
      const insert: InsertTables<'savings_accounts'> = {
        tenant_id: tenant.id,
        branch_id: branch?.id ?? null,
        customer_id: formData.customer_id,
        product_id: formData.product_id,
        balance: initialBalance,
        available_balance: initialBalance,
        status: 'active',
      };

      const { error } = await supabase.from('savings_accounts').insert(insert);
      if (error) throw error;

      await loadData();
      closeForm();
    } catch (err) {
      console.error('Error creating savings account:', err);
      setFormError(err instanceof Error ? err.message : 'Failed to create savings account');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedProduct = products.find((p) => p.id === formData.product_id);
  const formCurrency = currencyOf(selectedProduct as WithCurrency);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#641f60]">Savings Management</h1>
          <p className="text-slate-600 mt-1">Manage savings products and accounts</p>
        </div>
        {activeTab === 'accounts' && (
          <button
            onClick={openCreateAccountForm}
            className="px-4 py-2.5 bg-gradient-to-r from-[#1ebcb2] to-[#7eccc6] text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all"
          >
            <Plus className="w-5 h-5 inline mr-2" />
            Create Account
          </button>
        )}
      </div>

      {loadError && (
        <div className="bg-[#c46040]/10 border border-[#c46040]/30 rounded-xl p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-[#c46040]/15 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-6 h-6 text-[#c46040]" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-[#c46040]">Couldn&rsquo;t load savings data</h3>
            <p className="text-sm text-slate-600">{loadError}</p>
          </div>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-[#ee7b22] hover:bg-[#c46040] text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-[#dae1e1] p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[#1ebcb2]/10">
              <PiggyBank className="w-6 h-6 text-[#1ebcb2]" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Products</p>
              <p className="text-2xl font-bold text-slate-900">{products.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[#dae1e1] p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[#641f60]/10">
              <TrendingUp className="w-6 h-6 text-[#641f60]" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Active Accounts</p>
              <p className="text-2xl font-bold text-slate-900">
                {accounts.filter((a) => a.status === 'active').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[#dae1e1] p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[#ee7b22]/10">
              <DollarSign className="w-6 h-6 text-[#ee7b22]" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-slate-500">Total Savings</p>
              {totalsByCurrency.length === 0 ? (
                <p className="text-2xl font-bold text-slate-900">
                  {currencyFlag(baseCurrency)} {formatMoney(0, baseCurrency)}
                </p>
              ) : totalsByCurrency.length === 1 ? (
                <p className="text-2xl font-bold text-slate-900 break-words">
                  {currencyFlag(totalsByCurrency[0].code)} {formatMoney(totalsByCurrency[0].total, totalsByCurrency[0].code)}
                </p>
              ) : (
                <div className="space-y-0.5">
                  {totalsByCurrency.map(({ code, total }) => (
                    <p key={code} className="text-base font-bold text-slate-900 break-words">
                      {currencyFlag(code)} {formatMoney(total, code)}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-[#dae1e1] p-2">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('products')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'products'
                ? 'bg-gradient-to-r from-[#1ebcb2] to-[#7eccc6] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <PiggyBank className="w-4 h-4" />
            Products
          </button>
          <button
            onClick={() => setActiveTab('accounts')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'accounts'
                ? 'bg-gradient-to-r from-[#1ebcb2] to-[#7eccc6] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Accounts
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border border-[#dae1e1] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#1ebcb2]" />
          </div>
        ) : (
          <>
            {activeTab === 'products' && (
              <div className="divide-y divide-[#dae1e1]">
                {products.length > 0 ? (
                  products.map((product) => {
                    const code = currencyOf(product as WithCurrency);
                    return (
                      <div key={product.id} className="p-6 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                              {product.name}
                              <span className="text-xs font-medium text-slate-400 inline-flex items-center gap-1">
                                <span aria-hidden>{currencyFlag(code)}</span>
                                {code}
                              </span>
                            </h3>
                            <p className="text-sm text-slate-500">{product.code}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-lg font-bold text-[#1ebcb2]">{product.interest_rate}% p.a.</p>
                            <p className="text-sm text-slate-500">Min: {formatMoney(product.min_balance, code)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center">
                    <PiggyBank className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">No savings products yet</p>
                    <p className="text-sm text-slate-400 mt-1">
                      Add products from the Savings Products page in the sidebar.
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'accounts' && (
              <div className="divide-y divide-[#dae1e1]">
                {accounts.length > 0 ? (
                  accounts.map((account) => {
                    const code = currencyOf(account as WithCurrency);
                    return (
                      <div key={account.id} className="p-6 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="w-12 h-12 rounded-full bg-[#1ebcb2]/10 flex items-center justify-center shrink-0">
                              <DollarSign className="w-6 h-6 text-[#1ebcb2]" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-semibold text-slate-900 truncate">
                                {account.customer?.first_name} {account.customer?.last_name}
                              </h3>
                              <p className="text-sm text-slate-500">{account.account_number}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 shrink-0">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                                account.status === 'active'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {account.status}
                            </span>
                            <div className="text-right">
                              <p className="text-lg font-bold text-slate-900 whitespace-nowrap">
                                {currencyFlag(code)} {formatMoney(account.balance || 0, code)}
                              </p>
                            </div>
                            <button
                              onClick={() => openTransactionModal(account, 'deposit')}
                              className="p-2 rounded-lg text-slate-400 hover:text-[#1ebcb2] hover:bg-slate-100 transition-colors"
                              aria-label="Deposit"
                              title="Deposit"
                            >
                              <ArrowDownCircle className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => openTransactionModal(account, 'withdrawal')}
                              className="p-2 rounded-lg text-slate-400 hover:text-[#ee7b22] hover:bg-slate-100 transition-colors"
                              aria-label="Withdraw"
                              title="Withdraw"
                            >
                              <ArrowUpCircle className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center">
                    <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">No savings accounts yet</p>
                    {activeProducts.length === 0 && (
                      <p className="text-sm text-slate-400 mt-1">
                        Create an active savings product first before opening accounts.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Account modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#641f60]">Create Savings Account</h2>
              <button
                onClick={closeForm}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Customer *</label>
                <select
                  required
                  value={formData.customer_id}
                  onChange={(e) => setFormData((prev) => ({ ...prev, customer_id: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                >
                  <option value="">Select customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.business_name || `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim()} ({c.phone})
                    </option>
                  ))}
                </select>
                {customers.length === 0 && (
                  <p className="text-xs text-slate-400 mt-1">No active customers found for this branch.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Savings Product *</label>
                <select
                  required
                  value={formData.product_id}
                  onChange={(e) => setFormData((prev) => ({ ...prev, product_id: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                >
                  <option value="">Select product</option>
                  {activeProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {currencyFlag(currencyOf(p as WithCurrency))} {p.name} ({p.interest_rate}% p.a.)
                    </option>
                  ))}
                </select>
                {activeProducts.length === 0 && (
                  <p className="text-xs text-slate-400 mt-1">
                    No active savings products yet - create one from the Savings Products page first.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Initial Balance{' '}
                  <span className="text-slate-400 font-normal">
                    ({currencyFlag(formCurrency)} {formCurrency})
                  </span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.initial_balance}
                  onChange={(e) => setFormData((prev) => ({ ...prev, initial_balance: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
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
                  disabled={submitting || activeProducts.length === 0 || customers.length === 0}
                  className="px-6 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      Create Account
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deposit / Withdraw modal */}
      {txAccount && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#641f60]">
                {txType === 'deposit' ? 'Deposit to' : 'Withdraw from'}{' '}
                {txAccount.customer?.first_name} {txAccount.customer?.last_name}
              </h2>
              <button
                onClick={closeTransactionModal}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTransaction} className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600 flex items-center justify-between">
                <span>Current balance</span>
                <span className="font-semibold text-slate-900">
                  {currencyFlag(currencyOf(txAccount as WithCurrency))}{' '}
                  {formatMoney(txAccount.balance || 0, currencyOf(txAccount as WithCurrency))}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTxType('deposit')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-all ${
                    txType === 'deposit'
                      ? 'bg-[#1ebcb2] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <ArrowDownCircle className="w-4 h-4" />
                  Deposit
                </button>
                <button
                  type="button"
                  onClick={() => setTxType('withdrawal')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-all ${
                    txType === 'withdrawal'
                      ? 'bg-[#ee7b22] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <ArrowUpCircle className="w-4 h-4" />
                  Withdraw
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Amount{' '}
                  <span className="text-slate-400 font-normal">
                    ({currencyFlag(currencyOf(txAccount as WithCurrency))} {currencyOf(txAccount as WithCurrency)})
                  </span>{' '}
                  *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  autoFocus
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={txNotes}
                  onChange={(e) => setTxNotes(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  placeholder="Optional"
                />
              </div>

              {txType === 'withdrawal' && (
                <p className="text-xs text-slate-400">
                  Withdrawal fees, minimum balance, and fixed-deposit maturity rules are
                  enforced automatically based on this account&rsquo;s savings product.
                </p>
              )}

              {txError && (
                <div className="p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm">
                  {txError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeTransactionModal}
                  className="px-4 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={txSubmitting}
                  className={`px-6 py-2.5 text-white font-medium rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all ${
                    txType === 'deposit'
                      ? 'bg-[#1ebcb2] hover:bg-[#159089]'
                      : 'bg-[#ee7b22] hover:bg-[#c46040]'
                  }`}
                >
                  {txSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      {txType === 'deposit' ? (
                        <ArrowDownCircle className="w-5 h-5" />
                      ) : (
                        <ArrowUpCircle className="w-5 h-5" />
                      )}
                      Confirm {txType === 'deposit' ? 'Deposit' : 'Withdrawal'}
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