import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import type { Tenant } from '../../types';
import { count, shortDate, label } from './platformFormat';
import {
  Building2,
  Search,
  AlertCircle,
  RefreshCw,
  Loader2,
  X,
  CheckCircle,
  PauseCircle,
  PlayCircle,
  Users,
  UsersRound,
  GitBranch,
  MoreHorizontal,
  ArrowUpDown,
  Save,
  Pencil,
} from 'lucide-react';

interface TenantRow extends Tenant {
  branchCount: number;
  userCount: number;
  customerCount: number;
}

type SortKey = 'name' | 'plan' | 'status' | 'customers' | 'joined';

const PLANS = ['starter', 'professional', 'enterprise'] as const;
const STATUSES = ['active', 'suspended', 'archived'] as const;

const STATUS_STYLE: Record<string, { dot: string; pill: string }> = {
  active: { dot: 'bg-emerald-500', pill: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  suspended: { dot: 'bg-amber-500', pill: 'text-amber-700 bg-amber-50 border-amber-200' },
  archived: { dot: 'bg-slate-400', pill: 'text-slate-600 bg-slate-100 border-slate-200' },
};

function planClass(plan: string): string {
  return plan === 'enterprise'
    ? 'bg-[#641f60]/10 text-[#641f60] border-[#641f60]/20'
    : plan === 'professional'
    ? 'bg-[#1ebcb2]/10 text-[#0f766e] border-[#1ebcb2]/30'
    : 'bg-slate-100 text-slate-600 border-slate-200';
}

/**
 * Every subscribing institution.
 *
 * The console can edit an institution's name, plan and status. It cannot
 * create or delete one: institutions self-register through signup, and
 * inserting one here would skip onboarding, branch setup and the owner's
 * admin account, leaving a broken tenant. Suspension is reversible; deletion
 * would not be.
 */
export function PlatformInstitutions() {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TenantRow | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('joined');
  const [sortAsc, setSortAsc] = useState(false);

  // Edit form state (name + plan + status)
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', plan: 'starter', status: 'active' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadTenants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });
      if (qErr) throw qErr;

      const list = (data ?? []) as Tenant[];
      const withCounts = await Promise.all(
        list.map(async (t) => {
          const [b, u, c] = await Promise.all([
            supabase.from('branches').select('id', { count: 'exact', head: true }).eq('tenant_id', t.id),
            supabase.from('tenant_admins').select('id', { count: 'exact', head: true }).eq('tenant_id', t.id),
            supabase.from('customers').select('id', { count: 'exact', head: true }).eq('tenant_id', t.id),
          ]);
          return {
            ...t,
            branchCount: b.count ?? 0,
            userCount: u.count ?? 0,
            customerCount: c.count ?? 0,
          } as TenantRow;
        })
      );
      setTenants(withCounts);
    } catch (err) {
      console.error('Error loading institutions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load institutions');
      setTenants([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  useEffect(() => {
    if (!detail) return;
    const updated = tenants.find((t) => t.id === detail.id);
    if (updated) setDetail(updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenants]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = tenants.filter((t) => {
      const matchesSearch =
        q === '' || t.name.toLowerCase().includes(q) || (t.slug ?? '').toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
    const dir = sortAsc ? 1 : -1;
    return [...rows].sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return a.name.localeCompare(b.name) * dir;
        case 'plan':
          return a.plan.localeCompare(b.plan) * dir;
        case 'status':
          return a.status.localeCompare(b.status) * dir;
        case 'customers':
          return (a.customerCount - b.customerCount) * dir;
        case 'joined':
        default:
          return (
            (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir
          );
      }
    });
  }, [tenants, search, statusFilter, sortKey, sortAsc]);

  const setStatus = async (tenant: Tenant, status: string) => {
    setBusyId(tenant.id);
    setMenuId(null);
    setError(null);
    try {
      const { error: uErr } = await supabase
        .from('tenants')
        .update({ status: status as Tenant['status'] })
        .eq('id', tenant.id);
      if (uErr) throw uErr;
      await loadTenants();
    } catch (err) {
      console.error('Error updating institution:', err);
      setError(err instanceof Error ? err.message : 'Failed to update institution');
    } finally {
      setBusyId(null);
    }
  };

  const openEdit = (t: TenantRow) => {
    setForm({ name: t.name, plan: t.plan, status: t.status });
    setFormError(null);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!detail) return;
    if (!form.name.trim()) {
      setFormError('Institution name is required.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const { error: uErr } = await supabase
        .from('tenants')
        .update({
          name: form.name.trim(),
          plan: form.plan as Tenant['plan'],
          status: form.status as Tenant['status'],
        })
        .eq('id', detail.id);
      if (uErr) throw uErr;
      await loadTenants();
      setEditing(false);
    } catch (err) {
      console.error('Error saving institution:', err);
      setFormError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const Th = ({ text, sortAs, right }: { text: string; sortAs?: SortKey; right?: boolean }) => (
    <th
      className={`px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 ${
        right ? 'text-right' : 'text-left'
      } ${sortAs ? 'cursor-pointer select-none hover:text-slate-800' : ''}`}
      onClick={sortAs ? () => toggleSort(sortAs) : undefined}
    >
      <span className={`inline-flex items-center gap-1 ${right ? 'flex-row-reverse' : ''}`}>
        {text}
        {sortAs && (
          <ArrowUpDown className={`w-3 h-3 ${sortKey === sortAs ? 'text-[#ee7b22]' : 'text-slate-300'}`} />
        )}
      </span>
    </th>
  );

  const totals = useMemo(
    () => ({
      active: tenants.filter((t) => t.status === 'active').length,
      suspended: tenants.filter((t) => t.status === 'suspended').length,
      customers: tenants.reduce((s, t) => s + t.customerCount, 0),
    }),
    [tenants]
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Institutions</h1>
          <p className="text-[15px] text-slate-500 mt-1">
            Every organisation subscribed to Trust Seed
          </p>
        </div>
        <button
          onClick={loadTenants}
          disabled={loading}
          className="px-4 py-2 border border-slate-300 bg-white rounded-md hover:bg-slate-50 transition-colors flex items-center gap-2 text-sm text-slate-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <p className="text-sm text-rose-800 flex-1">{error}</p>
          <button
            onClick={loadTenants}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-md"
          >
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200 border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-white px-6 py-5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Total</div>
          <p className="text-3xl font-bold text-slate-900 mt-2 tabular-nums">{count(tenants.length)}</p>
        </div>
        <div className="bg-white px-6 py-5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Active</div>
          <p className="text-3xl font-bold text-emerald-600 mt-2 tabular-nums">{count(totals.active)}</p>
        </div>
        <div className="bg-white px-6 py-5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Suspended</div>
          <p
            className={`text-2xl font-bold mt-1.5 tabular-nums ${
              totals.suspended > 0 ? 'text-amber-600' : 'text-slate-900'
            }`}
          >
            {count(totals.suspended)}
          </p>
        </div>
        <div className="bg-white px-6 py-5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            End customers
          </div>
          <p className="text-3xl font-bold text-slate-900 mt-2 tabular-nums">
            {count(totals.customers)}
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or slug..."
              className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md text-[15px] focus:outline-none focus:ring-2 focus:ring-[#ee7b22]/40 focus:border-[#ee7b22]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-md text-[15px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#ee7b22]/40"
          >
            <option value="all">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
          <span className="text-sm text-slate-400 whitespace-nowrap">{count(filtered.length)} shown</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <Th text="Institution" sortAs="name" />
                  <Th text="Plan" sortAs="plan" />
                  <Th text="Status" sortAs="status" />
                  <Th text="Branches" right />
                  <Th text="Staff" right />
                  <Th text="Customers" sortAs="customers" right />
                  <Th text="Joined" sortAs="joined" right />
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((t) => {
                  const st = STATUS_STYLE[t.status] ?? STATUS_STYLE.archived;
                  return (
                    <tr
                      key={t.id}
                      className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                      onClick={() => setDetail(t)}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${st.dot}`} />
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 text-[15px] truncate max-w-[200px]">
                              {t.name}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate">{t.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded border text-xs font-semibold capitalize ${planClass(
                            t.plan
                          )}`}
                        >
                          {t.plan}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded border text-xs font-semibold capitalize ${st.pill}`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-[15px] text-slate-600 tabular-nums">
                        {count(t.branchCount)}
                      </td>
                      <td className="px-5 py-3.5 text-right text-[15px] text-slate-600 tabular-nums">
                        {count(t.userCount)}
                      </td>
                      <td className="px-5 py-3.5 text-right text-[15px] font-semibold text-slate-900 tabular-nums">
                        {count(t.customerCount)}
                      </td>
                      <td className="px-5 py-3.5 text-right text-[13px] text-slate-400 tabular-nums">
                        {shortDate(t.created_at)}
                      </td>
                      <td
                        className="px-3 py-3.5 relative"
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => setMenuId(menuId === t.id ? null : t.id)}
                          disabled={busyId === t.id}
                          className="p-1.5 rounded text-slate-300 hover:text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50 group-hover:text-slate-400"
                          aria-label="Actions"
                        >
                          {busyId === t.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <MoreHorizontal className="w-4 h-4" />
                          )}
                        </button>
                        {menuId === t.id && (
                          <div className="absolute right-2 top-9 w-48 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden z-30 py-1">
                            <button
                              onClick={() => {
                                setMenuId(null);
                                setDetail(t);
                                openEdit(t);
                              }}
                              className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Edit details
                            </button>
                            {t.status === 'active' ? (
                              <button
                                onClick={() => setStatus(t, 'suspended')}
                                className="w-full px-3 py-2 text-left text-sm text-amber-700 hover:bg-amber-50 flex items-center gap-2"
                              >
                                <PauseCircle className="w-3.5 h-3.5" />
                                Suspend access
                              </button>
                            ) : (
                              <button
                                onClick={() => setStatus(t, 'active')}
                                className="w-full px-3 py-2 text-left text-sm text-emerald-700 hover:bg-emerald-50 flex items-center gap-2"
                              >
                                <PlayCircle className="w-3.5 h-3.5" />
                                Reactivate
                              </button>
                            )}
                          </div>
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
            <Building2 className="w-10 h-10 text-slate-300 mb-3" />
            <h3 className="text-sm font-semibold text-slate-900 mb-1">No institutions found</h3>
            <p className="text-sm text-slate-500 text-center max-w-sm">
              {search || statusFilter !== 'all'
                ? 'Nothing matches the current search or filter.'
                : 'Institutions appear here as they subscribe.'}
            </p>
          </div>
        )}
      </div>

      {/* Detail modal — centred dialog. Stats stay visible while editing, so
          the numbers you are deciding against don't disappear behind a form. */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => {
              setDetail(null);
              setEditing(false);
            }}
          />
          <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl max-h-[88vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#641f60] to-[#4a1646] flex items-center justify-center text-white flex-shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-bold text-slate-900 truncate">{detail.name}</h2>
                  <p className="text-xs text-slate-500 truncate">{detail.slug}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setDetail(null);
                  setEditing(false);
                }}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex-shrink-0"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-5 overflow-y-auto">
              {/* Stats — always visible, including while editing */}
              <div className="grid grid-cols-3 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-white px-3 py-3 text-center">
                  <GitBranch className="w-4 h-4 text-slate-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-slate-900 text-[15px] tabular-nums">
                    {count(detail.branchCount)}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">Branches</p>
                </div>
                <div className="bg-white px-3 py-3 text-center">
                  <Users className="w-4 h-4 text-slate-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-slate-900 text-[15px] tabular-nums">
                    {count(detail.userCount)}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">Staff</p>
                </div>
                <div className="bg-white px-3 py-3 text-center">
                  <UsersRound className="w-4 h-4 text-slate-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-slate-900 text-[15px] tabular-nums">
                    {count(detail.customerCount)}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">Customers</p>
                </div>
              </div>

              {/* Read-only facts — also always visible */}
              <dl className="space-y-0 divide-y divide-slate-100 border-y border-slate-100">
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-sm text-slate-500">Onboarding</dt>
                  <dd className="text-sm text-slate-900">
                    {detail.onboarding_completed ? 'Completed' : label(detail.onboarding_phase)}
                  </dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-sm text-slate-500">Joined</dt>
                  <dd className="text-sm text-slate-900 tabular-nums">
                    {shortDate(detail.created_at)}
                  </dd>
                </div>
              </dl>

              {editing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Institution name
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#ee7b22]/40 focus:border-[#ee7b22]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Plan</label>
                      <select
                        value={form.plan}
                        onChange={(e) => setForm((p) => ({ ...p, plan: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm capitalize focus:outline-none focus:ring-2 focus:ring-[#ee7b22]/40"
                      >
                        {PLANS.map((p) => (
                          <option key={p} value={p}>
                            {label(p)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
                      <select
                        value={form.status}
                        onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm capitalize focus:outline-none focus:ring-2 focus:ring-[#ee7b22]/40"
                      >
                        {STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {label(st)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {formError && (
                    <div className="px-3 py-2 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-700">
                      {formError}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block px-2 py-0.5 rounded border text-xs font-semibold capitalize ${planClass(
                      detail.plan
                    )}`}
                  >
                    {detail.plan}
                  </span>
                  <span
                    className={`inline-block px-2 py-0.5 rounded border text-xs font-semibold capitalize ${
                      (STATUS_STYLE[detail.status] ?? STATUS_STYLE.archived).pill
                    }`}
                  >
                    {detail.status}
                  </span>
                </div>
              )}

              <p className="text-[11px] text-slate-400 leading-relaxed">
                The console can suspend, reactivate and change an institution&rsquo;s plan. It cannot
                delete an institution or read its customers&rsquo; financial records.
              </p>
            </div>

            {/* Footer actions — always reachable, outside the scroll area */}
            <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center gap-2 flex-shrink-0">
              {editing ? (
                <>
                  <button
                    onClick={() => setEditing(false)}
                    className="flex-1 px-3 py-2 border border-slate-300 bg-white text-slate-700 text-sm font-medium rounded-md hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={saving}
                    className="flex-1 px-3 py-2 bg-[#ee7b22] hover:bg-[#c46040] text-white text-sm font-semibold rounded-md flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save changes
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => openEdit(detail)}
                    className="px-3 py-2 border border-slate-300 bg-white text-slate-700 text-sm font-medium rounded-md hover:bg-slate-100 flex items-center gap-2"
                  >
                    <Pencil className="w-4 h-4" />
                    Edit
                  </button>
                  {detail.status === 'active' ? (
                    <button
                      onClick={() => setStatus(detail, 'suspended')}
                      disabled={busyId === detail.id}
                      className="px-3 py-2 border border-amber-300 bg-white text-amber-700 hover:bg-amber-50 text-sm font-medium rounded-md flex items-center gap-2 disabled:opacity-50"
                    >
                      <PauseCircle className="w-4 h-4" />
                      Suspend
                    </button>
                  ) : (
                    <button
                      onClick={() => setStatus(detail, 'active')}
                      disabled={busyId === detail.id}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-md flex items-center gap-2 disabled:opacity-50"
                    >
                      <PlayCircle className="w-4 h-4" />
                      Reactivate
                    </button>
                  )}
                  <button
                    onClick={() => setDetail(null)}
                    className="ml-auto px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-md"
                  >
                    Done
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}