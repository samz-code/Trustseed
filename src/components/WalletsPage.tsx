import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { InsertTables } from '../lib/supabase';
import type { Wallet, Customer } from '../types';
import { useCurrency } from '../lib/currency';
import {
  Plus,
  Search,
  Wallet as WalletIcon,
  TrendingUp,
  Banknote,
  Smartphone,
  Landmark,
  CreditCard,
  Coins,
  Eye,
  X,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Ban,
  Phone,
  User,
  Building,
} from 'lucide-react';

type WalletWithCustomer = Wallet & { customer?: Customer | null };

interface WalletForm {
  customer_id: string;
  wallet_type: string;
  currency: string;
}

const EMPTY_FORM: WalletForm = {
  customer_id: '',
  wallet_type: 'cash',
  currency: 'KES',
};

const WALLET_TYPES: { value: string; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank Account' },
  { value: 'mpesa', label: 'M-Pesa' },
  { value: 'mtn_momo', label: 'MTN Mobile Money' },
  { value: 'digital', label: 'Digital Wallet' },
];

function walletTypeIcon(type: string) {
  switch (type) {
    case 'mpesa':
    case 'mtn_momo':
      return <Smartphone className="w-6 h-6" />;
    case 'bank':
      return <Landmark className="w-6 h-6" />;
    case 'digital':
      return <CreditCard className="w-6 h-6" />;
    case 'cash':
      return <Banknote className="w-6 h-6" />;
    default:
      return <Coins className="w-6 h-6" />;
  }
}

function customerName(c: Customer | undefined | null): string {
  if (!c) return 'Unknown customer';
  if (c.customer_type !== 'individual') return c.business_name || 'Unnamed business';
  return `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unnamed';
}

export function WalletsPage() {
  const { tenant, branch } = useAuth();
  const { format, enabledCurrencies, defaultCurrency } = useCurrency();

  const [wallets, setWallets] = useState<WalletWithCustomer[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<WalletForm>(EMPTY_FORM);

  const [detailWallet, setDetailWallet] = useState<WalletWithCustomer | null>(null);

  // Currency options: the tenant's enabled currencies, falling back to a sane
  // multi-currency list so the dropdown is never empty.
  const currencyOptions = useMemo(() => {
    const base = enabledCurrencies.length > 0 ? enabledCurrencies : [defaultCurrency];
    return Array.from(new Set([...base, 'KES', 'USD', 'SSP', 'EUR', 'GBP', 'UGX']));
  }, [enabledCurrencies, defaultCurrency]);

  const loadData = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    setLoadError(null);
    try {
      let walletsQuery = supabase
        .from('wallets')
        .select('*, customer:customers(*)')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });
      if (branch) walletsQuery = walletsQuery.eq('branch_id', branch.id);

      let customersQuery = supabase
        .from('customers')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('status', 'active');
      if (branch) customersQuery = customersQuery.eq('branch_id', branch.id);

      const [walletsRes, customersRes] = await Promise.all([walletsQuery, customersQuery]);
      if (walletsRes.error) throw walletsRes.error;
      if (customersRes.error) throw customersRes.error;

      setWallets((walletsRes.data ?? []) as unknown as WalletWithCustomer[]);
      setCustomers((customersRes.data ?? []) as Customer[]);
    } catch (err) {
      console.error('Error loading wallets:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load wallets');
      setWallets([]);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [tenant, branch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredWallets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q === '') return wallets;
    return wallets.filter((w) => {
      const c = w.customer;
      return (
        c?.first_name?.toLowerCase().includes(q) ||
        c?.last_name?.toLowerCase().includes(q) ||
        c?.business_name?.toLowerCase().includes(q) ||
        w.account_number?.toLowerCase().includes(q) ||
        w.currency.toLowerCase().includes(q) ||
        w.wallet_type.toLowerCase().includes(q)
      );
    });
  }, [wallets, searchQuery]);

  // Totals grouped by currency, since summing mixed currencies is meaningless.
  const totalsByCurrency = useMemo(() => {
    const map = new Map<string, { balance: number; available: number; held: number }>();
    for (const w of wallets) {
      const cur = w.currency || defaultCurrency;
      const entry = map.get(cur) ?? { balance: 0, available: 0, held: 0 };
      entry.balance += w.balance || 0;
      entry.available += w.available_balance || 0;
      entry.held += w.held_balance || 0;
      map.set(cur, entry);
    }
    return Array.from(map.entries());
  }, [wallets, defaultCurrency]);

  const validateForm = (): string | null => {
    if (!formData.customer_id) return 'Please select a customer.';
    if (!formData.wallet_type) return 'Please select a wallet type.';
    if (!formData.currency) return 'Please select a currency.';
    return null;
  };

  const openForm = () => {
    setFormData({ ...EMPTY_FORM, currency: defaultCurrency });
    setError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setFormData(EMPTY_FORM);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!tenant) {
      setError('No institution context found. Please sign in again.');
      return;
    }
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      // Insert only typed fields; balances default to 0 at the database level.
      // Opening balances should arrive via a deposit transaction, not a raw
      // wallet insert, so the ledger stays the source of truth.
      const insert: InsertTables<'wallets'> = {
        tenant_id: tenant.id,
        branch_id: branch?.id ?? null,
        customer_id: formData.customer_id,
        wallet_type: formData.wallet_type,
        currency: formData.currency,
        status: 'active',
      };

      const { error: insertError } = await supabase.from('wallets').insert(insert);
      if (insertError) throw insertError;

      await loadData();
      closeForm();
    } catch (err) {
      console.error('Error creating wallet:', err);
      setError(err instanceof Error ? err.message : 'Failed to create wallet');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { cls: string; icon: React.ReactNode }> = {
      active: { cls: 'bg-[#1ebcb2]/10 text-[#1ebcb2]', icon: <CheckCircle className="w-3.5 h-3.5" /> },
      frozen: { cls: 'bg-[#ee7b22]/10 text-[#ee7b22]', icon: <AlertCircle className="w-3.5 h-3.5" /> },
      closed: { cls: 'bg-slate-100 text-slate-600', icon: <Ban className="w-3.5 h-3.5" /> },
    };
    const s = map[status] || map.active;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium capitalize ${s.cls}`}>
        {s.icon}
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#641f60]">Wallets</h1>
          <p className="text-slate-600 mt-1">Manage customer wallet accounts and balances</p>
        </div>
        <button
          onClick={openForm}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all"
        >
          <Plus className="w-5 h-5" />
          Create Wallet
        </button>
      </div>

      {loadError && (
        <div className="bg-[#c46040]/10 border border-[#c46040]/30 rounded-xl p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-[#c46040]/15 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-6 h-6 text-[#c46040]" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-[#c46040]">Couldn&rsquo;t load wallets</h3>
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

      {/* Totals by currency */}
      {totalsByCurrency.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {totalsByCurrency.map(([currency, totals]) => (
            <div key={currency} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 rounded-lg bg-[#641f60]/10">
                  <TrendingUp className="w-6 h-6 text-[#641f60]" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Total Balance ({currency})</p>
                  <p className="text-2xl font-bold text-slate-900">{format(totals.balance, currency)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm text-slate-500 pt-3 border-t border-slate-100">
                <span>Available: <span className="text-slate-700 font-medium">{format(totals.available, currency)}</span></span>
                <span>Held: <span className="text-slate-700 font-medium">{format(totals.held, currency)}</span></span>
              </div>
            </div>
          ))}
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
            placeholder="Search by customer, account number, currency, or type..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
          />
        </div>
      </div>

      {/* Wallet list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#641f60]" />
          </div>
        ) : filteredWallets.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filteredWallets.map((wallet) => (
              <div key={wallet.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#641f60] to-[#4a1646] flex items-center justify-center text-white flex-shrink-0">
                    {walletTypeIcon(wallet.wallet_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-900 truncate">
                          {customerName(wallet.customer)}
                        </h3>
                        <p className="text-sm text-slate-500">{wallet.account_number || '—'}</p>
                      </div>
                      {getStatusBadge(wallet.status)}
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-sm">
                      <span className="text-slate-600 capitalize">
                        {wallet.wallet_type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-slate-300">&middot;</span>
                      <span className="font-medium text-slate-900">{wallet.currency}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-slate-900">
                      {format(wallet.balance, wallet.currency)}
                    </p>
                    <p className="text-xs text-slate-500">
                      Available: {format(wallet.available_balance, wallet.currency)}
                    </p>
                  </div>
                  <button
                    onClick={() => setDetailWallet(wallet)}
                    className="p-2 rounded-lg text-slate-400 hover:text-[#641f60] hover:bg-slate-100 transition-colors flex-shrink-0"
                    aria-label="View wallet"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <WalletIcon className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No wallets found</h3>
            <p className="text-slate-500 text-center max-w-sm">
              {searchQuery
                ? 'No wallets match your search. Try different criteria.'
                : 'Create wallets for your customers to manage their balances.'}
            </p>
            {!searchQuery && (
              <button
                onClick={openForm}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg transition-colors"
              >
                <Plus className="w-5 h-5" />
                Create First Wallet
              </button>
            )}
          </div>
        )}
      </div>

      {/* Create Wallet modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#641f60]">Create New Wallet</h2>
              <button
                onClick={closeForm}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Select Customer *</label>
                <select
                  required
                  value={formData.customer_id}
                  onChange={(e) => setFormData((prev) => ({ ...prev, customer_id: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                >
                  <option value="">Select a customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {customerName(c)}
                      {c.phone ? ` (${c.phone})` : ''}
                    </option>
                  ))}
                </select>
                {customers.length === 0 && (
                  <p className="text-sm text-[#ee7b22] mt-1">
                    No active customers found. Please add a customer first.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Wallet Type</label>
                <select
                  value={formData.wallet_type}
                  onChange={(e) => setFormData((prev) => ({ ...prev, wallet_type: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                >
                  {WALLET_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData((prev) => ({ ...prev, currency: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                >
                  {currencyOptions.map((cur) => (
                    <option key={cur} value={cur}>
                      {cur}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500">
                New wallets open with a zero balance. Fund the wallet with a deposit transaction so the
                movement is recorded in the ledger.
              </div>

              {error && (
                <div className="p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm">
                  {error}
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
                  disabled={submitting || customers.length === 0}
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
                      Create Wallet
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Wallet detail modal */}
      {detailWallet && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#641f60]">Wallet Details</h2>
              <button
                onClick={() => setDetailWallet(null)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#641f60] to-[#4a1646] flex items-center justify-center text-white flex-shrink-0">
                  {walletTypeIcon(detailWallet.wallet_type)}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    {detailWallet.customer?.customer_type && detailWallet.customer.customer_type !== 'individual' ? (
                      <Building className="w-4 h-4 text-slate-400" />
                    ) : (
                      <User className="w-4 h-4 text-slate-400" />
                    )}
                    {customerName(detailWallet.customer)}
                  </h3>
                  <p className="text-sm text-slate-500">{detailWallet.account_number || 'No account number'}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-lg bg-[#641f60]/5">
                  <p className="text-xs text-slate-500">Balance</p>
                  <p className="text-base font-bold text-slate-900">{format(detailWallet.balance, detailWallet.currency)}</p>
                </div>
                <div className="p-3 rounded-lg bg-[#1ebcb2]/10">
                  <p className="text-xs text-slate-500">Available</p>
                  <p className="text-base font-bold text-slate-900">{format(detailWallet.available_balance, detailWallet.currency)}</p>
                </div>
                <div className="p-3 rounded-lg bg-[#ee7b22]/10">
                  <p className="text-xs text-slate-500">Held</p>
                  <p className="text-base font-bold text-slate-900">{format(detailWallet.held_balance, detailWallet.currency)}</p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Type</span>
                  <span className="text-slate-800 capitalize">{detailWallet.wallet_type.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Currency</span>
                  <span className="text-slate-800">{detailWallet.currency}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Status</span>
                  {getStatusBadge(detailWallet.status)}
                </div>
                {detailWallet.customer?.phone && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Customer phone</span>
                    <span className="text-slate-800 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {detailWallet.customer.phone}
                    </span>
                  </div>
                )}
              </div>

              <button
                onClick={() => setDetailWallet(null)}
                className="w-full px-6 py-2.5 bg-[#641f60] hover:bg-[#4a1646] text-white font-medium rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}