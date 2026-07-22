import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { SavingsProduct, SavingsAccount, Customer } from '../types';
import type { InsertTables } from '../lib/supabase';
import { formatMoney, currencyFlag } from '../lib/accountCurrencies';
import { ReceiptModal, buildReceiptData, type ReceiptData } from './TransactionReceipt';
import {
  Plus,
  PiggyBank,
  DollarSign,
  Loader2,
  X,
  AlertCircle,
  RefreshCw,
  ArrowDownCircle,
  ArrowUpCircle,
  Search,
  Wallet,
  Users,
  Percent,
  Lock,
  Landmark,
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

function customerName(c: Customer | undefined | null): string {
  if (!c) return 'Unknown customer';
  if (c.customer_type !== 'individual') return c.business_name || 'Unnamed business';
  return `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unnamed';
}

export function SavingsPage({ tab = 'products' }: SavingsPageProps) {
  const { tenant, branch, admin } = useAuth();
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

  // Receipt shown after a deposit or withdrawal. A customer paying into their
  // savings deserves the same proof as one sending a transfer.
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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

  // ------------------------------------------------------------------
  // Deposit book summary.
  //
  // Savings are a liability: this is money the SACCO owes its members, not
  // money it owns. The figures below say how much is held, how it is spread
  // across members, and how much of it is actually withdrawable today.
  // ------------------------------------------------------------------
  const book = useMemo(() => {
    const live = accounts.filter((a) => a.status === 'active');
    const totalBalance = live.reduce((sum, a) => sum + Number(a.balance ?? 0), 0);
    const available = live.reduce(
      (sum, a) => sum + Number((a as { available_balance?: number }).available_balance ?? a.balance ?? 0),
      0
    );
    const held = live.reduce(
      (sum, a) => sum + Number((a as { held_balance?: number }).held_balance ?? 0),
      0
    );
    const accrued = live.reduce(
      (sum, a) => sum + Number((a as { accrued_interest?: number }).accrued_interest ?? 0),
      0
    );

    // Average tells a board whether the book is many small savers or a few
    // large ones, which changes how a liquidity shock would land.
    const average = live.length > 0 ? totalBalance / live.length : 0;

    return {
      accountCount: live.length,
      totalBalance,
      available,
      held,
      accrued,
      average,
      dormant: accounts.length - live.length,
    };
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q === '') return accounts;
    return accounts.filter((a) => {
      const name = customerName(a.customer);
      return (
        name.toLowerCase().includes(q) ||
        (a.account_number || '').toLowerCase().includes(q)
      );
    });
  }, [accounts, searchQuery]);

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

      // Capture what is needed for the receipt before the modal state is
      // cleared below, and re-read the account so the printed balance is the
      // one the database now holds rather than the stale figure on screen.
      const account = txAccount;
      const opType = txType;
      const { data: refreshed } = await supabase
        .from('savings_accounts')
        .select('balance')
        .eq('id', account.id)
        .maybeSingle();

      await loadData();
      closeTransactionModal();

      if (tenant) {
        const customer = customers.find((c) => c.id === account.customer_id);
        const currency = currencyOf(account as WithCurrency);
        setReceiptData(
          buildReceiptData({
            institutionName: tenant.name,
            institutionLogoUrl:
              (tenant.settings as { branding?: { logo_url?: string | null } } | null)?.branding
                ?.logo_url ?? null,
            branchName: branch?.name ?? null,
            transactionId: account.id,
            reference: account.account_number,
            transactionType: opType === 'deposit' ? 'savings_deposit' : 'savings_withdrawal',
            status: 'completed',
            createdAtIso: new Date().toISOString(),
            customerName: customerName(customer),
            customerAccountNumber: account.account_number,
            amount,
            currency,
            remainingWalletBalance:
              refreshed?.balance !== undefined ? Number(refreshed.balance) : null,
            remainingWalletCurrency: currency,
            cashierName: admin?.full_name ?? null,
          })
        );
      }
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

      {/* ================================================================
          Deposit book. Savings are money the SACCO owes its members, so
          these read as a liability position rather than as revenue.
          ================================================================ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="group bg-white rounded-xl border border-[#dae1e1] p-5 transition-all duration-200 hover:shadow-lg hover:shadow-slate-200/60 hover:-translate-y-0.5 hover:border-[#1ebcb2]/40">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-[#1ebcb2]/10 flex items-center justify-center transition-colors group-hover:bg-[#1ebcb2]/20">
              <Landmark className="w-5 h-5 text-[#1ebcb2]" />
            </div>
            <span className="text-xs text-slate-400">{book.accountCount} accounts</span>
          </div>
          <p className="text-xs font-medium text-slate-500 mb-1">Total deposits held</p>
          {totalsByCurrency.length === 0 ? (
            <p className="text-2xl font-bold text-[#159089] tabular-nums">
              {formatMoney(0, baseCurrency)}
            </p>
          ) : totalsByCurrency.length === 1 ? (
            <p className="text-2xl font-bold text-[#159089] tabular-nums break-words">
              {formatMoney(totalsByCurrency[0].total, totalsByCurrency[0].code)}
            </p>
          ) : (
            /* Multi-currency books are never summed into one figure: adding
               KES to USD produces a number that means nothing. */
            <div className="space-y-0.5">
              {totalsByCurrency.map(({ code, total }) => (
                <p key={code} className="text-base font-bold text-[#159089] tabular-nums break-words">
                  <span aria-hidden className="mr-1">{currencyFlag(code)}</span>
                  {formatMoney(total, code)}
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="group bg-white rounded-xl border border-[#dae1e1] p-5 transition-all duration-200 hover:shadow-lg hover:shadow-slate-200/60 hover:-translate-y-0.5 hover:border-[#641f60]/30">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-[#641f60]/10 flex items-center justify-center transition-colors group-hover:bg-[#641f60]/15">
              <Users className="w-5 h-5 text-[#641f60]" />
            </div>
            {book.dormant > 0 && (
              <span className="text-xs text-slate-400">{book.dormant} inactive</span>
            )}
          </div>
          <p className="text-xs font-medium text-slate-500 mb-1">Average balance</p>
          <p className="text-2xl font-bold text-[#641f60] tabular-nums">
            {formatMoney(book.average, baseCurrency)}
          </p>
        </div>

        <div className="group bg-white rounded-xl border border-[#dae1e1] p-5 transition-all duration-200 hover:shadow-lg hover:shadow-slate-200/60 hover:-translate-y-0.5 hover:border-[#ee7b22]/40">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-[#ee7b22]/10 flex items-center justify-center transition-colors group-hover:bg-[#ee7b22]/20">
              <Lock className="w-5 h-5 text-[#ee7b22]" />
            </div>
          </div>
          <p className="text-xs font-medium text-slate-500 mb-1">Held / not withdrawable</p>
          <p className="text-2xl font-bold text-[#ee7b22] tabular-nums">
            {formatMoney(book.held, baseCurrency)}
          </p>
        </div>

        <div className="group bg-white rounded-xl border border-[#dae1e1] p-5 transition-all duration-200 hover:shadow-lg hover:shadow-slate-200/60 hover:-translate-y-0.5 hover:border-[#c46040]/40">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-[#c46040]/10 flex items-center justify-center transition-colors group-hover:bg-[#c46040]/20">
              <Percent className="w-5 h-5 text-[#c46040]" />
            </div>
            <span className="text-xs text-slate-400">{products.length} products</span>
          </div>
          <p className="text-xs font-medium text-slate-500 mb-1">Interest accrued</p>
          <p className="text-2xl font-bold text-[#c46040] tabular-nums">
            {formatMoney(book.accrued, baseCurrency)}
          </p>
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
              <div className="p-4">
                {products.length > 0 ? (
                  <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {products.map((product) => {
                      const code = currencyOf(product as WithCurrency);
                      const isActive = product.status === 'active';
                      return (
                        <div
                          key={product.id}
                          className={`group rounded-xl border p-5 transition-all duration-200 ${
                            isActive
                              ? 'border-[#dae1e1] hover:border-[#1ebcb2]/50 hover:shadow-lg hover:shadow-slate-200/50 hover:-translate-y-0.5'
                              : 'border-[#dae1e1] bg-slate-50/60'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3 mb-4">
                            <div className="min-w-0">
                              <h3 className="font-semibold text-slate-900 truncate">
                                {product.name}
                              </h3>
                              <p className="text-xs text-slate-400 font-mono mt-0.5">
                                {product.code}
                              </p>
                            </div>
                            <span className="text-xs font-medium text-slate-400 inline-flex items-center gap-1 flex-shrink-0">
                              <span aria-hidden>{currencyFlag(code)}</span>
                              {code}
                            </span>
                          </div>

                          {/* The rate is the number a member compares between
                              products, so it gets the weight on the card. */}
                          <div className="flex items-end justify-between gap-3 pt-3 border-t border-slate-100">
                            <div>
                              <p className="text-[11px] font-medium text-slate-400 mb-0.5">
                                Interest rate
                              </p>
                              <p className="text-xl font-bold text-[#1ebcb2] tabular-nums">
                                {product.interest_rate}
                                <span className="text-sm font-semibold text-slate-400 ml-0.5">
                                  % p.a.
                                </span>
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-[11px] font-medium text-slate-400 mb-0.5">
                                Minimum balance
                              </p>
                              <p className="text-sm font-semibold text-slate-700 tabular-nums">
                                {formatMoney(product.min_balance, code)}
                              </p>
                            </div>
                          </div>

                          {!isActive && (
                            <p className="mt-3 text-[11px] text-slate-400">
                              Inactive. New accounts cannot be opened on this product.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-16 text-center">
                    <div className="w-14 h-14 rounded-full bg-[#1ebcb2]/5 flex items-center justify-center mx-auto mb-3">
                      <PiggyBank className="w-7 h-7 text-[#1ebcb2]/40" />
                    </div>
                    <p className="font-medium text-slate-600">No savings products yet</p>
                    <p className="text-sm text-slate-400 mt-1">
                      Add products from the Savings Products page in the sidebar.
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'accounts' && (
              <div className="p-4 space-y-4">
                {accounts.length > 0 && (
                  <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search member or account number..."
                      className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent transition-shadow"
                    />
                  </div>
                )}

                {filteredAccounts.length > 0 ? (
                  <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredAccounts.map((account) => {
                      const code = currencyOf(account as WithCurrency);
                      const balance = Number(account.balance ?? 0);
                      const held = Number(
                        (account as { held_balance?: number }).held_balance ?? 0
                      );
                      const available = Number(
                        (account as { available_balance?: number }).available_balance ?? balance
                      );
                      const isActive = account.status === 'active';

                      return (
                        <div
                          key={account.id}
                          className={`group rounded-xl border p-5 transition-all duration-200 ${
                            isActive
                              ? 'border-[#dae1e1] hover:border-[#641f60]/40 hover:shadow-lg hover:shadow-slate-200/50 hover:-translate-y-0.5'
                              : 'border-[#dae1e1] bg-slate-50/60'
                          }`}
                        >
                          <div className="flex items-start gap-3 mb-4">
                            <div
                              className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                                isActive
                                  ? 'bg-[#1ebcb2]/10 group-hover:bg-[#1ebcb2]/20'
                                  : 'bg-slate-200/70'
                              }`}
                            >
                              <Wallet
                                className={`w-5 h-5 ${isActive ? 'text-[#1ebcb2]' : 'text-slate-400'}`}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="font-semibold text-slate-900 text-sm truncate">
                                {customerName(account.customer)}
                              </h3>
                              <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">
                                {account.account_number}
                              </p>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-medium capitalize flex-shrink-0 ${
                                isActive
                                  ? 'bg-[#1ebcb2]/10 text-[#159089]'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {account.status}
                            </span>
                          </div>

                          <div className="mb-4">
                            <p className="text-[11px] font-medium text-slate-400 mb-0.5">
                              <span aria-hidden className="mr-1">{currencyFlag(code)}</span>
                              Balance
                            </p>
                            <p className="text-2xl font-bold text-slate-900 tabular-nums">
                              {formatMoney(balance, code)}
                            </p>
                            {/* Only shown when some of the balance is locked.
                                A member asking why they cannot withdraw their
                                full balance is asking about this line. */}
                            {held > 0 && (
                              <p className="text-[11px] text-[#ee7b22] mt-1 tabular-nums">
                                {formatMoney(available, code)} available &middot;{' '}
                                {formatMoney(held, code)} held
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                            <button
                              onClick={() => openTransactionModal(account, 'deposit')}
                              disabled={!isActive}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#1ebcb2] hover:bg-[#159089] text-white text-xs font-semibold rounded-lg transition-all duration-200 hover:shadow-md hover:shadow-[#1ebcb2]/25 active:scale-[0.97] disabled:opacity-40 disabled:hover:shadow-none disabled:active:scale-100"
                            >
                              <ArrowDownCircle className="w-3.5 h-3.5" />
                              Deposit
                            </button>
                            <button
                              onClick={() => openTransactionModal(account, 'withdrawal')}
                              disabled={!isActive || available <= 0}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-[#ee7b22] text-[#ee7b22] hover:bg-[#ee7b22] hover:text-white text-xs font-semibold rounded-lg transition-all duration-200 active:scale-[0.97] disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#ee7b22] disabled:active:scale-100"
                            >
                              <ArrowUpCircle className="w-3.5 h-3.5" />
                              Withdraw
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : accounts.length > 0 ? (
                  <div className="py-14 text-center">
                    <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm text-slate-500">No accounts match your search.</p>
                  </div>
                ) : (
                  <div className="py-16 text-center">
                    <div className="w-14 h-14 rounded-full bg-[#641f60]/5 flex items-center justify-center mx-auto mb-3">
                      <Wallet className="w-7 h-7 text-[#641f60]/40" />
                    </div>
                    <p className="font-medium text-slate-600">No savings accounts yet</p>
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 max-w-md w-full">
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 max-w-md w-full">
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

      {/* Receipt — printed from what the database recorded, including the
          balance after the movement rather than the figure on screen before. */}
      {receiptData && (
        <ReceiptModal data={receiptData} onClose={() => setReceiptData(null)} />
      )}
    </div>
  );
}