import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Tables, InsertTables, Json } from '../lib/supabase';
import type { FloatAccount } from '../types';
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
  Wallet,
  TrendingUp,
  Undo2,
} from 'lucide-react';
import { buildApprovalChain } from '../lib/approvalChain';
import { CURRENCY_OPTIONS, formatMoney, currencyFlag } from '../lib/accountCurrencies';

type Transaction = Tables<'transactions'>;
type TransferStatus = Transaction['status'];

interface BranchTransferForm {
  to_branch_id: string;
  amount: string;
  currency: string;
  purpose: string;
  notes: string;
}

function getMetaString(metadata: Json, key: string): string | null {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    const val = (metadata as Record<string, unknown>)[key];
    return typeof val === 'string' ? val : null;
  }
  return null;
}

export function BranchTransfersPage() {
  const { tenant, branch, branches, admin } = useAuth();

  const baseCurrency =
    (tenant?.settings as { base_currency?: string; default_currency?: string } | undefined)
      ?.base_currency ??
    tenant?.settings?.default_currency ??
    'KES';

  const enabledCurrencies = useMemo(() => {
    const enabled = (tenant?.settings as { enabled_currencies?: string[] } | undefined)
      ?.enabled_currencies;
    const codes = enabled && enabled.length > 0 ? enabled : CURRENCY_OPTIONS.map((c) => c.code);
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
  const [floatAccounts, setFloatAccounts] = useState<FloatAccount[]>([]);
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

  // Settlement needs both tills named. A branch may hold several of the same
  // currency, so the officer chooses rather than the system guessing.
  const [settling, setSettling] = useState<Transaction | null>(null);
  const [fromFloatId, setFromFloatId] = useState('');
  const [toFloatId, setToFloatId] = useState('');
  const [settleError, setSettleError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [txRes, floatRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('transaction_type', 'branch_transfer')
          .order('created_at', { ascending: false }),
        supabase
          .from('float_accounts')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('status', 'active'),
      ]);

      if (txRes.error) throw txRes.error;
      if (floatRes.error) throw floatRes.error;

      setTransfers(txRes.data ?? []);
      setFloatAccounts((floatRes.data ?? []) as unknown as FloatAccount[]);
    } catch (err) {
      console.error('Error loading branch transfers:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load branch transfers');
      setTransfers([]);
      setFloatAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const branchName = useCallback(
    (id: string | null): string => {
      if (!id) return 'Unknown branch';
      const b = branches.find((br) => br.id === id);
      return b ? b.name : 'Unknown branch';
    },
    [branches]
  );

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
      const toBranch = branchName(getMetaString(t.metadata, 'to_branch_id')).toLowerCase();
      const fromBranch = branchName(t.branch_id).toLowerCase();
      const matchesSearch =
        q === '' ||
        t.reference.toLowerCase().includes(q) ||
        toBranch.includes(q) ||
        fromBranch.includes(q);
      return matchesStatus && matchesCurrency && matchesSearch;
    });
  }, [transfers, searchQuery, statusFilter, currencyFilter, branchName]);

  const summary = useMemo(() => {
    const inFlight = transfers.filter(
      (t) => t.status === 'pending' || t.status === 'approved' || t.status === 'processing'
    );
    const settled = transfers.filter((t) => t.status === 'completed');

    // Value is only summed within a currency. A mixed total would add KES to
    // USD and produce a figure that means nothing.
    const currencies = new Set(transfers.map((t) => t.currency));
    const single = currencies.size === 1 ? Array.from(currencies)[0] : null;

    return {
      inFlightCount: inFlight.length,
      inFlightValue: single
        ? inFlight.reduce((sum, t) => sum + Number(t.amount || 0), 0)
        : null,
      settledCount: settled.length,
      settledValue: single ? settled.reduce((sum, t) => sum + Number(t.amount || 0), 0) : null,
      branchCount: branches.length,
      currencyCount: currencies.size,
      singleCurrency: single,
    };
  }, [transfers, branches]);

  const otherBranches = branches.filter((b) => b.id !== branch?.id);

  const validateForm = (): string | null => {
    if (!branch) return 'No branch selected. Please select a branch first.';
    if (!formData.to_branch_id) return 'Please select a destination branch.';
    if (formData.to_branch_id === branch.id)
      return 'Destination branch must be different from the source branch.';
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
            `Branch transfer ${createdTx.reference} was created, but its approval chain could not be generated. It will need manual review.`
          );
        }
      }

      await loadData();
      closeForm();
    } catch (err) {
      console.error('Error creating branch transfer:', err);
      setFormError(err instanceof Error ? err.message : 'Failed to create branch transfer');
    } finally {
      setSubmitting(false);
    }
  };

  const openSettle = (transfer: Transaction) => {
    setSettling(transfer);
    setSettleError(null);

    const toBranchId = getMetaString(transfer.metadata, 'to_branch_id');

    // Preselect where there is only one candidate till on either side, which
    // is the common case, while still letting the officer change it.
    const fromCandidates = floatAccounts.filter(
      (f) => f.branch_id === transfer.branch_id && f.currency === transfer.currency
    );
    const toCandidates = floatAccounts.filter(
      (f) => f.branch_id === toBranchId && f.currency === transfer.currency
    );

    setFromFloatId(fromCandidates.length === 1 ? fromCandidates[0].id : '');
    setToFloatId(toCandidates.length === 1 ? toCandidates[0].id : '');
  };

  const closeSettle = () => {
    setSettling(null);
    setFromFloatId('');
    setToFloatId('');
    setSettleError(null);
  };

  const handleSettle = async () => {
    if (!settling) return;
    if (!fromFloatId || !toFloatId) {
      setSettleError('Select both the sending and receiving till.');
      return;
    }

    setActioningId(settling.id);
    setSettleError(null);
    try {
      // One call debits the sending till, credits the receiving one, marks the
      // transfer complete and posts the journal entry. Previously this only
      // changed a status, so the cash never actually moved between branches.
      const { error } = await supabase.rpc('branch_transfer_execute', {
        p_transaction_id: settling.id,
        p_from_float_account_id: fromFloatId,
        p_to_float_account_id: toFloatId,
      } as never);
      if (error) throw error;

      await loadData();
      closeSettle();
    } catch (err) {
      console.error('Error settling branch transfer:', err);
      setSettleError(err instanceof Error ? err.message : 'Failed to settle transfer');
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
      await loadData();
    } catch (err) {
      console.error('Error cancelling branch transfer:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to cancel branch transfer');
    } finally {
      setActioningId(null);
    }
  };

  const getStatusBadge = (status: TransferStatus) => {
    const map: Record<TransferStatus, { cls: string; icon: React.ReactNode }> = {
      pending: { cls: 'bg-[#ee7b22]/10 text-[#ee7b22]', icon: <Clock className="w-3 h-3" /> },
      approved: {
        cls: 'bg-[#1ebcb2]/10 text-[#159089]',
        icon: <CheckCircle className="w-3 h-3" />,
      },
      processing: {
        cls: 'bg-[#ee7b22]/10 text-[#ee7b22]',
        icon: <Loader2 className="w-3 h-3" />,
      },
      completed: {
        cls: 'bg-[#1ebcb2]/10 text-[#159089]',
        icon: <CheckCircle className="w-3 h-3" />,
      },
      failed: { cls: 'bg-[#c46040]/10 text-[#c46040]', icon: <XCircle className="w-3 h-3" /> },
      reversed: { cls: 'bg-slate-100 text-slate-600', icon: <Undo2 className="w-3 h-3" /> },
      cancelled: { cls: 'bg-slate-100 text-slate-500', icon: <XCircle className="w-3 h-3" /> },
    };
    const s = map[status];
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium capitalize ${s.cls}`}
      >
        {s.icon}
        {status}
      </span>
    );
  };

  const tillLabel = (f: FloatAccount): string =>
    `${f.float_type.replace(/_/g, ' ')} — ${f.currency} ${Number(f.balance || 0).toLocaleString()}`;

  const settleToBranchId = settling ? getMetaString(settling.metadata, 'to_branch_id') : null;
  const fromTills = settling
    ? floatAccounts.filter(
        (f) => f.branch_id === settling.branch_id && f.currency === settling.currency
      )
    : [];
  const toTills = settling
    ? floatAccounts.filter(
        (f) => f.branch_id === settleToBranchId && f.currency === settling.currency
      )
    : [];

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
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg transition-all duration-200 hover:shadow-xl hover:shadow-[#ee7b22]/25 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg"
        >
          <Plus className="w-5 h-5" />
          New Transfer
        </button>
      </div>

      {otherBranches.length === 0 && !loading && (
        <div className="bg-[#ee7b22]/10 border border-[#ee7b22]/30 rounded-xl px-4 py-3 text-sm text-[#641f60]">
          You need at least one other branch to create a transfer. This institution has{' '}
          {branches.length} branch{branches.length === 1 ? '' : 'es'}.
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
            onClick={loadData}
            className="px-4 py-2 bg-[#ee7b22] hover:bg-[#c46040] text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {!loading && transfers.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="group bg-white rounded-xl border border-slate-200 p-5 transition-all duration-200 hover:shadow-lg hover:shadow-slate-200/60 hover:-translate-y-0.5 hover:border-[#ee7b22]/40">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-[#ee7b22]/10 flex items-center justify-center transition-colors group-hover:bg-[#ee7b22]/20">
                <Clock className="w-5 h-5 text-[#ee7b22]" />
              </div>
            </div>
            <p className="text-xs font-medium text-slate-500 mb-1">Awaiting settlement</p>
            <p className="text-2xl font-bold text-[#ee7b22] tabular-nums">
              {summary.inFlightCount}
            </p>
            {summary.inFlightValue !== null && summary.singleCurrency && (
              <p className="text-[11px] text-slate-400 mt-1 tabular-nums">
                {formatMoney(summary.inFlightValue, summary.singleCurrency)}
              </p>
            )}
          </div>

          <div className="group bg-white rounded-xl border border-slate-200 p-5 transition-all duration-200 hover:shadow-lg hover:shadow-slate-200/60 hover:-translate-y-0.5 hover:border-[#1ebcb2]/40">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-[#1ebcb2]/10 flex items-center justify-center transition-colors group-hover:bg-[#1ebcb2]/20">
                <TrendingUp className="w-5 h-5 text-[#1ebcb2]" />
              </div>
            </div>
            <p className="text-xs font-medium text-slate-500 mb-1">Settled</p>
            <p className="text-2xl font-bold text-[#159089] tabular-nums">
              {summary.settledCount}
            </p>
            {summary.settledValue !== null && summary.singleCurrency && (
              <p className="text-[11px] text-slate-400 mt-1 tabular-nums">
                {formatMoney(summary.settledValue, summary.singleCurrency)}
              </p>
            )}
          </div>

          <div className="group bg-white rounded-xl border border-slate-200 p-5 transition-all duration-200 hover:shadow-lg hover:shadow-slate-200/60 hover:-translate-y-0.5 hover:border-[#641f60]/30">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-[#641f60]/10 flex items-center justify-center transition-colors group-hover:bg-[#641f60]/15">
                <Building className="w-5 h-5 text-[#641f60]" />
              </div>
            </div>
            <p className="text-xs font-medium text-slate-500 mb-1">Branches</p>
            <p className="text-2xl font-bold text-[#641f60] tabular-nums">
              {summary.branchCount}
            </p>
          </div>

          <div className="group bg-white rounded-xl border border-slate-200 p-5 transition-all duration-200 hover:shadow-lg hover:shadow-slate-200/60 hover:-translate-y-0.5 hover:border-slate-300">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center transition-colors group-hover:bg-slate-200">
                <Wallet className="w-5 h-5 text-slate-500" />
              </div>
            </div>
            <p className="text-xs font-medium text-slate-500 mb-1">Active tills</p>
            <p className="text-2xl font-bold text-slate-600 tabular-nums">
              {floatAccounts.length}
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by reference or branch..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="completed">Completed</option>
            <option value="reversed">Reversed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
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

      {loading ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
              <div className="h-3 w-24 bg-slate-200 rounded mb-3" />
              <div className="h-4 w-40 bg-slate-200 rounded mb-2" />
              <div className="h-6 w-28 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : filteredTransfers.length > 0 ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTransfers.map((transfer) => {
            const canSettle =
              transfer.status === 'pending' ||
              transfer.status === 'approved' ||
              transfer.status === 'processing';
            const toBranchId = getMetaString(transfer.metadata, 'to_branch_id');

            return (
              <div
                key={transfer.id}
                className="group flex flex-col bg-white rounded-xl border border-slate-200 transition-all duration-200 hover:shadow-lg hover:shadow-slate-200/50 hover:-translate-y-0.5 hover:border-[#641f60]/30"
              >
                <div className="p-5 flex-1">
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <span className="font-mono text-[11px] text-slate-400 truncate">
                      {transfer.reference}
                    </span>
                    {getStatusBadge(transfer.status)}
                  </div>

                  {/* Route stacked rather than inline: on a narrow card the
                      arrow form truncates both branch names. */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2">
                      <Building className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {branchName(transfer.branch_id)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 my-1 pl-1.5">
                      <ArrowRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
                      <span className="h-px flex-1 bg-slate-100" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Building className="w-3.5 h-3.5 text-[#641f60] flex-shrink-0" />
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {branchName(toBranchId)}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span aria-hidden className="text-xs">
                        {currencyFlag(transfer.currency)}
                      </span>
                      <span className="text-[11px] font-medium text-slate-400">
                        {transfer.currency}
                      </span>
                    </div>
                    <p className="text-xl font-bold text-slate-900 tabular-nums">
                      {formatMoney(transfer.amount, transfer.currency)}
                    </p>
                    {transfer.purpose && (
                      <p className="text-[11px] text-slate-400 mt-2 line-clamp-2">
                        {transfer.purpose}
                      </p>
                    )}
                    {transfer.status === 'completed' && transfer.float_balance_after !== null && (
                      <p className="text-[11px] text-slate-400 mt-2 tabular-nums">
                        Sending till left with{' '}
                        {formatMoney(transfer.float_balance_after, transfer.currency)}
                      </p>
                    )}
                  </div>
                </div>

                {canSettle && (
                  <div className="flex items-center gap-1.5 px-3 py-2.5 border-t border-slate-100">
                    <button
                      onClick={() => openSettle(transfer)}
                      disabled={actioningId === transfer.id}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 bg-[#1ebcb2] hover:bg-[#159089] text-white text-xs font-semibold rounded-lg transition-all duration-200 hover:shadow-md hover:shadow-[#1ebcb2]/25 active:scale-[0.97] disabled:opacity-50"
                    >
                      {actioningId === transfer.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      Settle
                    </button>
                    <button
                      onClick={() => handleCancel(transfer)}
                      disabled={actioningId === transfer.id}
                      className="inline-flex items-center justify-center px-2 py-1.5 text-slate-400 hover:text-[#c46040] hover:bg-[#c46040]/10 rounded-lg transition-colors disabled:opacity-50"
                      title="Cancel transfer"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 px-4">
          <div className="w-16 h-16 rounded-full bg-[#641f60]/5 flex items-center justify-center mb-4">
            <Building className="w-8 h-8 text-[#641f60]/40" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">No branch transfers found</h3>
          <p className="text-slate-500 text-center max-w-sm text-sm">
            {searchQuery || statusFilter !== 'all' || currencyFilter !== 'all'
              ? 'No transfers match your search or filter.'
              : 'Create a transfer to move funds between branches.'}
          </p>
        </div>
      )}

      {/* Settlement: both tills must be named before any money moves. */}
      {settling && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 max-w-md w-full">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#641f60]">Settle Transfer</h2>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{settling.reference}</p>
              </div>
              <button
                onClick={closeSettle}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-xs text-slate-500 mb-1">Moving</p>
                <p className="text-2xl font-bold text-slate-900 tabular-nums">
                  {formatMoney(settling.amount, settling.currency)}
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  {branchName(settling.branch_id)} &rarr; {branchName(settleToBranchId)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Debit which till at {branchName(settling.branch_id)}? *
                </label>
                <select
                  value={fromFloatId}
                  onChange={(e) => setFromFloatId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                >
                  <option value="">Select sending till</option>
                  {fromTills.map((f) => (
                    <option key={f.id} value={f.id}>
                      {tillLabel(f)}
                    </option>
                  ))}
                </select>
                {fromTills.length === 0 && (
                  <p className="text-xs text-[#c46040] mt-1">
                    No active {settling.currency} till at this branch.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Credit which till at {branchName(settleToBranchId)}? *
                </label>
                <select
                  value={toFloatId}
                  onChange={(e) => setToFloatId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                >
                  <option value="">Select receiving till</option>
                  {toTills.map((f) => (
                    <option key={f.id} value={f.id}>
                      {tillLabel(f)}
                    </option>
                  ))}
                </select>
                {toTills.length === 0 && (
                  <p className="text-xs text-[#c46040] mt-1">
                    No active {settling.currency} till at the destination branch.
                  </p>
                )}
              </div>

              <p className="text-xs text-slate-400">
                Settling debits the sending till and credits the receiving one in a single
                database transaction, then posts the ledger entry.
              </p>

              {settleError && (
                <div className="p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm">
                  {settleError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeSettle}
                  className="px-4 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSettle}
                  disabled={actioningId === settling.id || !fromFloatId || !toFloatId}
                  className="px-6 py-2.5 bg-[#1ebcb2] hover:bg-[#159089] text-white font-medium rounded-lg shadow-lg transition-all duration-200 hover:shadow-xl hover:shadow-[#1ebcb2]/25 active:scale-[0.98] disabled:opacity-50 disabled:hover:shadow-lg flex items-center gap-2"
                >
                  {actioningId === settling.id ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                  Settle Transfer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 max-w-md w-full">
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
                From:{' '}
                <span className="font-medium text-slate-900">
                  {branch?.name ?? 'No branch selected'}
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">To Branch *</label>
                <select
                  required
                  value={formData.to_branch_id}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, to_branch_id: e.target.value }))
                  }
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
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, amount: e.target.value }))
                      }
                      className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                  <select
                    value={formData.currency}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, currency: e.target.value }))
                    }
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
                  className="px-6 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg transition-all duration-200 hover:shadow-xl hover:shadow-[#ee7b22]/25 active:scale-[0.98] disabled:opacity-50 disabled:hover:shadow-lg flex items-center gap-2"
                >
                  {submitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
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