import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Tables, InsertTables } from '../lib/supabase';
import type { UserRole } from '../types';
import {
  Plus,
  Search,
  Users,
  X,
  Loader2,
  RefreshCw,
  AlertCircle,
  Mail,
  Pencil,
  Ban,
  CheckCircle,
  Clock,
  ShieldCheck,
  UserCog,
  Info,
  Building2,
} from 'lucide-react';

type TenantAdmin = Tables<'tenant_admins'>;

// tenant_admins may not carry branch_id in the generated types yet; read it
// defensively so the UI works whether or not the column is typed.
type TenantAdminWithBranch = TenantAdmin & { branch_id?: string | null };

interface RoleMeta {
  value: UserRole;
  label: string;
  description: string;
}

// Ordered by seniority so the approval ladder reads top-down.
const ROLES: RoleMeta[] = [
  { value: 'institution_admin', label: 'Institution Admin', description: 'Full control of this institution.' },
  { value: 'head_office_admin', label: 'Head Office Admin', description: 'Oversees all branches; final approvals.' },
  { value: 'branch_manager', label: 'Branch Manager', description: 'Manages a branch and reviews transactions.' },
  { value: 'finance_officer', label: 'Finance Officer', description: 'Approves financial operations and postings.' },
  { value: 'accountant', label: 'Accountant', description: 'Manages ledger, journals, and reconciliation.' },
  { value: 'compliance_officer', label: 'Compliance Officer', description: 'Reviews flagged and high-value transactions.' },
  { value: 'loan_officer', label: 'Loan Officer', description: 'Handles loan applications and repayments.' },
  { value: 'forex_officer', label: 'Forex Officer', description: 'Manages forex rates and deals.' },
  { value: 'teller', label: 'Teller', description: 'Processes day-to-day customer transactions.' },
  { value: 'cashier', label: 'Cashier', description: 'Handles cash in/out at the counter.' },
  { value: 'customer_service', label: 'Customer Service', description: 'Manages customers and KYC.' },
  { value: 'auditor', label: 'Auditor', description: 'Read-only access for audit and review.' },
];

// Roles that inherently see every branch; they are NOT tied to a single branch.
// Every other role is branch-scoped and must be assigned to a branch so that
// branch users only access their own branch's data.
const ALL_BRANCH_ROLES = new Set<UserRole | 'super_admin'>([
  'super_admin' as UserRole,
  'institution_admin',
  'head_office_admin',
]);

function isAllBranchRole(role: string): boolean {
  return ALL_BRANCH_ROLES.has(role as UserRole);
}

const ROLE_LABELS: Record<string, string> = ROLES.reduce(
  (acc, r) => {
    acc[r.value] = r.label;
    return acc;
  },
  { super_admin: 'Super Admin' } as Record<string, string>
);

function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Supabase client errors are plain objects, not Error instances — surface the
// most useful field so the UI shows the real reason instead of a generic one.
function supabaseErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  const e = err as { message?: string; details?: string; hint?: string } | null;
  return e?.message || e?.details || e?.hint || fallback;
}

// Detects the "branch_id column doesn't exist yet" case — a PostgREST schema
// cache miss (PGRST204) or Postgres undefined_column (42703) — so we can save
// the rest of the record and warn instead of failing the whole update.
function isMissingBranchColumn(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  const msg = (e?.message || '').toLowerCase();
  return (
    e?.code === 'PGRST204' ||
    e?.code === '42703' ||
    (msg.includes('branch_id') && (msg.includes('column') || msg.includes('schema')))
  );
}

interface InviteForm {
  full_name: string;
  email: string;
  phone: string;
  role: UserRole;
  branch_id: string;
}

const EMPTY_FORM: InviteForm = {
  full_name: '',
  email: '',
  phone: '',
  role: 'teller',
  branch_id: '',
};

export function UsersRolesPage() {
  const { tenant, admin, branches } = useAuth();

  const [members, setMembers] = useState<TenantAdminWithBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'inactive'>('all');
  const [branchFilter, setBranchFilter] = useState<'all' | string>('all');

  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState<TenantAdminWithBranch | null>(null);
  const [formData, setFormData] = useState<InviteForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Only admins who own the institution may manage users.
  const canManage =
    admin?.role === 'super_admin' ||
    admin?.role === 'institution_admin' ||
    admin?.role === 'head_office_admin';

  const activeBranches = useMemo(
    () => branches.filter((b) => b.status === 'active' || b.status === undefined),
    [branches]
  );

  const branchName = useCallback(
    (id: string | null | undefined): string => {
      if (!id) return 'All branches';
      const b = branches.find((br) => br.id === id);
      return b ? b.name : 'Unknown branch';
    },
    [branches]
  );

  const loadMembers = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from('tenant_admins')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setMembers((data ?? []) as TenantAdminWithBranch[]);
    } catch (err) {
      console.error('Error loading team members:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load team members');
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return members.filter((m) => {
      const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
      const matchesBranch =
        branchFilter === 'all' ||
        (branchFilter === 'none' ? !m.branch_id : m.branch_id === branchFilter);
      const matchesSearch =
        q === '' ||
        m.full_name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        roleLabel(m.role).toLowerCase().includes(q) ||
        branchName(m.branch_id).toLowerCase().includes(q);
      return matchesStatus && matchesBranch && matchesSearch;
    });
  }, [members, searchQuery, statusFilter, branchFilter, branchName]);

  const validateForm = (): string | null => {
    if (!formData.full_name.trim()) return 'Full name is required.';
    if (!formData.email.trim()) return 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      return 'Please enter a valid email address.';
    }
    if (!isAllBranchRole(formData.role) && !formData.branch_id) {
      return 'Please assign a branch for this branch-level role.';
    }
    if (!editingMember) {
      const exists = members.some(
        (m) => m.email.trim().toLowerCase() === formData.email.trim().toLowerCase()
      );
      if (exists) return 'A team member with this email already exists.';
    }
    return null;
  };

  const openInvite = () => {
    setEditingMember(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
    setNotice(null);
    setShowForm(true);
  };

  const openEdit = (member: TenantAdminWithBranch) => {
    setEditingMember(member);
    setFormData({
      full_name: member.full_name,
      email: member.email,
      phone: member.phone ?? '',
      role: member.role,
      branch_id: member.branch_id ?? '',
    });
    setFormError(null);
    setNotice(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingMember(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
    setNotice(null);
  };

  // When the selected role becomes an all-branch role, clear the branch so we
  // don't persist a stale branch assignment.
  const handleRoleChange = (role: UserRole) => {
    setFormData((prev) => ({
      ...prev,
      role,
      branch_id: isAllBranchRole(role) ? '' : prev.branch_id,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!tenant) {
      setFormError('No institution context found. Please sign in again.');
      return;
    }
    if (!canManage) {
      setFormError('You do not have permission to manage users.');
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    // All-branch roles are never tied to a branch; branch-level roles carry
    // their assigned branch so their dashboard/data stays scoped to it.
    const resolvedBranchId = isAllBranchRole(formData.role) ? null : formData.branch_id || null;

    const MISSING_COLUMN_NOTICE =
      'Saved — but the branch assignment could not be stored because the tenant_admins.branch_id column is missing. ' +
      'Run the migration to add it, then re-save to enable branch scoping.';

    setSubmitting(true);
    setNotice(null);
    let hadNotice = false;
    try {
      if (editingMember) {
        // Editing: update name, phone, role, branch. Email is the identity key
        // and is locked once created (matching how the person signs in).
        const fullPayload = {
          full_name: formData.full_name.trim(),
          phone: formData.phone.trim() || null,
          role: formData.role,
          branch_id: resolvedBranchId,
        };

        let { error } = await supabase
          .from('tenant_admins')
          .update(fullPayload as never)
          .eq('id', editingMember.id)
          .eq('tenant_id', tenant.id);

        // If branch_id isn't in the schema yet, retry without it so the rest
        // of the record still saves, and flag the missing column.
        if (error && isMissingBranchColumn(error)) {
          const { branch_id: _omit, ...withoutBranch } = fullPayload;
          void _omit;
          const retry = await supabase
            .from('tenant_admins')
            .update(withoutBranch as never)
            .eq('id', editingMember.id)
            .eq('tenant_id', tenant.id);
          error = retry.error;
          if (!error) {
            hadNotice = true;
            setNotice(MISSING_COLUMN_NOTICE);
          }
        }
        if (error) throw error;
      } else {
        // Invite: create a pending tenant_admins row keyed by email, with no
        // user_id yet. The person gains access when they sign in with this
        // email and the app links their auth user to this row.
        const fullInsert = {
          tenant_id: tenant.id,
          user_id: null,
          email: formData.email.trim().toLowerCase(),
          full_name: formData.full_name.trim(),
          role: formData.role,
          phone: formData.phone.trim() || null,
          status: 'pending',
          branch_id: resolvedBranchId,
        };

        let { error } = await supabase
          .from('tenant_admins')
          .insert(fullInsert as InsertTables<'tenant_admins'>);

        if (error && isMissingBranchColumn(error)) {
          const { branch_id: _omit, ...withoutBranch } = fullInsert;
          void _omit;
          const retry = await supabase
            .from('tenant_admins')
            .insert(withoutBranch as InsertTables<'tenant_admins'>);
          error = retry.error;
          if (!error) {
            hadNotice = true;
            setNotice(
              'Invite created — but the branch assignment could not be stored because the ' +
                'tenant_admins.branch_id column is missing. Run the migration to add it.'
            );
          }
        }

        if (error) {
          if ((error as { code?: string }).code === '23505') {
            throw new Error('A team member with this email already exists.');
          }
          throw error;
        }

        // Send the invitation email via the send-invite Edge Function. This is
        // non-fatal: the pending member row already exists, so a mail failure
        // must not roll it back — we just tell the admin what happened.
        try {
          const inviteBranchName = isAllBranchRole(formData.role)
            ? 'All branches'
            : branches.find((b) => b.id === resolvedBranchId)?.name ?? null;
          const { error: mailError } = await supabase.functions.invoke('send-invite', {
            body: {
              email: formData.email.trim().toLowerCase(),
              full_name: formData.full_name.trim(),
              role: formData.role,
              branch_name: inviteBranchName,
            },
          });
          if (mailError) throw mailError;
        } catch (mailErr) {
          console.error('Invite email failed:', mailErr);
          hadNotice = true;
          setNotice(
            'Team member added, but the invitation email could not be sent (' +
              supabaseErrorMessage(mailErr, 'unknown error') +
              '). They can still sign in with this email to gain access.'
          );
        }
      }

      await loadMembers();
      // Keep the modal open when we surfaced a non-fatal notice so the user
      // sees why branch assignment didn't persist; otherwise close.
      if (!hadNotice) closeForm();
    } catch (err) {
      console.error('Error saving team member:', err);
      setFormError(supabaseErrorMessage(err, 'Failed to save team member'));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (member: TenantAdminWithBranch) => {
    if (!tenant || !canManage) return;
    // Guard: an admin cannot deactivate their own account (locking themselves out).
    if (member.id === admin?.id) {
      setLoadError('You cannot deactivate your own account.');
      return;
    }
    setTogglingId(member.id);
    try {
      const nextStatus = member.status === 'active' ? 'inactive' : 'active';
      const { error } = await supabase
        .from('tenant_admins')
        .update({ status: nextStatus })
        .eq('id', member.id)
        .eq('tenant_id', tenant.id);
      if (error) throw error;
      await loadMembers();
    } catch (err) {
      console.error('Error updating status:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setTogglingId(null);
    }
  };

  const statusBadge = (status: TenantAdmin['status']) => {
    const map: Record<TenantAdmin['status'], { cls: string; icon: React.ReactNode }> = {
      active: { cls: 'bg-[#1ebcb2]/10 text-[#1ebcb2]', icon: <CheckCircle className="w-3.5 h-3.5" /> },
      pending: { cls: 'bg-[#ee7b22]/10 text-[#ee7b22]', icon: <Clock className="w-3.5 h-3.5" /> },
      inactive: { cls: 'bg-slate-100 text-slate-500', icon: <Ban className="w-3.5 h-3.5" /> },
    };
    const s = map[status];
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium capitalize ${s.cls}`}>
        {s.icon}
        {status}
      </span>
    );
  };

  const initials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const counts = useMemo(
    () => ({
      total: members.length,
      active: members.filter((m) => m.status === 'active').length,
      pending: members.filter((m) => m.status === 'pending').length,
    }),
    [members]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#641f60]">Users &amp; Roles</h1>
          <p className="text-slate-600 mt-1">Manage team members, their roles, and branch access</p>
        </div>
        {canManage && (
          <button
            onClick={openInvite}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all"
          >
            <Plus className="w-5 h-5" />
            Invite User
          </button>
        )}
      </div>

      {!canManage && (
        <div className="bg-[#641f60]/5 border border-[#641f60]/20 rounded-xl p-4 text-sm text-[#641f60] flex items-start gap-3">
          <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>You have view-only access here. Only institution and head-office admins can invite or modify users.</p>
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
            onClick={loadMembers}
            className="px-4 py-2 bg-[#ee7b22] hover:bg-[#c46040] text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-[#641f60]/10">
            <Users className="w-6 h-6 text-[#641f60]" />
          </div>
          <div>
            <p className="text-sm text-slate-500">Total Members</p>
            <p className="text-2xl font-bold text-slate-900">{counts.total}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-[#1ebcb2]/10">
            <CheckCircle className="w-6 h-6 text-[#1ebcb2]" />
          </div>
          <div>
            <p className="text-sm text-slate-500">Active</p>
            <p className="text-2xl font-bold text-slate-900">{counts.active}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-[#ee7b22]/10">
            <Clock className="w-6 h-6 text-[#ee7b22]" />
          </div>
          <div>
            <p className="text-sm text-slate-500">Pending Invites</p>
            <p className="text-2xl font-bold text-slate-900">{counts.pending}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, role, or branch..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
            />
          </div>
          {branches.length > 1 && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
            >
              <option value="all">All Branches</option>
              <option value="none">All-branch roles</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Members list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#641f60]" />
          </div>
        ) : filteredMembers.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filteredMembers.map((member) => {
              const isSelf = member.id === admin?.id;
              const allBranch = isAllBranchRole(member.role);
              return (
                <div
                  key={member.id}
                  className={`px-6 py-4 hover:bg-slate-50 transition-colors ${
                    member.status === 'inactive' ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
                    <div className="w-11 h-11 rounded-full bg-[#641f60] flex items-center justify-center text-white font-medium flex-shrink-0">
                      {initials(member.full_name || member.email)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-slate-900 truncate">{member.full_name}</h3>
                        {isSelf && (
                          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">You</span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5" />
                        {member.email}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium flex-shrink-0 ${
                        allBranch ? 'bg-[#641f60]/10 text-[#641f60]' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      {allBranch ? 'All branches' : branchName(member.branch_id)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#641f60]/10 text-[#641f60] flex-shrink-0">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {roleLabel(member.role)}
                    </span>
                    {statusBadge(member.status)}
                    {canManage && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => openEdit(member)}
                          className="p-2 rounded-lg text-slate-400 hover:text-[#641f60] hover:bg-slate-100 transition-colors"
                          aria-label="Edit member"
                        >
                          <Pencil className="w-5 h-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleStatus(member)}
                          disabled={togglingId === member.id || isSelf}
                          title={isSelf ? 'You cannot deactivate your own account' : undefined}
                          className="p-2 rounded-lg text-slate-400 hover:text-[#c46040] hover:bg-slate-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          aria-label={member.status === 'active' ? 'Deactivate' : 'Activate'}
                        >
                          {togglingId === member.id ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : member.status === 'active' ? (
                            <Ban className="w-5 h-5" />
                          ) : (
                            <CheckCircle className="w-5 h-5" />
                          )}
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
              <UserCog className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No team members found</h3>
            <p className="text-slate-500 text-center max-w-sm">
              {searchQuery || statusFilter !== 'all' || branchFilter !== 'all'
                ? 'No members match your search or filter.'
                : 'Invite your first team member to get started.'}
            </p>
            {canManage && !searchQuery && statusFilter === 'all' && branchFilter === 'all' && (
              <button
                type="button"
                onClick={openInvite}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg transition-colors"
              >
                <Plus className="w-5 h-5" />
                Invite First User
              </button>
            )}
          </div>
        )}
      </div>

      {/* Invite / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-[#641f60]">
                {editingMember ? 'Edit Team Member' : 'Invite Team Member'}
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
              {!editingMember && (
                <div className="p-3 bg-[#641f60]/5 border border-[#641f60]/20 rounded-lg text-sm text-[#641f60] flex items-start gap-2">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  The invited person gains access when they sign up or sign in using this exact email address.
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, full_name: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  placeholder="Jane Achieng"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  disabled={!!editingMember}
                  value={formData.email}
                  onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500"
                  placeholder="jane@institution.com"
                />
                {editingMember && (
                  <p className="text-xs text-slate-400 mt-1">
                    Email is the sign-in identity and cannot be changed.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  placeholder="+254..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role *</label>
                <select
                  value={formData.role}
                  onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  {ROLES.find((r) => r.value === formData.role)?.description}
                </p>
              </div>

              {/* Branch assignment — only for branch-level roles. All-branch
                  roles (institution / head office) see every branch. */}
              {isAllBranchRole(formData.role) ? (
                <div className="p-3 bg-[#1ebcb2]/5 border border-[#1ebcb2]/20 rounded-lg text-sm text-slate-600 flex items-start gap-2">
                  <Building2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#1ebcb2]" />
                  This role has access to <span className="font-medium">all branches</span> and isn&rsquo;t tied to a single one.
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Branch *</label>
                  <select
                    value={formData.branch_id}
                    onChange={(e) => setFormData((prev) => ({ ...prev, branch_id: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  >
                    <option value="">Select a branch</option>
                    {activeBranches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                        {b.is_head_office ? ' (HQ)' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-400 mt-1">
                    This user will only be able to access and manage this branch&rsquo;s data.
                  </p>
                </div>
              )}

              {notice && (
                <div className="p-3 bg-[#ee7b22]/10 border border-[#ee7b22]/30 rounded-lg text-[#8a4a12] text-sm flex items-start gap-2">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#ee7b22]" />
                  <span>{notice}</span>
                </div>
              )}

              {formError && (
                <div className="p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm">
                  {formError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
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
                  ) : editingMember ? (
                    <>
                      <Pencil className="w-5 h-5" />
                      Save Changes
                    </>
                  ) : (
                    <>
                      <Mail className="w-5 h-5" />
                      Send Invite
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