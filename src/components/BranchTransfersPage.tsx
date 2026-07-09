import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Tables, InsertTables, Json } from '../lib/supabase';
import {
  Plus,
  Search,
  Building,
  X,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  ArrowRight,
  Send,
} from 'lucide-react';
import { buildApprovalChain } from '../lib/approvalChain';
import {
  CURRENCY_OPTIONS,
  formatMoney,
  currencyFlag,
} from '../lib/accountCurrencies';

type Transaction = Tables<'transactions'>;
type TransferStatus = Transaction['status'];

interface BranchTransferForm {
  to_branch_id: string;
  amount: string;
  currency: string;
  purpose: string;
  notes: string;
}

function getToBranchId(metadata: Json): string | null {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    const val = (metadata as Record<string, unknown>).to_branch_id;
    return typeof val === 'string' ? val : null;
  }
  return null;
}

export function BranchTransfersPage() {
  const { tenant, branch, branches, admin } = useAuth();

  // Institution currency configuration, shared with Daily Operations etc.
  const baseCurrency =
    (tenant?.settings as { base_currency?: string; default_currency?: string } | undefined)?.base_currency ??
    tenant?.settings?.default_currency ??
    'KES';

  // Currencies the institution actually uses, falling back to the full list.
  const enabledCurrencies = useMemo(() => {
    const enabled = (tenant?.settings as { enabled_currencies?: string[] } | undefined)?.enabled_currencies;
    const codes = enabled && enabled.length > 0 ? enabled : CURRENCY_OPTIONS.map((c) => c.code);
    // Preserve the canonical ordering from CURRENCY_OPTIONS, then append any
    // configured currency that isn't in the canonical list (defensive).
    const known = CURRENCY_OPTIONS.filter((c) => codes.includes(c.code));
    const extra = codes
      .filter((code) => !CURRENCY_OPTIONS.some((c) => c.code === code))
      .map((code) => ({ code, name: code, symbol: `${code} `, flag: currencyFlag(code) }));
    return [...known, ...extra];
  }, [tenant]);

  const emptyForm = useMemo<BranchTransferForm>(
    () => ({ to_branch_id: '', amount: '', currency: baseCurrency, purpose: '', notes: '' }),
    [baseCurrency]
  );

  const [transfers, setTransfers] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TransferStatus>('all');
  const [currencyFilter, setCurrencyFilter] = useState<'all' | string>('all');

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<BranchTransferForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const loadTransfers = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('transaction_type', 'branch_transfer')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTransfers(data ?? []);
    } catch (err) {
      console.error('Error loading branch transfers:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load branch transfers');
      setTransfers([]);
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    loadTransfers();
  }, [loadTransfers]);

  const branchName = useCallback(
    (id: string | null): string => {
      if (!id) return 'Unknown branch';
      const b = branches.find((br) => br.id === id);
      return b ? b.name : 'Unknown branch';
    },
    [branches]
  );

  // Currencies present in the loaded data, so the filter only offers real ones.
  const currenciesInData = useMemo(() => {
    const set = new Set<string>();
    transfers.forEach((t) => t.currency && set.add(t.currency));
    return Array.from(set).sort();
  }, [transfers]);

  const filteredTransfers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return transfers.filter((t) => {
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      const matchesCurrency = currencyFilter === 'all' || t.currency === currencyFilter;
      const toBranch = branchName(getToBranchId(t.metadata)).toLowerCase();
      const fromBranch = branchName(t.branch_id).toLowerCase();
      const matchesSearch =
        q === '' ||
        t.reference.toLowerCase().includes(q) ||
        toBranch.includes(q) ||
        fromBranch.includes(q);
      return matchesStatus && matchesCurrency && matchesSearch;
    });
  }, [transfers, searchQuery, statusFilter, currencyFilter, branchName]);

  const otherBranches = branches.filter((b) => b.id !== branch?.id);

  const validateForm = (): string | null => {
    if (!branch) return 'No branch selected. Please select a branch first.';
    if (!formData.to_branch_id) return 'Please select a destination branch.';
    if (formData.to_branch_id === branch.id) return 'Destination branch must be different from the source branch.';
    if (!formData.currency) return 'Please choose a currency.';
    const amount = parseFloat(formData.amount);
    if (!formData.amount || Number.isNaN(amount) || amount <= 0) {
      return 'Please enter a valid transfer amount.';
    }
    return null;
  };

  const openForm = () => {
    setFormData(emptyForm);
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setFormData(emptyForm);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!tenant || !admin || !branch) {
      setFormError('No institution or branch context found. Please sign in again.');
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const insert: InsertTables<'transactions'> = {
        tenant_id: tenant.id,
        branch_id: branch.id,
        transaction_type: 'branch_transfer',
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        purpose: formData.purpose.trim() || null,
        notes: formData.notes.trim() || null,
        created_by: admin.id,
        required_approval_level: 2,
        metadata: { to_branch_id: formData.to_branch_id },
      };

      const { data: createdTx, error } = await supabase
        .from('transactions')
        .insert(insert)
        .select()
        .maybeSingle();
      if (error) throw error;

      // Branch transfers always require sign-off (level 2). Generate the chain.
      if (createdTx) {
        try {
          await buildApprovalChain({
            tenantId: tenant.id,
            transactionId: createdTx.id,
            requiredApprovalLevel: createdTx.required_approval_level,
          });
        } catch (chainErr) {
          console.error('Approval chain creation failed:', chainErr);
          setFormError(
            `Branch transfer ${createdTx.reference} was created, but its approval chain could not be generated. ` +
              'It will need manual review.'
          );
        }
      }

      await loadTransfers();
      closeForm();
    } catch (err) {
      console.error('Error creating branch transfer:', err);
      setFormError(err instanceof Error ? err.message : 'Failed to create branch transfer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async (transfer: Transaction) => {
    if (!tenant) return;
    setActioningId(transfer.id);
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', transfer.id)
        .eq('tenant_id', tenant.id);
      if (error) throw error;
      await loadTransfers();
    } catch (err) {
      console.error('Error completing branch transfer:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to complete branch transfer');
    } finally {
      setActioningId(null);
    }
  };

  const handleCancel = async (transfer: Transaction) => {
    if (!tenant) return;
    setActioningId(transfer.id);
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ status: 'cancelled' })
        .eq('id', transfer.id)
        .eq('tenant_id', tenant.id);
      if (error) throw error;
      await loadTransfers();
    } catch (err) {
      console.error('Error cancelling branch transfer:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to cancel branch transfer');
    } finally {
      setActioningId(null);
    }
  };

  const getStatusBadge = (status: TransferStatus) => {
    const map: Record<TransferStatus, { cls: string; icon: React.ReactNode }> = {
      pending: { cls: 'bg-[#ee7b22]/10 text-[#ee7b22]', icon: <Clock className="w-3.5 h-3.5" /> },
      approved: { cls: 'bg-[#1ebcb2]/10 text-[#1ebcb2]', icon: <CheckCircle className="w-3.5 h-3.5" /> },
      processing: { cls: 'bg-[#ee7b22]/10 text-[#ee7b22]', icon: <Loader2 className="w-3.5 h-3.5" /> },
      completed: { cls: 'bg-[#1ebcb2]/10 text-[#1ebcb2]', icon: <CheckCircle className="w-3.5 h-3.5" /> },
      failed: { cls: 'bg-[#c46040]/10 text-[#c46040]', icon: <XCircle className="w-3.5 h-3.5" /> },
      reversed: { cls: 'bg-slate-100 text-slate-600', icon: <RefreshCw className="w-3.5 h-3.5" /> },
      cancelled: { cls: 'bg-slate-100 text-slate-500', icon: <XCircle className="w-3.5 h-3.5" /> },
    };
    const s = map[status];
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium capitalize ${s.cls}`}>
        {s.icon}
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#641f60]">Branch Transfers</h1>
          <p className="text-slate-600 mt-1">Move float and funds between your branches</p>
        </div>
        <button
          onClick={openForm}
          disabled={otherBranches.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-5 h-5" />
          New Transfer
        </button>
      </div>

      {otherBranches.length === 0 && !loading && (
        <div className="bg-[#ee7b22]/10 border border-[#ee7b22]/30 rounded-xl p-4 text-sm text-[#641f60]">
          You need at least one other branch to create a branch transfer. This institution currently
          has {branches.length} branch{branches.length === 1 ? '' : 'es'}.
        </div>
      )}

      {loadError && (
        <div className="bg-[#c46040]/10 border border-[#c46040]/30 rounded-xl p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-[#c46040]/15 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-6 h-6 text-[#c46040]" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-[#c46040]">Something went wrong</h3>
            <p className="text-sm text-slate-600">{loadError}</p>
          </div>
          <button
            onClick={loadTransfers}
            className="px-4 py-2 bg-[#ee7b22] hover:bg-[#c46040] text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by reference or branch..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value)}
            className="px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
          >
            <option value="all">All Currencies</option>
            {currenciesInData.map((code) => (
              <option key={code} value={code}>
                {currencyFlag(code)} {code}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#641f60]" />
          </div>
        ) : filteredTransfers.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filteredTransfers.map((transfer) => {
              const canAct = transfer.status === 'pending' || transfer.status === 'approved';
              return (
                <div key={transfer.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-mono text-sm text-slate-500">{transfer.reference}</span>
                        {getStatusBadge(transfer.status)}
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                          <span aria-hidden>{currencyFlag(transfer.currency)}</span>
                          {transfer.currency}
                        </span>
                      </div>
                      <p className="font-semibold text-slate-900 mt-1 flex items-center gap-2 flex-wrap">
                        <Building className="w-4 h-4 text-[#641f60]" />
                        {branchName(transfer.branch_id)}
                        <ArrowRight className="w-4 h-4 text-slate-400" />
                        {branchName(getToBranchId(transfer.metadata))}
                      </p>
                      <p className="text-sm text-slate-600">
                        {currencyFlag(transfer.currency)} {formatMoney(transfer.amount, transfer.currency)}
                      </p>
                      {transfer.purpose && <p className="text-sm text-slate-500 mt-1">{transfer.purpose}</p>}
                    </div>
                    {canAct && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleComplete(transfer)}
                          disabled={actioningId === transfer.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1ebcb2] hover:bg-[#641f60] text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                        >
                          {actioningId === transfer.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          Complete
                        </button>
                        <button
                          onClick={() => handleCancel(transfer)}
                          disabled={actioningId === transfer.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <Building className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No branch transfers found</h3>
            <p className="text-slate-500 text-center max-w-sm">
              {searchQuery || statusFilter !== 'all' || currencyFilter !== 'all'
                ? 'No transfers match your search or filter.'
                : 'Create a transfer to move funds between branches.'}
            </p>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#641f60]">New Branch Transfer</h2>
              <button
                onClick={closeForm}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
                From: <span className="font-medium text-slate-900">{branch?.name ?? 'No branch selected'}</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">To Branch *</label>
                <select
                  required
                  value={formData.to_branch_id}
                  onChange={(e) => setFormData((prev) => ({ ...prev, to_branch_id: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                >
                  <option value="">Select destination branch</option>
                  {otherBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                      {b.is_head_office ? ' (HQ)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amount *</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm">
                      {currencyFlag(formData.currency)}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={formData.amount}
                      onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                      className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData((prev) => ({ ...prev, currency: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  >
                    {enabledCurrencies.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Purpose</label>
                <input
                  type="text"
                  value={formData.purpose}
                  onChange={(e) => setFormData((prev) => ({ ...prev, purpose: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  placeholder="Float top-up, cash rebalancing..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
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
                  disabled={submitting}
                  className="px-6 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  Send Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}