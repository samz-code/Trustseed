import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { PlatformAdmin, PlatformRole } from '../../types';
import { shortDate, label } from './platformFormat';
import {
  ShieldCheck,
  Plus,
  AlertCircle,
  RefreshCw,
  Loader2,
  X,
  UserCheck,
  UserX,
  Crown,
  Shield,
  Headphones,
  MoreHorizontal,
  Trash2,
  Save,
  Info,
} from 'lucide-react';

const ROLE_META: Record<
  PlatformRole,
  { label: string; icon: React.ReactNode; desc: string; pill: string }
> = {
  platform_owner: {
    label: 'Platform Owner',
    icon: <Crown className="w-3.5 h-3.5" />,
    desc: 'Full control, including managing platform admins',
    pill: 'bg-[#641f60]/10 text-[#641f60] border-[#641f60]/20',
  },
  platform_admin: {
    label: 'Platform Admin',
    icon: <Shield className="w-3.5 h-3.5" />,
    desc: 'Manage institutions and subscriptions',
    pill: 'bg-[#1ebcb2]/10 text-[#0f766e] border-[#1ebcb2]/30',
  },
  platform_support: {
    label: 'Platform Support',
    icon: <Headphones className="w-3.5 h-3.5" />,
    desc: 'View institutions for support purposes',
    pill: 'bg-slate-100 text-slate-600 border-slate-200',
  },
};

const ROLES = Object.keys(ROLE_META) as PlatformRole[];

/**
 * Trust Seed staff with console access.
 *
 * Only a platform_owner may add, edit or remove admins. That is enforced by
 * the platform_admins RLS policies via is_platform_owner(), not merely by
 * hiding buttons here: a non-owner calling the API directly is still refused.
 *
 * Removal IS permitted on this table, unlike billing records: a platform
 * admin row is only an access grant, so deleting it destroys no history and
 * is fully reversible by re-adding the person.
 */
export function PlatformAdmins() {
  const { platformAdmin } = useAuth();
  const [admins, setAdmins] = useState<PlatformAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<{ email: string; full_name: string; role: PlatformRole }>({
    email: '',
    full_name: '',
    role: 'platform_admin',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<PlatformAdmin | null>(null);

  const isOwner = platformAdmin?.role === 'platform_owner';

  const loadAdmins = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from('platform_admins')
        .select('*')
        .order('created_at', { ascending: true });
      if (qErr) throw qErr;
      setAdmins((data ?? []) as PlatformAdmin[]);
    } catch (err) {
      console.error('Error loading platform admins:', err);
      setError(err instanceof Error ? err.message : 'Failed to load platform admins');
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ email: '', full_name: '', role: 'platform_admin' });
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (a: PlatformAdmin) => {
    setEditingId(a.id);
    setForm({ email: a.email, full_name: a.full_name, role: a.role });
    setFormError(null);
    setShowForm(true);
    setMenuId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const email = form.email.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormError('Enter a valid email address.');
      return;
    }
    if (!form.full_name.trim()) {
      setFormError('Enter a full name.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingId) {
        // UPDATE — email is not changed here, since it must stay matched to
        // the underlying auth user.
        const { error: uErr } = await supabase
          .from('platform_admins')
          .update({ full_name: form.full_name.trim(), role: form.role })
          .eq('id', editingId);
        if (uErr) throw uErr;
      } else {
        // CREATE — resolve the email to an existing auth user first. The
        // browser cannot query auth.users, so this goes through a
        // SECURITY DEFINER function that returns only an id, only to
        // platform admins.
        const { data: lookupData, error: lookupErr } = await supabase.rpc(
          'lookup_auth_user_id_by_email',
          { p_email: email }
        );
        if (lookupErr) throw lookupErr;

        const resolvedUserId =
          typeof lookupData === 'string'
            ? lookupData
            : (lookupData as { id?: string } | null)?.id ?? null;

        if (!resolvedUserId) {
          setFormError(
            `No Trust Seed account exists for ${email}. Ask them to sign up first, then add them here.`
          );
          setSubmitting(false);
          return;
        }

        const { error: insertErr } = await supabase.from('platform_admins').insert({
          user_id: resolvedUserId,
          email,
          full_name: form.full_name.trim(),
          role: form.role,
          status: 'active',
        });
        if (insertErr) {
          if ((insertErr as { code?: string }).code === '23505') {
            throw new Error('That user already has platform access.');
          }
          throw insertErr;
        }
      }

      await loadAdmins();
      setShowForm(false);
    } catch (err) {
      console.error('Error saving platform admin:', err);
      setFormError(err instanceof Error ? err.message : 'Failed to save platform admin');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (a: PlatformAdmin) => {
    if (a.user_id === platformAdmin?.user_id) {
      setError('You cannot deactivate your own platform account.');
      return;
    }
    setBusyId(a.id);
    setMenuId(null);
    setError(null);
    try {
      const { error: uErr } = await supabase
        .from('platform_admins')
        .update({ status: a.status === 'active' ? 'inactive' : 'active' })
        .eq('id', a.id);
      if (uErr) throw uErr;
      await loadAdmins();
    } catch (err) {
      console.error('Error updating platform admin:', err);
      setError(err instanceof Error ? err.message : 'Failed to update platform admin');
    } finally {
      setBusyId(null);
    }
  };

  const removeAdmin = async (a: PlatformAdmin) => {
    if (a.user_id === platformAdmin?.user_id) {
      setError('You cannot remove your own platform access.');
      setConfirmDelete(null);
      return;
    }
    setBusyId(a.id);
    setError(null);
    try {
      const { error: dErr } = await supabase.from('platform_admins').delete().eq('id', a.id);
      if (dErr) throw dErr;
      await loadAdmins();
      setConfirmDelete(null);
    } catch (err) {
      console.error('Error removing platform admin:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove platform admin');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Platform Admins</h1>
          <p className="text-[15px] text-slate-500 mt-1">Trust Seed staff with access to this console</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadAdmins}
            disabled={loading}
            className="px-4 py-2 border border-slate-300 bg-white rounded-md hover:bg-slate-50 transition-colors flex items-center gap-2 text-sm text-slate-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {isOwner && (
            <button
              onClick={openCreate}
              className="px-3 py-1.5 bg-[#ee7b22] hover:bg-[#c46040] text-white text-sm font-semibold rounded-md shadow-sm transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add admin
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <p className="text-sm text-rose-800 flex-1">{error}</p>
          <button
            onClick={() => setError(null)}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-md"
          >
            Dismiss
          </button>
        </div>
      )}

      {!isOwner && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-slate-600">
            View-only access. Only a Platform Owner can add, edit or remove platform admins.
          </p>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : admins.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Name
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Role
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Status
                  </th>
                  <th className="px-5 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Added
                  </th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {admins.map((a) => {
                  const meta = ROLE_META[a.role] ?? ROLE_META.platform_support;
                  const isSelf = a.user_id === platformAdmin?.user_id;
                  return (
                    <tr key={a.id} className="hover:bg-slate-50/70 transition-colors group">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#641f60] to-[#4a1646] flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                            {a.full_name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .toUpperCase()
                              .slice(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 text-[15px] truncate">
                              {a.full_name}
                              {isSelf && (
                                <span className="ml-1.5 text-[10px] font-normal text-slate-400">
                                  (you)
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">{a.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-semibold ${meta.pill}`}
                        >
                          {meta.icon}
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                            a.status === 'active' ? 'text-emerald-600' : 'text-slate-400'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              a.status === 'active' ? 'bg-emerald-500' : 'bg-slate-300'
                            }`}
                          />
                          {label(a.status)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-[13px] text-slate-400 tabular-nums">
                        {shortDate(a.created_at)}
                      </td>
                      <td className="px-3 py-3.5 relative">
                        {isOwner && !isSelf && (
                          <>
                            <button
                              onClick={() => setMenuId(menuId === a.id ? null : a.id)}
                              disabled={busyId === a.id}
                              className="p-1.5 rounded text-slate-300 hover:text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50 group-hover:text-slate-400"
                              aria-label="Actions"
                            >
                              {busyId === a.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="w-4 h-4" />
                              )}
                            </button>
                            {menuId === a.id && (
                              <div className="absolute right-2 top-9 w-44 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden z-30 py-1">
                                <button
                                  onClick={() => openEdit(a)}
                                  className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                  Edit
                                </button>
                                <button
                                  onClick={() => toggleStatus(a)}
                                  className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                >
                                  {a.status === 'active' ? (
                                    <>
                                      <UserX className="w-3.5 h-3.5" />
                                      Deactivate
                                    </>
                                  ) : (
                                    <>
                                      <UserCheck className="w-3.5 h-3.5" />
                                      Activate
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={() => {
                                    setMenuId(null);
                                    setConfirmDelete(a);
                                  }}
                                  className="w-full px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50 flex items-center gap-2"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Remove access
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <ShieldCheck className="w-10 h-10 text-slate-300 mb-3" />
            <h3 className="text-sm font-semibold text-slate-900 mb-1">No platform admins</h3>
            <p className="text-sm text-slate-500 text-center max-w-sm">
              Add Trust Seed staff to grant access to this console.
            </p>
          </div>
        )}
      </div>

      {/* Add / edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="font-bold text-slate-900">
                {editingId ? 'Edit platform admin' : 'Add platform admin'}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
                <input
                  type="email"
                  required
                  disabled={!!editingId}
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#ee7b22]/40 focus:border-[#ee7b22] disabled:bg-slate-50 disabled:text-slate-500"
                  placeholder="staff@trustseed.co.ke"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  {editingId
                    ? 'Email is fixed: it is matched to the underlying account.'
                    : 'The person must already have a Trust Seed account.'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Full name</label>
                <input
                  type="text"
                  required
                  value={form.full_name}
                  onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#ee7b22]/40 focus:border-[#ee7b22]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Role</label>
                <div className="space-y-1.5">
                  {ROLES.map((r) => {
                    const meta = ROLE_META[r];
                    const active = form.role === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, role: r }))}
                        className={`w-full flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-all ${
                          active
                            ? 'border-[#ee7b22] bg-[#ee7b22]/[0.06] ring-1 ring-[#ee7b22]/20'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span className={`mt-0.5 ${active ? 'text-[#ee7b22]' : 'text-slate-400'}`}>
                          {meta.icon}
                        </span>
                        <span className="min-w-0">
                          <span
                            className={`block text-sm font-semibold ${
                              active ? 'text-slate-900' : 'text-slate-700'
                            }`}
                          >
                            {meta.label}
                          </span>
                          <span className="block text-[11px] text-slate-500 leading-snug">
                            {meta.desc}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {formError && (
                <div className="px-3 py-2 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-700">
                  {formError}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-3 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-3 py-2 bg-[#ee7b22] hover:bg-[#c46040] text-white text-sm font-semibold rounded-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : editingId ? (
                    <Save className="w-4 h-4" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  {editingId ? 'Save changes' : 'Add admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-5">
            <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center mb-3">
              <Trash2 className="w-5 h-5 text-rose-600" />
            </div>
            <h2 className="font-bold text-slate-900 mb-1">Remove platform access?</h2>
            <p className="text-sm text-slate-600 mb-4">
              <strong>{confirmDelete.full_name}</strong> will lose access to the platform console
              immediately. Their Trust Seed account is not deleted, and you can grant access again
              later.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-3 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => removeAdmin(confirmDelete)}
                disabled={busyId === confirmDelete.id}
                className="flex-1 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-md flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {busyId === confirmDelete.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}