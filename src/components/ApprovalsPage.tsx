import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Tables } from '../lib/supabase';
import {
  ShieldCheck,
  Search,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Lock,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  ChevronRight,
  ArrowRightLeft,
  Building,
  KeyRound,
} from 'lucide-react';

type Approval = Tables<'transaction_approvals'>;
type Transaction = Tables<'transactions'>;

// Local extension for the two PIN-confirmation columns — see the matching
// note in TransactionsPage.tsx. These must exist on `transactions`:
//   ALTER TABLE transactions ADD COLUMN requires_pin_confirmation boolean NOT NULL DEFAULT false;
//   ALTER TABLE transactions ADD COLUMN pin_confirmed_at timestamptz;
type PinGatedTransaction = Transaction & {
  requires_pin_confirmation: boolean;
  pin_confirmed_at: string | null;
};

interface ApprovalGroup {
  transaction: PinGatedTransaction;
  approvals: Approval[]; // sorted ascending by approval_level
  currentLevel: Approval | null; // lowest pending level (the only actionable one)
  isRejected: boolean;
  isFullyApproved: boolean;
}

function formatMoney(value: number, currency = 'KES'): string {
  const symbols: Record<string, string> = { USD: '$', KES: 'KSh ', SSP: 'SSP ', EUR: '\u20ac', GBP: '\u00a3', UGX: 'USh ' };
  const symbol = symbols[currency] ?? `${currency} `;
  return `${symbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatRole(role: string): string {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Roles that may act on a given required_role. super_admin / institution_admin
// can act on any level (they sit above the whole chain); otherwise the admin's
// role must match the level's required_role exactly.
function canActOnRole(adminRole: string | undefined, requiredRole: string): boolean {
  if (!adminRole) return false;
  if (adminRole === 'super_admin' || adminRole === 'institution_admin' || adminRole === 'head_office_admin') {
    return true;
  }
  return adminRole === requiredRole;
}

export function ApprovalsPage() {
  const { tenant, admin } = useAuth();

  const [groups, setGroups] = useState<ApprovalGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [actioningId, setActioningId] = useState<string | null>(null);
  const [rejectingApproval, setRejectingApproval] = useState<Approval | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState('');

  const loadApprovals = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    setLoadError(null);
    try {
      // Pull all approval rows for the tenant. We group them by transaction
      // client-side so we can enforce level sequencing in the UI.
      const { data: approvalRows, error: approvalError } = await supabase
        .from('transaction_approvals')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('approval_level', { ascending: true });
      if (approvalError) throw approvalError;

      const approvals = approvalRows ?? [];
      if (approvals.length === 0) {
        setGroups([]);
        return;
      }

      const txIds = Array.from(new Set(approvals.map((a) => a.transaction_id)));
      const { data: txRows, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .in('id', txIds);
      if (txError) throw txError;

      const txMap = new Map<string, PinGatedTransaction>();
      (txRows ?? []).forEach((t) => txMap.set(t.id, t as PinGatedTransaction));

      // Build one group per transaction.
      const byTx = new Map<string, Approval[]>();
      for (const a of approvals) {
        const list = byTx.get(a.transaction_id) ?? [];
        list.push(a);
        byTx.set(a.transaction_id, list);
      }

      const built: ApprovalGroup[] = [];
      for (const [txId, list] of byTx.entries()) {
        const transaction = txMap.get(txId);
        if (!transaction) continue; // orphaned approval; skip
        const sorted = [...list].sort((a, b) => a.approval_level - b.approval_level);
        const isRejected = sorted.some((a) => a.status === 'rejected');
        const pendingLevels = sorted.filter((a) => a.status === 'pending');
        const isFullyApproved =
          !isRejected && sorted.every((a) => a.status === 'approved' || a.status === 'skipped');
        const currentLevel = isRejected ? null : pendingLevels[0] ?? null;
        built.push({ transaction, approvals: sorted, currentLevel, isRejected, isFullyApproved });
      }

      // Sort: actionable pending first, then by transaction date desc.
      built.sort((a, b) => {
        const aPending = a.currentLevel ? 0 : 1;
        const bPending = b.currentLevel ? 0 : 1;
        if (aPending !== bPending) return aPending - bPending;
        return b.transaction.created_at.localeCompare(a.transaction.created_at);
      });

      setGroups(built);
    } catch (err) {
      console.error('Error loading approvals:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load approvals');
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  const pendingGroups = useMemo(() => groups.filter((g) => g.currentLevel !== null), [groups]);
  const resolvedGroups = useMemo(
    () => groups.filter((g) => g.currentLevel === null),
    [groups]
  );

  const visibleGroups = useMemo(() => {
    const base = showHistory ? resolvedGroups : pendingGroups;
    const q = searchQuery.trim().toLowerCase();
    if (q === '') return base;
    return base.filter(
      (g) =>
        g.transaction.reference.toLowerCase().includes(q) ||
        g.transaction.transaction_type.toLowerCase().includes(q) ||
        (g.transaction.sender_name ?? '').toLowerCase().includes(q) ||
        (g.transaction.receiver_name ?? '').toLowerCase().includes(q)
    );
  }, [showHistory, resolvedGroups, pendingGroups, searchQuery]);

  // After a level is approved, advance the transaction if it was the last level.
  // Transfers that require PIN confirmation are NOT marked completed here —
  // manager approval only clears the way; the transaction only executes once
  // the originating cashier confirms with their PIN (TransactionsPage), which
  // is itself verified server-side, never by this page or the client.
  const advanceTransactionIfComplete = async (group: ApprovalGroup, justApprovedLevel: number) => {
    if (!tenant) return;
    const remaining = group.approvals.filter(
      (a) => a.approval_level !== justApprovedLevel && a.status === 'pending'
    );
    if (remaining.length === 0) {
      const needsPin = group.transaction.requires_pin_confirmation && !group.transaction.pin_confirmed_at;
      if (needsPin) {
        // All approval levels cleared, but execution is still gated on the
        // cashier's PIN. Mark it 'approved' (not 'completed') so it shows up
        // as "ready to send" rather than done.
        await supabase
          .from('transactions')
          .update({
            status: 'approved',
            current_approval_level: justApprovedLevel,
            approved_by: admin?.id ?? null,
            approved_at: new Date().toISOString(),
          })
          .eq('id', group.transaction.id)
          .eq('tenant_id', tenant.id);
      } else {
        // No PIN gate on this transaction type — approval fully completes it.
        await supabase
          .from('transactions')
          .update({
            status: 'completed',
            current_approval_level: justApprovedLevel,
            approved_by: admin?.id ?? null,
            approved_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          })
          .eq('id', group.transaction.id)
          .eq('tenant_id', tenant.id);
      }
    } else {
      // Advance the level counter so downstream UI reflects progress.
      await supabase
        .from('transactions')
        .update({ current_approval_level: justApprovedLevel })
        .eq('id', group.transaction.id)
        .eq('tenant_id', tenant.id);
    }
  };

  const handleApprove = async (group: ApprovalGroup, approval: Approval) => {
    if (!tenant || !admin) return;

    // Guard: only the lowest pending level is actionable.
    if (group.currentLevel?.id !== approval.id) {
      setLoadError('Earlier approval levels must be completed first.');
      return;
    }
    // Guard: role must be permitted for this level.
    if (!canActOnRole(admin.role, approval.required_role)) {
      setLoadError(
        `This level requires ${formatRole(approval.required_role)}. Your role (${formatRole(
          admin.role
        )}) cannot approve it.`
      );
      return;
    }

    setActioningId(approval.id);
    setLoadError(null);
    try {
      const { error } = await supabase
        .from('transaction_approvals')
        .update({
          status: 'approved',
          approver_id: admin.id,
        })
        .eq('id', approval.id)
        .eq('tenant_id', tenant.id);
      if (error) throw error;

      await advanceTransactionIfComplete(group, approval.approval_level);
      await loadApprovals();
    } catch (err) {
      console.error('Error approving:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setActioningId(null);
    }
  };

  const openReject = (group: ApprovalGroup, approval: Approval) => {
    if (group.currentLevel?.id !== approval.id) {
      setLoadError('Earlier approval levels must be completed first.');
      return;
    }
    if (!canActOnRole(admin?.role, approval.required_role)) {
      setLoadError(
        `This level requires ${formatRole(approval.required_role)}. Your role cannot reject it.`
      );
      return;
    }
    setRejectingApproval(approval);
    setRejectionNotes('');
  };

  const handleReject = async () => {
    if (!tenant || !admin || !rejectingApproval) return;
    if (!rejectionNotes.trim()) {
      setLoadError('A rejection reason is required.');
      return;
    }

    setActioningId(rejectingApproval.id);
    try {
      const { error } = await supabase
        .from('transaction_approvals')
        .update({
          status: 'rejected',
          approver_id: admin.id,
          notes: rejectionNotes.trim(),
        })
        .eq('id', rejectingApproval.id)
        .eq('tenant_id', tenant.id);
      if (error) throw error;

      // A rejection at any level fails the whole transaction.
      await supabase
        .from('transactions')
        .update({ status: 'failed' })
        .eq('id', rejectingApproval.transaction_id)
        .eq('tenant_id', tenant.id);

      await loadApprovals();
      setRejectingApproval(null);
      setRejectionNotes('');
    } catch (err) {
      console.error('Error rejecting:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setActioningId(null);
    }
  };

  const txIcon = (type: string) => {
    if (type === 'branch_transfer') return <Building className="w-5 h-5" />;
    return <ArrowRightLeft className="w-5 h-5" />;
  };

  const levelBadge = (status: Approval['status']) => {
    const map: Record<Approval['status'], { cls: string; icon: React.ReactNode }> = {
      pending: { cls: 'bg-slate-100 text-slate-500', icon: <Clock className="w-3.5 h-3.5" /> },
      approved: { cls: 'bg-[#1ebcb2]/10 text-[#1ebcb2]', icon: <CheckCircle className="w-3.5 h-3.5" /> },
      rejected: { cls: 'bg-[#c46040]/10 text-[#c46040]', icon: <XCircle className="w-3.5 h-3.5" /> },
      skipped: { cls: 'bg-slate-100 text-slate-400', icon: <ChevronRight className="w-3.5 h-3.5" /> },
    };
    const s = map[status];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${s.cls}`}>
        {s.icon}
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#641f60]">Approvals</h1>
          <p className="text-slate-600 mt-1">
            Multi-level approval workflow for transactions requiring sign-off
          </p>
        </div>
        <div className="flex bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setShowHistory(false)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              !showHistory ? 'bg-white text-[#641f60] shadow' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Pending ({pendingGroups.length})
          </button>
          <button
            onClick={() => setShowHistory(true)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              showHistory ? 'bg-white text-[#641f60] shadow' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            History ({resolvedGroups.length})
          </button>
        </div>
      </div>

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
            onClick={loadApprovals}
            className="px-4 py-2 bg-[#ee7b22] hover:bg-[#c46040] text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by reference, type, sender, or receiver..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#641f60]" />
          </div>
        ) : visibleGroups.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {visibleGroups.map((group) => {
              const { transaction: tx, approvals, currentLevel } = group;
              const isExpanded = expandedId === tx.id;
              const actionable =
                currentLevel !== null && canActOnRole(admin?.role, currentLevel.required_role);
              const awaitingPin =
                group.isFullyApproved && tx.requires_pin_confirmation && !tx.pin_confirmed_at;
              return (
                <div key={tx.id}>
                  <div className="px-5 py-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start gap-4">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : tx.id)}
                        className="mt-1 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
                        aria-label={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                      <div className="w-10 h-10 rounded-lg bg-[#641f60]/10 flex items-center justify-center text-[#641f60] flex-shrink-0">
                        {txIcon(tx.transaction_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-mono text-sm text-slate-500">{tx.reference}</span>
                          <span className="text-sm text-slate-600 capitalize">
                            {tx.transaction_type.replace(/_/g, ' ')}
                          </span>
                          {group.isRejected && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#c46040]/10 text-[#c46040] text-xs font-medium rounded-full">
                              <XCircle className="w-3 h-3" />
                              Rejected
                            </span>
                          )}
                          {group.isFullyApproved && !awaitingPin && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#1ebcb2]/10 text-[#1ebcb2] text-xs font-medium rounded-full">
                              <CheckCircle className="w-3 h-3" />
                              Fully Approved
                            </span>
                          )}
                          {awaitingPin && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#ee7b22]/10 text-[#ee7b22] text-xs font-medium rounded-full">
                              <KeyRound className="w-3 h-3" />
                              Awaiting Cashier PIN
                            </span>
                          )}
                        </div>
                        <p className="font-semibold text-slate-900 mt-0.5">
                          {formatMoney(tx.amount, tx.currency)}
                          {tx.receiver_name && (
                            <span className="font-normal text-slate-600"> to {tx.receiver_name}</span>
                          )}
                        </p>
                        {currentLevel && (
                          <p className="text-xs text-slate-500 mt-1">
                            Awaiting level {currentLevel.approval_level}:{' '}
                            <span className="font-medium">{formatRole(currentLevel.required_role)}</span>
                          </p>
                        )}
                        {awaitingPin && (
                          <p className="text-xs text-slate-500 mt-1">
                            Approved &mdash; the transaction executes once the originating cashier confirms with
                            their PIN.
                          </p>
                        )}
                      </div>

                      {currentLevel && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {actionable ? (
                            <>
                              <button
                                onClick={() => handleApprove(group, currentLevel)}
                                disabled={actioningId === currentLevel.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1ebcb2] hover:bg-[#641f60] text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                              >
                                {actioningId === currentLevel.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <ThumbsUp className="w-3.5 h-3.5" />
                                )}
                                Approve
                              </button>
                              <button
                                onClick={() => openReject(group, currentLevel)}
                                disabled={actioningId === currentLevel.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#c46040] text-[#c46040] hover:bg-[#c46040]/10 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                              >
                                <ThumbsDown className="w-3.5 h-3.5" />
                                Reject
                              </button>
                            </>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-500 text-xs font-medium rounded-lg"
                              title={`Requires ${formatRole(currentLevel.required_role)}`}
                            >
                              <Lock className="w-3.5 h-3.5" />
                              {formatRole(currentLevel.required_role)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-5 pb-4 bg-slate-50">
                      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                        <div className="px-4 py-2 bg-slate-100 text-xs font-semibold text-slate-600 uppercase">
                          Approval Chain
                        </div>
                        <div className="divide-y divide-slate-100">
                          {approvals.map((a) => {
                            const isCurrent = currentLevel?.id === a.id;
                            return (
                              <div
                                key={a.id}
                                className={`px-4 py-3 flex items-center justify-between ${
                                  isCurrent ? 'bg-[#ee7b22]/5' : ''
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <span className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-600">
                                    {a.approval_level}
                                  </span>
                                  <div>
                                    <p className="text-sm font-medium text-slate-800">
                                      {formatRole(a.required_role)}
                                    </p>
                                    {a.notes && <p className="text-xs text-[#c46040] mt-0.5">{a.notes}</p>}
                                  </div>
                                </div>
                                {levelBadge(a.status)}
                              </div>
                            );
                          })}
                          {awaitingPin && (
                            <div className="px-4 py-3 flex items-center justify-between bg-[#ee7b22]/5">
                              <div className="flex items-center gap-3">
                                <span className="w-7 h-7 rounded-full bg-[#ee7b22]/10 flex items-center justify-center text-[#ee7b22]">
                                  <KeyRound className="w-3.5 h-3.5" />
                                </span>
                                <p className="text-sm font-medium text-slate-800">Cashier PIN Confirmation</p>
                              </div>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize bg-[#ee7b22]/10 text-[#ee7b22]">
                                <Clock className="w-3.5 h-3.5" />
                                pending
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <ShieldCheck className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">
              {showHistory ? 'No resolved approvals' : 'No pending approvals'}
            </h3>
            <p className="text-slate-500 text-center max-w-sm">
              {showHistory
                ? 'Approved and rejected items will appear here.'
                : searchQuery
                ? 'No pending approvals match your search.'
                : 'Transactions requiring approval will appear here as they are created.'}
            </p>
          </div>
        )}
      </div>

      {/* Reject modal */}
      {rejectingApproval && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-lg font-bold text-[#641f60] mb-1">Reject Approval</h2>
            <p className="text-sm text-slate-600 mb-4">
              Rejecting level {rejectingApproval.approval_level} ({formatRole(rejectingApproval.required_role)})
              will fail the entire transaction.
            </p>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reason *</label>
            <textarea
              rows={3}
              value={rejectionNotes}
              onChange={(e) => setRejectionNotes(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
              placeholder="Why is this being rejected?"
              autoFocus
            />
            <div className="flex items-center justify-end gap-3 mt-4">
              <button
                onClick={() => setRejectingApproval(null)}
                className="px-4 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actioningId === rejectingApproval.id}
                className="px-6 py-2.5 bg-[#c46040] hover:bg-[#641f60] text-white font-medium rounded-lg shadow-lg disabled:opacity-50 flex items-center gap-2"
              >
                {actioningId === rejectingApproval.id ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <ThumbsDown className="w-5 h-5" />
                )}
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}