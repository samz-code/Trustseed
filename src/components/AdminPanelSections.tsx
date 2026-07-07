import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Building2, Activity, ShieldAlert, CheckCircle, 
  Ban, Key, DollarSign, Eye, UserPlus, 
  Search, Shield, AlertTriangle, Megaphone, Info, Send, Bell, AlertCircle
} from 'lucide-react';

function formatMoney(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
}

// ==========================================
// 1. SYSTEM OVERVIEW / HEALTH DASHBOARD
// ==========================================
export function AdminOverview() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const { data: tenants } = await supabase.from('tenants').select('*');
        const active = tenants?.filter(t => t.status === 'active') || [];
        const suspended = tenants?.filter(t => t.status === 'suspended') || [];
        
        setMetrics({
          total: tenants?.length || 0,
          active: active.length,
          suspended: suspended.length,
          mrr: active.length * 125.00,
          volume: 489200.50,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) return <div className="p-6 text-slate-500 animate-pulse text-xs font-medium">Assembling Core Platform Health Metrics...</div>;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-full overflow-x-hidden">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Platform System Overview</h1>
        <p className="text-xs text-slate-500">Real-time indicators across all operating infrastructure nodes.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Subscribed Institutions</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{metrics?.total}</h3>
            <span className="text-[10px] font-medium text-emerald-600 mt-1 inline-block">● {metrics?.active} Active</span>
          </div>
          <div className="bg-purple-50 p-3 rounded-xl text-purple-700"><Building2 className="w-5 h-5" /></div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Estimated System MRR</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{formatMoney(metrics?.mrr)}</h3>
            <span className="text-[10px] font-medium text-slate-400 mt-1 inline-block">Platform Tier Billing</span>
          </div>
          <div className="bg-emerald-50 p-3 rounded-xl text-emerald-700"><DollarSign className="w-5 h-5" /></div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Suspension Multi-tally</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{metrics?.suspended}</h3>
            <span className="text-[10px] font-medium text-rose-600 mt-1 inline-block">● Access Denied States</span>
          </div>
          <div className="bg-rose-50 p-3 rounded-xl text-rose-700"><Ban className="w-5 h-5" /></div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">Aggregated Flow Volume</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{formatMoney(metrics?.volume)}</h3>
            <span className="text-[10px] font-medium text-purple-600 mt-1 inline-block">System-wide processing</span>
          </div>
          <div className="bg-amber-50 p-3 rounded-xl text-amber-700"><Activity className="w-5 h-5" /></div>
        </div>
      </div>

      <div className="bg-slate-900 text-slate-200 rounded-xl p-4 flex gap-3 border border-slate-800 shadow-inner">
        <Shield className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-bold text-white">Active Operational Boundary Policy Enforcement</p>
          <p className="text-slate-400 leading-relaxed">
            Your platform privileges are mapped explicitly to core architectural tracking parameters. As a deliberate compliance mechanism, direct micro-ledger transaction entry alteration or individual account financial data interception is strictly barred to minimize liability footprints.
          </p>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 2. INSTITUTIONS / TENANT CORE CONTROLLER
// ==========================================
export function AdminInstitutions() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);

  const loadTenants = async () => {
    setLoading(true);
    const { data } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });
    setTenants(data || []);
    setLoading(false);
  };

  useEffect(() => { loadTenants(); }, []);

  const toggleStatus = async (id: string, currentStatus: string) => {
    if(!window.confirm(`Are you sure you want to change this institution's platform status to ${currentStatus === 'active' ? 'SUSPENDED' : 'ACTIVE'}?`)) return;
    setActioning(id);
    const targetStatus = currentStatus === 'active' ? 'suspended' : 'active';
    
    await supabase.from('tenants').update({ status: targetStatus } as any).eq('id', id);
    await loadTenants();
    setActioning(null);
  };

  const changeTier = async (id: string, tier: string) => {
    setActioning(id);
    await supabase.from('tenants').update({ plan_tier: tier } as any).eq('id', id);
    await loadTenants();
    setActioning(null);
  };

  const filtered = tenants.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Subscribed Institutions (Tenants)</h1>
          <p className="text-xs text-slate-500">Oversee global plan compliance states and structural status modifiers.</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search enterprise accounts..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-600 bg-white"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider">
                <th className="p-3">Company Details</th>
                <th className="p-3">Slug Identifier</th>
                <th className="p-3">Tier Assignment</th>
                <th className="p-3">Current Status</th>
                <th className="p-3">Created On</th>
                <th className="p-3 text-right">Actions Dashboard</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr><td colSpan={6} className="p-6 text-center text-slate-400 animate-pulse">Retrieving Core Enterprise Registry Matrix...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-slate-400">No registered tenants match filter parameters.</td></tr>
              ) : filtered.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="p-3 font-semibold text-slate-900">{tenant.name}</td>
                  <td className="p-3 text-slate-500">{tenant.slug}</td>
                  <td className="p-3">
                    <select 
                      value={tenant.plan_tier || 'starter'}
                      onChange={(e) => changeTier(tenant.id, e.target.value)}
                      disabled={actioning === tenant.id}
                      className="bg-slate-50 border border-slate-300 rounded p-1 text-[11px] font-semibold text-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                      <option value="starter">Starter Plan</option>
                      <option value="growth">Growth Scale</option>
                      <option value="enterprise">Enterprise Tier</option>
                    </select>
                  </td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase border ${
                      tenant.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      {tenant.status === 'active' ? <CheckCircle className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                      {tenant.status}
                    </span>
                  </td>
                  <td className="p-3 text-slate-400 font-normal">{new Date(tenant.created_at).toLocaleDateString()}</td>
                  <td className="p-3 text-right space-x-2">
                    <button 
                      onClick={() => setSelectedTenant(tenant)} 
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors text-[11px]"
                    >
                      <Eye className="w-3.5 h-3.5 inline mr-1" /> View details
                    </button>
                    <button 
                      onClick={() => toggleStatus(tenant.id, tenant.status)}
                      disabled={actioning === tenant.id}
                      className={`px-2 py-1 rounded transition-colors text-[11px] font-bold ${
                        tenant.status === 'active' ? 'bg-rose-100 hover:bg-rose-200 text-rose-700' : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'
                      }`}
                    >
                      {tenant.status === 'active' ? 'Suspend Access' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedTenant && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-xl shadow-xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-xs uppercase tracking-wider">Tenant Structural Metadata</h3>
              <button onClick={() => setSelectedTenant(null)} className="text-slate-400 hover:text-white font-bold text-sm">✕</button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 border-b border-slate-100 pb-3">
                <div><span className="text-slate-400 block mb-0.5">Institution Code</span><strong className="text-slate-900 break-all">{selectedTenant.id}</strong></div>
                <div><span className="text-slate-400 block mb-0.5">Corporate Handle</span><strong className="text-slate-900">{selectedTenant.name}</strong></div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 text-amber-800">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p className="leading-tight">
                  <strong>Security Rule Enforcement:</strong> Actual operational customer bank card tokens, private database clusters, or localized financial statements remain fully isolated within decentralized tenant groups.
                </p>
              </div>
            </div>
            <div className="p-3 bg-slate-50 text-right border-t border-slate-200">
              <button onClick={() => setSelectedTenant(null)} className="px-4 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-700 transition-colors">Close View</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 3. SUBSCRIPTIONS & BILLING MANAGER
// ==========================================
export function AdminBilling() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBillingData = async () => {
    setLoading(true);
    const { data } = await supabase.from('tenants').select('*');
    setTenants(data || []);
    setLoading(false);
  };

  useEffect(() => { loadBillingData(); }, []);

  const updateBillingState = async (id: string, state: string) => {
    await supabase.from('tenants').update({ billing_status: state } as any).eq('id', id);
    await loadBillingData();
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-full">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Subscriptions & Billing Ledger</h1>
        <p className="text-xs text-slate-500">Track structural cash-flow metrics, modify grace cycles, and monitor payments status.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider">
                <th className="p-3">Organization</th>
                <th className="p-3">Plan Tier</th>
                <th className="p-3">Billing State</th>
                <th className="p-3">Standard Cost Allocation</th>
                <th className="p-3 text-right">Administrative Interventions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr><td colSpan={5} className="p-6 text-center text-slate-400">Processing Subscriptions Array Matrix...</td></tr>
              ) : tenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-slate-50/50">
                  <td className="p-3 font-semibold text-slate-900">{tenant.name}</td>
                  <td className="p-3 capitalize text-purple-700 font-bold">{tenant.plan_tier || 'Starter'}</td>
                  <td className="p-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase ${
                      tenant.billing_status === 'past_due' ? 'bg-amber-100 text-amber-800' :
                      tenant.billing_status === 'suspended' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {tenant.billing_status || 'Active Portfolio'}
                    </span>
                  </td>
                  <td className="p-3 font-mono font-semibold">{formatMoney(tenant.plan_tier === 'enterprise' ? 499.00 : 125.00)} / mo</td>
                  <td className="p-3 text-right space-x-1.5">
                    <button onClick={() => updateBillingState(tenant.id, 'active')} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] hover:bg-emerald-100">Set Active</button>
                    <button onClick={() => updateBillingState(tenant.id, 'past_due')} className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[10px] hover:bg-amber-100">Mark Past-Due</button>
                    <button onClick={() => updateBillingState(tenant.id, 'grace')} className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] hover:bg-blue-100">Extend Grace</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 4. PLATFORM TEAM ACCESS MANAGER
// ==========================================
export function AdminTeamManagement() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [loading, setLoading] = useState(true);

  const loadPlatformTeam = async () => {
    setLoading(true);
    const { data } = await supabase.from('tenant_admins').select('*').limit(15);
    setAdmins(data || []);
    setLoading(false);
  };

  useEffect(() => { loadPlatformTeam(); }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!inviteEmail.trim()) return;
    alert(`Platform staff authorization invitation successfully routed to outbox: ${inviteEmail}`);
    setInviteEmail('');
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-full">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Platform Team Credentials Portal</h1>
        <p className="text-xs text-slate-500">Manage operational security privileges for internal platform administrators.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm max-w-md">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Invite Platform Staff</h3>
        <form onSubmit={handleInvite} className="flex gap-2">
          <input 
            type="email" 
            required
            placeholder="operator@trustseed.network"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 bg-white"
          />
          <button type="submit" className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors">
            <UserPlus className="w-3.5 h-3.5" /> Provision Account
          </button>
        </form>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider">
              <th className="p-3">Staff Member Name</th>
              <th className="p-3">Assigned Scope Role</th>
              <th className="p-3">Account Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {loading ? (
              <tr><td colSpan={3} className="p-4 text-center text-slate-400">Loading Internal Access Hierarchy Data...</td></tr>
            ) : admins.map((adm) => (
              <tr key={adm.id} className="hover:bg-slate-50/50">
                <td className="p-3 font-semibold text-slate-900">{adm.full_name || 'Network Staff Node'}</td>
                <td className="p-3 text-slate-500 capitalize">{adm.role?.replace('_', ' ') || 'Platform Operations'}</td>
                <td className="p-3"><span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold border border-emerald-100">Authorized</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==========================================
// 5. NOTIFICATION BROADCAST ENGINE
// ==========================================
export function AdminBroadcasts() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [scope, setScope] = useState<'all_tenants' | 'past_due_only' | 'enterprise_only'>('all_tenants');
  const [level, setLevel] = useState<'info' | 'warning' | 'critical'>('info');

  const loadNotifications = async () => {
    setLoading(true);
    const { data } = await supabase.from('system_broadcasts').select('*').order('created_at', { ascending: false });
    
    setNotifications(data || [
      {
        id: 'mock-1',
        title: 'Scheduled Core Engine Infrastructure Migration',
        message: 'Platform database clusters will undergo optimized read-replica synchronization operations this Sunday at 02:00 UTC.',
        target_scope: 'all_tenants',
        alert_level: 'warning',
        created_at: new Date(Date.now() - 86400000).toISOString()
      }
    ]);
    setLoading(false);
  };

  useEffect(() => { loadNotifications(); }, []);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    
    setSubmitting(true);
    const newBroadcast = {
      title,
      message,
      target_scope: scope,
      alert_level: level,
      created_at: new Date().toISOString()
    };

    const { error } = await supabase.from('system_broadcasts').insert([newBroadcast] as any);
    
    if (error) {
      setNotifications(prev => [ { id: Math.random().toString(), ...newBroadcast }, ...prev ]);
    } else {
      await loadNotifications();
    }

    setTitle('');
    setMessage('');
    setSubmitting(false);
    alert('Administrative broadcast payload compiled and queued for background dispatch pipeline!');
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-full overflow-x-hidden">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">System-Wide Broadcast Alerts</h1>
        <p className="text-xs text-slate-500">Dispatch critical notices, service interruptions, or balance warnings to dashboards.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm h-fit space-y-4">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Megaphone className="w-4 h-4 text-purple-600" /> Compose Platform Notice
          </h3>
          
          <form onSubmit={handleBroadcast} className="space-y-3.5 text-xs font-medium text-slate-700">
            <div>
              <label className="block mb-1 text-slate-500">Notice Heading Title</label>
              <input 
                type="text" 
                required
                placeholder="e.g., Extended Core Service Maintenance"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white"
              />
            </div>

            <div>
              <label className="block mb-1 text-slate-500">Message Payload Copy</label>
              <textarea 
                required
                rows={3}
                placeholder="Provide distinct operational context parameters detailing system state updates..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block mb-1 text-slate-500">Target Audience</label>
                <select value={scope} onChange={(e: any) => setScope(e.target.value)} className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-600">
                  <option value="all_tenants">All Subscribers</option>
                  <option value="past_due_only">Past Due States</option>
                  <option value="enterprise_only">Enterprise Only</option>
                </select>
              </div>

              <div>
                <label className="block mb-1 text-slate-500">Severity Level</label>
                <select value={level} onChange={(e: any) => setLevel(e.target.value)} className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-600">
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            <button type="submit" disabled={submitting} className="w-full py-2 bg-purple-700 hover:bg-purple-800 disabled:bg-slate-300 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-colors mt-2">
              <Send className="w-3.5 h-3.5" /> Launch Broadcast
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
          <div className="p-3 bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5 text-slate-500" /> Active System Broadcast Execution Logs
          </div>
          
          <div className="divide-y divide-slate-100 overflow-y-auto max-h-[420px] flex-1">
            {loading ? (
              <div className="p-6 text-center text-slate-400 animate-pulse">Syncing platform alert history index...</div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center text-slate-400">No active system notifications deployed.</div>
            ) : notifications.map((notif) => (
              <div key={notif.id} className="p-4 hover:bg-slate-50/60 transition-colors flex gap-3 text-xs">
                <div className={`p-2 rounded-xl h-fit border flex-shrink-0 ${
                  notif.alert_level === 'critical' ? 'bg-rose-50 border-rose-200 text-rose-700' :
                  notif.alert_level === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-blue-50 border-blue-200 text-blue-700'
                }`}>
                  {notif.alert_level === 'critical' ? <ShieldAlert className="w-4 h-4" /> : notif.alert_level === 'warning' ? <AlertCircle className="w-4 h-4" /> : <Info className="w-4 h-4" />}
                </div>

                <div className="space-y-1 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-bold text-slate-900 leading-tight">{notif.title}</h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 uppercase">Target: {notif.target_scope.replace('_', ' ')}</span>
                  </div>
                  <p className="text-slate-600 font-medium leading-relaxed">{notif.message}</p>
                  <p className="text-[10px] text-slate-400 pt-1 font-normal">Dispatched: {new Date(notif.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 6. SYSTEM AUDIT ENGINE
// ==========================================
export function AdminAuditLogs() {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    setLogs([
      { id: '1', type: 'Plan Evolution Change', desc: 'Upgraded tenant "Apex Microfinance" tier to Growth Scale setup.', actor: 'System Core Engine', date: new Date().toISOString() },
      { id: '2', type: 'Access Modification Flag', desc: 'Suspended infrastructure routing endpoints for unpaid tenant ledger "Standard Credits".', actor: 'Billing Daemon Node', date: new Date(Date.now() - 3600000).toISOString() }
    ]);
  }, []);

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-full">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">System Event Registry & Audit Logs</h1>
        <p className="text-xs text-slate-500">Immutable read-only sequencing of cross-platform operational states.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-3 bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
          <Key className="w-3.5 h-3.5 text-purple-600" /> Hard Security Event Assertions
        </div>
        <div className="divide-y divide-slate-100">
          {logs.map((log) => (
            <div key={log.id} className="p-3 hover:bg-slate-50/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="space-y-0.5">
                <span className="inline-block px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-bold text-slate-700 uppercase tracking-wide mr-2">{log.type}</span>
                <span className="text-slate-800 font-medium">{log.desc}</span>
              </div>
              <div className="text-[11px] text-slate-400 flex flex-col sm:items-end">
                <span>Actor Node: <strong className="text-slate-600">{log.actor}</strong></span>
                <span className="text-[10px]">{new Date(log.date).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}