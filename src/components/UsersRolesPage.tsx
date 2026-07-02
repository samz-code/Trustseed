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
} from 'lucide-react';

type TenantAdmin = Tables<'tenant_admins'>;

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

interface InviteForm {
  full_name: string;
  email: string;
  phone: string;
  role: UserRole;
}

const EMPTY_FORM: InviteForm = {
  full_name: '',
  email: '',
  phone: '',
  role: 'teller',
};

export function UsersRolesPage() {
  const { tenant, admin } = useAuth();

  const [members, setMembers] = useState<TenantAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'inactive'>('all');

  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState<TenantAdmin | null>(null);
  const [formData, setFormData] = useState<InviteForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Only admins who own the institution may manage users.
  const canManage =
    admin?.role === 'super_admin' ||
    admin?.role === 'institution_admin' ||
    admin?.role === 'head_office_admin';

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
      setMembers(data ?? []);
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
      const matchesSearch =
        q === '' ||
        m.full_name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        roleLabel(m.role).toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [members, searchQuery, statusFilter]);

  const validateForm = (): string | null => {
    if (!formData.full_name.trim()) return 'Full name is required.';
    if (!formData.email.trim()) return 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      return 'Please enter a valid email address.';
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
    setShowForm(true);
  };

  const openEdit = (member: TenantAdmin) => {
    setEditingMember(member);
    setFormData({
      full_name: member.full_name,
      email: member.email,
      phone: member.phone ?? '',
      role: member.role,
    });
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingMember(null);
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
    if (!canManage) {
      setFormError('You do not have permission to manage users.');
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      if (editingMember) {
        // Editing: update name, phone, role. Email is the identity key and is
        // locked once created (matching how the person signs in).
        const { error } = await supabase
          .from('tenant_admins')
          .update({
            full_name: formData.full_name.trim(),
            phone: formData.phone.trim() || null,
            role: formData.role,
          })
          .eq('id', editingMember.id)
          .eq('tenant_id', tenant.id);
        if (error) throw error;
      } else {
        // Invite: create a pending tenant_admins row keyed by email, with no
        // user_id yet. The person gains access when they sign in with this
        // email and the app links their auth user to this row.
        const insert: InsertTables<'tenant_admins'> = {
          tenant_id: tenant.id,
          user_id: null,
          email: formData.email.trim().toLowerCase(),
          full_name: formData.full_name.trim(),
          role: formData.role,
          phone: formData.phone.trim() || null,
          status: 'pending',
        };
        const { error } = await supabase.from('tenant_admins').insert(insert);
        if (error) {
          if ((error as { code?: string }).code === '23505') {
            throw new Error('A team member with this email already exists.');
          }
          throw error;
        }
      }

      await loadMembers();
      closeForm();
    } catch (err) {
      console.error('Error saving team member:', err);
      setFormError(err instanceof Error ? err.message : 'Failed to save team member');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (member: TenantAdmin) => {
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
          <p className="text-slate-600 mt-1">Manage team members and their access levels</p>
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
              placeholder="Search by name, email, or role..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
            />
          </div>
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
              return (
                <div
                  key={member.id}
                  className={`px-6 py-4 hover:bg-slate-50 transition-colors ${
                    member.status === 'inactive' ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#641f60] to-[#4a1646] flex items-center justify-center text-white font-medium flex-shrink-0">
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
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#641f60]/10 text-[#641f60]">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {roleLabel(member.role)}
                    </span>
                    {statusBadge(member.status)}
                    {canManage && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => openEdit(member)}
                          className="p-2 rounded-lg text-slate-400 hover:text-[#641f60] hover:bg-slate-100 transition-colors"
                          aria-label="Edit member"
                        >
                          <Pencil className="w-5 h-5" />
                        </button>
                        <button
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
              {searchQuery || statusFilter !== 'all'
                ? 'No members match your search or filter.'
                : 'Invite your first team member to get started.'}
            </p>
            {canManage && !searchQuery && statusFilter === 'all' && (
              <button
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
                  onChange={(e) => setFormData((prev) => ({ ...prev, role: e.target.value as UserRole }))}
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