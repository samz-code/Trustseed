import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Transaction, Customer, Wallet } from '../types';
import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowRightLeft,
  Globe,
  Search,
  Plus,
  X,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCcw,
  DollarSign,
  Phone,
  User,
  Banknote,
  PiggyBank,
  Receipt,
} from 'lucide-react';

const TRANSACTION_TYPES: { value: Transaction['transaction_type']; label: string; icon: React.ReactNode }[] = [
  { value: 'deposit', label: 'Deposit', icon: <ArrowDownRight className="w-5 h-5" /> },
  { value: 'withdrawal', label: 'Withdrawal', icon: <ArrowUpRight className="w-5 h-5" /> },
  { value: 'transfer', label: 'Money Transfer', icon: <ArrowRightLeft className="w-5 h-5" /> },
  { value: 'forex_buy', label: 'Forex Buy', icon: <Globe className="w-5 h-5" /> },
  { value: 'forex_sell', label: 'Forex Sell', icon: <RefreshCcw className="w-5 h-5" /> },
  { value: 'loan_disbursement', label: 'Loan Disbursement', icon: <Banknote className="w-5 h-5" /> },
  { value: 'loan_repayment', label: 'Loan Repayment', icon: <DollarSign className="w-5 h-5" /> },
  { value: 'savings_deposit', label: 'Savings Deposit', icon: <PiggyBank className="w-5 h-5" /> },
  { value: 'savings_withdrawal', label: 'Savings Withdrawal', icon: <PiggyBank className="w-5 h-5" /> },
  { value: 'float_allocation', label: 'Float Allocation', icon: <Receipt className="w-5 h-5" /> },
];

// Threshold above which a transaction needs sign-off purely on size, even if
// it's domestic. Kept as a named constant so it's easy to make configurable
// per-tenant later instead of hardcoded here.
const LARGE_AMOUNT_APPROVAL_THRESHOLD = 1000;

type RequiredRole = 'branch_manager' | 'compliance_officer';

// Decides who has to sign off on a transaction before it can complete.
// International transfers always route to compliance (AML / source-of-funds
// obligations), regardless of amount. Everything else only needs approval
// once it crosses the size threshold, and goes to the branch manager.
function resolveRequiredRole(amount: number, isInternational: boolean): RequiredRole | null {
  if (isInternational) return 'compliance_officer';
  if (amount >= LARGE_AMOUNT_APPROVAL_THRESHOLD) return 'branch_manager';
  return null;
}

function roleLabel(role: RequiredRole): string {
  return role === 'compliance_officer' ? 'Compliance Officer' : 'Branch Manager';
}

interface TransactionsPageProps {
  defaultType?: Transaction['transaction_type'];
}

export function TransactionsPage({ defaultType }: TransactionsPageProps = {}) {
  const { tenant, branch, admin } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    transaction_type: Transaction['transaction_type'];
    amount: number;
    currency: string;
    from_customer_id: string;
    to_customer_id: string;
    from_wallet_id: string;
    to_wallet_id: string;
    sender_name: string;
    sender_phone: string;
    receiver_name: string;
    receiver_phone: string;
    is_international: boolean;
    purpose: string;
    notes: string;
  }>({
    transaction_type: defaultType || 'deposit',
    amount: 0,
    currency: 'USD',
    from_customer_id: '',
    to_customer_id: '',
    from_wallet_id: '',
    to_wallet_id: '',
    sender_name: '',
    sender_phone: '',
    receiver_name: '',
    receiver_phone: '',
    is_international: false,
    purpose: '',
    notes: '',
  });

  useEffect(() => {
    if (tenant) {
      loadData();
    }
  }, [tenant, branch]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [txRes, custRes, walletRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('*')
          .eq('tenant_id', tenant!.id)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('customers')
          .select('*')
          .eq('tenant_id', tenant!.id)
          .eq('status', 'active'),
        supabase
          .from('wallets')
          .select('*, customer:customers(first_name, last_name, business_name, customer_type)')
          .eq('tenant_id', tenant!.id)
          .eq('status', 'active'),
      ]);

      if (txRes.error) throw txRes.error;
      if (custRes.error) throw custRes.error;
      if (walletRes.error) throw walletRes.error;

      setTransactions((txRes.data || []) as Transaction[]);
      setCustomers((custRes.data || []) as Customer[]);
      setWallets((walletRes.data || []) as Wallet[]);
    } catch (err) {
      console.error('Error loading transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch =
      tx.reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.sender_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.receiver_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = filterType === 'all' || tx.transaction_type === filterType;
    const matchesStatus = filterStatus === 'all' || tx.status === filterStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (!tenant || !admin) throw new Error('Missing tenant or admin');
      if (formData.amount <= 0) throw new Error('Amount must be greater than 0');

      const requiredRole = resolveRequiredRole(formData.amount, formData.is_international);
      const requiresApproval = requiredRole !== null;
      // Compliance sign-off (international) is treated as the higher tier;
      // a plain large-amount branch-manager approval is level 1.
      const approvalLevel = requiredRole === 'compliance_officer' ? 2 : requiresApproval ? 1 : 0;

      const { data: insertedTx, error: insertError } = await supabase
        .from('transactions')
        .insert({
          tenant_id: tenant.id,
          branch_id: branch?.id || null,
          transaction_type: formData.transaction_type,
          amount: formData.amount,
          currency: formData.currency,
          from_customer_id: formData.from_customer_id || null,
          to_customer_id: formData.to_customer_id || null,
          from_wallet_id: formData.from_wallet_id || null,
          to_wallet_id: formData.to_wallet_id || null,
          sender_name: formData.sender_name || null,
          sender_phone: formData.sender_phone || null,
          receiver_name: formData.receiver_name || null,
          receiver_phone: formData.receiver_phone || null,
          is_international: formData.is_international,
          requires_compliance_check: formData.is_international,
          purpose: formData.purpose || null,
          notes: formData.notes || null,
          status: (requiresApproval ? 'pending' : 'approved') as Transaction['status'],
          created_by: admin.id,
          required_approval_level: approvalLevel,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Route the transaction to whoever actually has to sign off on it -
      // without this, transactions sat as `status: 'pending'` with no
      // corresponding approval record, so nothing showed up on the Pending
      // Approvals page and nobody was ever notified.
      if (requiresApproval && insertedTx && requiredRole) {
        const { error: approvalError } = await supabase.from('transaction_approvals').insert({
          tenant_id: tenant.id,
          transaction_id: insertedTx.id,
          required_role: requiredRole,
          approval_level: approvalLevel,
          status: 'pending' as const,
        });
        if (approvalError) throw approvalError;

        // Best-effort notification - if the `notifications` table isn't set
        // up yet this silently no-ops rather than blocking the transaction.
        try {
          await (supabase.from('notifications') as any).insert({
            tenant_id: tenant.id,
            branch_id: branch?.id || null,
            admin_id: null, // tenant-wide; narrow to a specific admin_id once role->admin lookup exists
            title: `${roleLabel(requiredRole)} approval needed`,
            message: `${formData.transaction_type.replace(/_/g, ' ')} of ${formData.currency} ${formData.amount.toLocaleString()} is awaiting approval.`,
            type: 'warning',
            link_path: 'approvals',
          });
        } catch (notifyErr) {
          console.error('Error creating approval notification:', notifyErr);
        }
      }

      await loadData();
      setShowForm(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create transaction');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      transaction_type: defaultType || 'deposit',
      amount: 0,
      currency: 'USD',
      from_customer_id: '',
      to_customer_id: '',
      from_wallet_id: '',
      to_wallet_id: '',
      sender_name: '',
      sender_phone: '',
      receiver_name: '',
      receiver_phone: '',
      is_international: false,
      purpose: '',
      notes: '',
    });
    setError(null);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
      pending: {
        bg: 'bg-[#ee7b22]/10',
        text: 'text-[#ee7b22]',
        icon: <Clock className="w-3.5 h-3.5" />,
      },
      approved: {
        bg: 'bg-[#1ebcb2]/10',
        text: 'text-[#1ebcb2]',
        icon: <CheckCircle className="w-3.5 h-3.5" />,
      },
      completed: {
        bg: 'bg-[#1ebcb2]/10',
        text: 'text-[#1ebcb2]',
        icon: <CheckCircle className="w-3.5 h-3.5" />,
      },
      failed: {
        bg: 'bg-[#c46040]/10',
        text: 'text-[#c46040]',
        icon: <XCircle className="w-3.5 h-3.5" />,
      },
      reversed: {
        bg: 'bg-slate-100',
        text: 'text-slate-700',
        icon: <RefreshCcw className="w-3.5 h-3.5" />,
      },
    };
    const style = styles[status] || styles.pending;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
        {style.icon}
        {status}
      </span>
    );
  };

  const getTransactionIcon = (type: string) => {
    if (type.includes('deposit') || type.includes('repayment')) {
      return <ArrowDownRight className="w-5 h-5 text-[#1ebcb2]" />;
    }
    if (type.includes('withdrawal') || type.includes('disbursement')) {
      return <ArrowUpRight className="w-5 h-5 text-[#ee7b22]" />;
    }
    if (type.includes('forex')) {
      return <Globe className="w-5 h-5 text-[#641f60]" />;
    }
    return <ArrowRightLeft className="w-5 h-5 text-slate-500" />;
  };

  const getIconBg = (type: string) => {
    if (type.includes('deposit') || type.includes('repayment')) return 'bg-[#1ebcb2]/10';
    if (type.includes('withdrawal') || type.includes('disbursement')) return 'bg-[#ee7b22]/10';
    if (type.includes('forex')) return 'bg-[#641f60]/10';
    return 'bg-slate-100';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#641f60]">Transactions</h1>
          <p className="text-slate-600 mt-1">Process deposits, withdrawals, transfers, and more</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg transition-all"
        >
          <Plus className="w-5 h-5" />
          New Transaction
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by reference or name..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-3">
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
            >
              <option value="all">All Types</option>
              {TRANSACTION_TYPES.map(t => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Transaction List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#641f60]" />
          </div>
        ) : filteredTransactions.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filteredTransactions.map(tx => (
              <div key={tx.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${getIconBg(tx.transaction_type)}`}>
                    {getTransactionIcon(tx.transaction_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-slate-900 capitalize">
                          {tx.transaction_type.replace(/_/g, ' ')}
                        </h3>
                        <p className="text-sm text-slate-500">{tx.reference}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {tx.is_international && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-[#641f60]/10 text-[#641f60]">
                            <Globe className="w-3 h-3" />
                            International
                          </span>
                        )}
                        {getStatusBadge(tx.status)}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                      {(tx.sender_name || tx.receiver_name) && (
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {tx.sender_name && `From: ${tx.sender_name}`}
                          {tx.sender_name && tx.receiver_name && ' \u2192 '}
                          {tx.receiver_name && `To: ${tx.receiver_name}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-lg font-semibold ${
                        tx.transaction_type.includes('deposit') || tx.transaction_type.includes('repayment')
                          ? 'text-[#1ebcb2]'
                          : 'text-slate-900'
                      }`}
                    >
                      {tx.transaction_type.includes('deposit') || tx.transaction_type.includes('repayment') ? '+' : '-'}
                      {tx.currency} {tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(tx.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <ArrowRightLeft className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No transactions found</h3>
            <p className="text-slate-500 text-center max-w-sm">
              {searchQuery || filterType !== 'all' || filterStatus !== 'all'
                ? 'No transactions match your filters. Try adjusting them.'
                : 'Start processing transactions to see them here.'}
            </p>
          </div>
        )}
      </div>

      {/* New Transaction Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full my-8">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-[#641f60]">New Transaction</h2>
              <button
                onClick={() => setShowForm(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Transaction Type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Transaction Type
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {TRANSACTION_TYPES.slice(0, 6).map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, transaction_type: t.value }))}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        formData.transaction_type === t.value
                          ? 'border-[#1ebcb2] bg-[#1ebcb2]/10'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className={formData.transaction_type === t.value ? 'text-[#641f60]' : 'text-slate-500'}>
                        {t.icon}
                      </span>
                      <span className="block text-sm font-medium text-slate-700 mt-1">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount & Currency */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Amount *
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={formData.amount || ''}
                      onChange={e => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    />
                  </div>
                  {formData.amount >= LARGE_AMOUNT_APPROVAL_THRESHOLD && (
                    <p className="text-xs text-[#ee7b22] mt-1">
                      Requires Branch Manager approval (amount {'>='} {LARGE_AMOUNT_APPROVAL_THRESHOLD.toLocaleString()})
                    </p>
                  )}
                  {formData.is_international && (
                    <p className="text-xs text-[#ee7b22] mt-1">
                      Requires Compliance Officer approval (international transfer)
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Currency
                  </label>
                  <select
                    value={formData.currency}
                    onChange={e => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  >
                    <option value="USD">USD</option>
                    <option value="KES">KES</option>
                    <option value="SSP">SSP</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>

              {/* Customer Selection */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    From Customer
                  </label>
                  <select
                    value={formData.from_customer_id}
                    onChange={e => setFormData(prev => ({ ...prev, from_customer_id: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  >
                    <option value="">Select customer</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.customer_type === 'business' ? c.business_name : `${c.first_name} ${c.last_name}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    To Customer
                  </label>
                  <select
                    value={formData.to_customer_id}
                    onChange={e => setFormData(prev => ({ ...prev, to_customer_id: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  >
                    <option value="">Select customer</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.customer_type === 'business' ? c.business_name : `${c.first_name} ${c.last_name}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* External Party (for transfers) */}
              {(formData.transaction_type === 'transfer' || formData.transaction_type === 'withdrawal') && (
                <div className="border-t border-slate-200 pt-4 space-y-4">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <User className="w-5 h-5 text-[#641f60]" />
                    External Party (Optional)
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Sender Name
                      </label>
                      <input
                        type="text"
                        value={formData.sender_name}
                        onChange={e => setFormData(prev => ({ ...prev, sender_name: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Sender Phone
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                          type="tel"
                          value={formData.sender_phone}
                          onChange={e => setFormData(prev => ({ ...prev, sender_phone: e.target.value }))}
                          className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Receiver Name
                      </label>
                      <input
                        type="text"
                        value={formData.receiver_name}
                        onChange={e => setFormData(prev => ({ ...prev, receiver_name: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Receiver Phone
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                          type="tel"
                          value={formData.receiver_phone}
                          onChange={e => setFormData(prev => ({ ...prev, receiver_phone: e.target.value }))}
                          className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* International Transfer */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_international"
                  checked={formData.is_international}
                  onChange={e => setFormData(prev => ({ ...prev, is_international: e.target.checked }))}
                  className="w-4 h-4 text-[#641f60] border-slate-300 rounded focus:ring-[#1ebcb2]"
                />
                <label htmlFor="is_international" className="text-sm text-slate-700">
                  This is an international transfer (requires compliance check)
                </label>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  placeholder="Add any additional notes..."
                />
              </div>

              {error && (
                <div className="p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      Create Transaction
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