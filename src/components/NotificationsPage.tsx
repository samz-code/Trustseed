import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Bell,
  Inbox,
  RefreshCw,
  AlertCircle,
  CheckCheck,
  Search,
  Loader2,
  MessageSquare,
  Mail,
  Smartphone,
  Monitor,
  Clock,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Send,
  ChevronRight,
  Filter,
} from 'lucide-react';

// ============================================================================
// Two distinct things share this page.
//
// `notifications` addresses staff: approval requests, system notices, anything
// an admin needs to see. It is what the bell in the header reads.
//
// `customer_notifications` is the outbound message queue: what the institution
// has sent, or is about to send, to its customers over SMS and email. An
// operator asking "did that repayment SMS actually go out" looks here.
//
// They are kept as separate tabs rather than merged because the questions they
// answer are different, and merging would put a customer's SMS delivery
// failure in the same list as a pending approval.
// ============================================================================

type TabId = 'staff' | 'customer';

interface StaffNotification {
  id: string;
  title: string;
  message: string | null;
  type: string | null;
  link_path: string | null;
  read_at: string | null;
  created_at: string;
}

interface CustomerNotification {
  id: string;
  customer_id: string | null;
  event_key: string;
  channel: 'sms' | 'email' | 'in_app';
  recipient: string | null;
  subject: string | null;
  body: string;
  status: 'queued' | 'sending' | 'sent' | 'failed' | 'skipped';
  attempts: number;
  provider: string | null;
  provider_message_id: string | null;
  error_message: string | null;
  reference_type: string | null;
  reference_id: string | null;
  queued_at: string;
  sent_at: string | null;
  created_at: string;
}

interface CustomerLite {
  id: string;
  customer_type: string | null;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
  customer_number: string | null;
}

const PAGE_SIZE = 50;

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Math.max(0, Date.now() - then);

  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(iso).toLocaleDateString();
}

function customerLabel(c: CustomerLite | undefined): string {
  if (!c) return 'Unknown customer';
  if (c.customer_type && c.customer_type !== 'individual') {
    return c.business_name || 'Unnamed business';
  }
  return `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unnamed';
}

function prettyEvent(key: string): string {
  return key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ----------------------------------------------------------------------------
// Status presentation.
//
// Colours follow the brand palette rather than generic green/red so the page
// sits with the rest of the app. Skipped is deliberately muted: it is not a
// failure, it is a customer who opted out or has no number on file.
// ----------------------------------------------------------------------------

const STATUS_META: Record<
  CustomerNotification['status'],
  { label: string; icon: React.ReactNode; className: string }
> = {
  queued: {
    label: 'Queued',
    icon: <Clock className="w-3.5 h-3.5" />,
    className: 'bg-slate-100 text-slate-600',
  },
  sending: {
    label: 'Sending',
    icon: <Send className="w-3.5 h-3.5" />,
    className: 'bg-[#ee7b22]/15 text-[#c46040]',
  },
  sent: {
    label: 'Sent',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    className: 'bg-[#1ebcb2]/15 text-[#159089]',
  },
  failed: {
    label: 'Failed',
    icon: <XCircle className="w-3.5 h-3.5" />,
    className: 'bg-[#c46040]/15 text-[#c46040]',
  },
  skipped: {
    label: 'Skipped',
    icon: <MinusCircle className="w-3.5 h-3.5" />,
    className: 'bg-slate-100 text-slate-400',
  },
};

const CHANNEL_META: Record<
  CustomerNotification['channel'],
  { label: string; icon: React.ReactNode }
> = {
  sms: { label: 'SMS', icon: <Smartphone className="w-4 h-4" /> },
  email: { label: 'Email', icon: <Mail className="w-4 h-4" /> },
  in_app: { label: 'In-app', icon: <Monitor className="w-4 h-4" /> },
};

export function NotificationsPage() {
  const { tenant, admin } = useAuth();

  const [tab, setTab] = useState<TabId>('staff');

  // Staff notifications
  const [staff, setStaff] = useState<StaffNotification[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [staffFilter, setStaffFilter] = useState<'all' | 'unread'>('all');

  // Customer message log
  const [customerRows, setCustomerRows] = useState<CustomerNotification[]>([]);
  const [customerMap, setCustomerMap] = useState<Map<string, CustomerLite>>(new Map());
  const [custLoading, setCustLoading] = useState(false);
  const [custError, setCustError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  // --------------------------------------------------------------------
  // Staff notifications.
  //
  // Mirrors the header dropdown's query: tenant-wide rows (admin_id null)
  // plus anything addressed to this admin. If rows exist in the table but
  // none appear here, the usual cause is an RLS policy that only permits
  // admin_id = auth.uid() and therefore hides the tenant-wide rows.
  // --------------------------------------------------------------------
  const loadStaff = useCallback(async () => {
    if (!tenant) return;
    setStaffLoading(true);
    setStaffError(null);
    try {
      let query = supabase
        .from('notifications')
        .select('id, title, message, type, link_path, read_at, created_at')
        .eq('tenant_id', tenant.id);

      query = admin?.id
        ? query.or(`admin_id.is.null,admin_id.eq.${admin.id}`)
        : query.is('admin_id', null);

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (error) throw error;
      setStaff((data ?? []) as StaffNotification[]);
    } catch (err) {
      console.error('Error loading staff notifications:', err);
      const message = err instanceof Error ? err.message : 'Failed to load notifications';
      if (/relation .* does not exist/i.test(message)) {
        setStaffError('The notifications table does not exist yet in your database.');
      } else {
        setStaffError(message);
      }
      setStaff([]);
    } finally {
      setStaffLoading(false);
    }
  }, [tenant, admin?.id]);

  // --------------------------------------------------------------------
  // Customer message log.
  //
  // Customer names are resolved in a second batched query rather than a
  // join, because the generated Supabase types do not yet know about
  // customer_notifications and an embedded select would not type.
  // --------------------------------------------------------------------
  const loadCustomer = useCallback(async () => {
    if (!tenant) return;
    setCustLoading(true);
    setCustError(null);
    try {
      let query = (supabase.from('customer_notifications') as any)
        .select('*')
        .eq('tenant_id', tenant.id);

      // No branch filter. Member messages are a tenant-level record: many
      // carry no branch_id at all, and filtering on the selected branch made
      // them invisible with no indication why. Filtering, when needed, is
      // done through the controls above rather than silently by header state.
      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      if (channelFilter !== 'all') query = query.eq('channel', channelFilter);

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (error) throw error;

      const rows = (data ?? []) as CustomerNotification[];
      setCustomerRows(rows);

      const ids = Array.from(
        new Set(rows.map((r) => r.customer_id).filter((v): v is string => Boolean(v)))
      );

      if (ids.length > 0) {
        const { data: custs, error: cErr } = await supabase
          .from('customers')
          .select('id, customer_type, first_name, last_name, business_name, customer_number')
          .in('id', ids);

        if (cErr) throw cErr;

        const map = new Map<string, CustomerLite>();
        (custs ?? []).forEach((c: CustomerLite) => map.set(c.id, c));
        setCustomerMap(map);
      } else {
        setCustomerMap(new Map());
      }
    } catch (err) {
      console.error('Error loading customer notifications:', err);
      const message = err instanceof Error ? err.message : 'Failed to load message log';
      if (/relation .* does not exist/i.test(message)) {
        setCustError(
          'The customer_notifications table does not exist yet. Run the notification system migration first.'
        );
      } else {
        setCustError(message);
      }
      setCustomerRows([]);
    } finally {
      setCustLoading(false);
    }
  }, [tenant, statusFilter, channelFilter]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  useEffect(() => {
    if (tab === 'customer') loadCustomer();
  }, [tab, loadCustomer]);

  const unreadCount = useMemo(() => staff.filter((n) => !n.read_at).length, [staff]);

  const visibleStaff = useMemo(
    () => (staffFilter === 'unread' ? staff.filter((n) => !n.read_at) : staff),
    [staff, staffFilter]
  );

  const visibleCustomer = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customerRows;
    return customerRows.filter((r) => {
      const name = customerLabel(customerMap.get(r.customer_id ?? '')).toLowerCase();
      return (
        name.includes(q) ||
        (r.recipient ?? '').toLowerCase().includes(q) ||
        r.body.toLowerCase().includes(q) ||
        r.event_key.toLowerCase().includes(q)
      );
    });
  }, [customerRows, customerMap, search]);

  // Counts drive the summary strip. Computed from the loaded page rather than
  // a separate aggregate query, so they describe what is on screen.
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      queued: 0,
      sending: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
    };
    customerRows.forEach((r) => {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
    });
    return counts;
  }, [customerRows]);

  const markAsRead = async (id: string) => {
    const now = new Date().toISOString();
    setStaff((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? now } : n)));
    try {
      const { error } = await (supabase.from('notifications') as any)
        .update({ read_at: now })
        .eq('id', id)
        .is('read_at', null);
      if (error) throw error;
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = staff.filter((n) => !n.read_at).map((n) => n.id);
    if (unreadIds.length === 0) return;
    const now = new Date().toISOString();
    setStaff((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    try {
      const { error } = await (supabase.from('notifications') as any)
        .update({ read_at: now })
        .in('id', unreadIds);
      if (error) throw error;
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const navigateTo = (path: string) => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: path }));
  };

  const refresh = () => {
    if (tab === 'staff') loadStaff();
    else loadCustomer();
  };

  const busy = tab === 'staff' ? staffLoading : custLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#641f60]">Notifications</h1>
          <p className="text-slate-600 mt-1">
            Internal alerts and the outbound customer message log
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={busy}
          className="inline-flex items-center gap-2 px-4 py-2 border border-[#dae1e1] text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-[#dae1e1]">
        <div className="flex gap-6">
          <button
            onClick={() => setTab('staff')}
            className={`pb-3 -mb-px flex items-center gap-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'staff'
                ? 'border-[#641f60] text-[#641f60]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Bell className="w-4 h-4" />
            Staff alerts
            {unreadCount > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 bg-[#ee7b22] rounded-full text-[10px] font-semibold text-white flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('customer')}
            className={`pb-3 -mb-px flex items-center gap-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'customer'
                ? 'border-[#641f60] text-[#641f60]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Customer messages
          </button>
        </div>
      </div>

      {/* ================================================================ */}
      {/* STAFF ALERTS                                                      */}
      {/* ================================================================ */}
      {tab === 'staff' && (
        <div className="bg-white rounded-xl border border-[#dae1e1] overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStaffFilter('all')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  staffFilter === 'all'
                    ? 'bg-[#641f60] text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                All ({staff.length})
              </button>
              <button
                onClick={() => setStaffFilter('unread')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  staffFilter === 'unread'
                    ? 'bg-[#641f60] text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#1ebcb2] hover:bg-[#159089] text-white text-sm font-medium rounded-lg transition-colors"
              >
                <CheckCheck className="w-4 h-4" />
                Mark all read
              </button>
            )}
          </div>

          {staffLoading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 w-40 bg-slate-200 rounded mb-2" />
                  <div className="h-3 w-64 bg-slate-100 rounded" />
                </div>
              ))}
            </div>
          ) : staffError ? (
            <div className="p-6">
              <div className="flex items-start gap-3 text-sm text-[#c46040]">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{staffError}</span>
              </div>
              <button
                onClick={loadStaff}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 border border-slate-200 text-sm font-medium rounded-lg hover:bg-slate-50"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
            </div>
          ) : visibleStaff.length === 0 ? (
            <div className="py-16 text-center px-4">
              <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-900 mb-1">
                {staffFilter === 'unread' ? 'Nothing unread' : 'No notifications yet'}
              </h3>
              <p className="text-slate-500 text-sm">
                Approval requests and system alerts will appear here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {visibleStaff.map((n) => (
                <li
                  key={n.id}
                  className={`px-6 py-4 hover:bg-slate-50 transition-colors ${
                    !n.read_at ? 'bg-[#1ebcb2]/5' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                        !n.read_at ? 'bg-[#ee7b22]' : 'bg-transparent'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900">{n.title}</p>
                        <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">
                          {timeAgo(n.created_at)}
                        </span>
                      </div>
                      {n.message && (
                        <p className="text-sm text-slate-600 mt-1 leading-relaxed">{n.message}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        {n.type && (
                          <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded">
                            {prettyEvent(n.type)}
                          </span>
                        )}
                        {n.link_path && (
                          <button
                            onClick={() => {
                              markAsRead(n.id);
                              navigateTo(n.link_path!);
                            }}
                            className="text-xs font-medium text-[#1ebcb2] hover:text-[#641f60] inline-flex items-center gap-1 transition-colors"
                          >
                            Open
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                        {!n.read_at && (
                          <button
                            onClick={() => markAsRead(n.id)}
                            className="text-xs font-medium text-slate-400 hover:text-[#641f60] transition-colors"
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* CUSTOMER MESSAGE LOG                                              */}
      {/* ================================================================ */}
      {tab === 'customer' && (
        <div className="space-y-4">
          {/* Status summary. Reflects the loaded page, not the whole table. */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {(
              ['queued', 'sending', 'sent', 'failed', 'skipped'] as CustomerNotification['status'][]
            ).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
                className={`bg-white rounded-xl border p-4 text-left transition-colors ${
                  statusFilter === s
                    ? 'border-[#641f60] ring-1 ring-[#641f60]'
                    : 'border-[#dae1e1] hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                  {STATUS_META[s].icon}
                  <span className="text-xs font-medium">{STATUS_META[s].label}</span>
                </div>
                <p className="text-2xl font-bold text-[#641f60]">{statusCounts[s] ?? 0}</p>
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-[#dae1e1] overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search customer, number, or message..."
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value)}
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                >
                  <option value="all">All channels</option>
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                  <option value="in_app">In-app</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                >
                  <option value="all">All statuses</option>
                  <option value="queued">Queued</option>
                  <option value="sending">Sending</option>
                  <option value="sent">Sent</option>
                  <option value="failed">Failed</option>
                  <option value="skipped">Skipped</option>
                </select>
              </div>
            </div>

            {custLoading ? (
              <div className="py-16 flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 text-[#641f60] animate-spin mb-3" />
                <p className="text-sm text-slate-500">Loading message log...</p>
              </div>
            ) : custError ? (
              <div className="p-6">
                <div className="flex items-start gap-3 text-sm text-[#c46040]">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>{custError}</span>
                </div>
                <button
                  onClick={loadCustomer}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 border border-slate-200 text-sm font-medium rounded-lg hover:bg-slate-50"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry
                </button>
              </div>
            ) : visibleCustomer.length === 0 ? (
              <div className="py-16 text-center px-4">
                <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-slate-900 mb-1">No messages yet</h3>
                <p className="text-slate-500 text-sm max-w-md mx-auto">
                  Customer messages are queued automatically when a repayment, deposit, or other
                  notifiable event is recorded.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {visibleCustomer.map((r) => {
                  const meta = STATUS_META[r.status];
                  const chan = CHANNEL_META[r.channel];
                  const isOpen = expanded === r.id;

                  return (
                    <li key={r.id}>
                      <button
                        onClick={() => setExpanded(isOpen ? null : r.id)}
                        className="w-full text-left px-6 py-4 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 text-slate-400 flex-shrink-0">{chan.icon}</div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900 truncate">
                                  {customerLabel(customerMap.get(r.customer_id ?? ''))}
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  {prettyEvent(r.event_key)}
                                  {r.recipient ? ` · ${r.recipient}` : ''}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${meta.className}`}
                                >
                                  {meta.icon}
                                  {meta.label}
                                </span>
                              </div>
                            </div>

                            <p
                              className={`text-sm text-slate-600 mt-2 leading-relaxed ${
                                isOpen ? '' : 'line-clamp-2'
                              }`}
                            >
                              {r.body}
                            </p>

                            {r.error_message && (
                              <p className="text-xs text-[#c46040] mt-2 flex items-start gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                {r.error_message}
                              </p>
                            )}

                            {/* Delivery detail, revealed on click. Kept collapsed
                                because most of the time the operator only needs
                                to know whether it went. */}
                            {isOpen && (
                              <dl className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-xs border-t border-slate-100 pt-3">
                                <div>
                                  <dt className="text-slate-400">Channel</dt>
                                  <dd className="text-slate-700 font-medium">{chan.label}</dd>
                                </div>
                                <div>
                                  <dt className="text-slate-400">Attempts</dt>
                                  <dd className="text-slate-700 font-medium">{r.attempts}</dd>
                                </div>
                                <div>
                                  <dt className="text-slate-400">Queued</dt>
                                  <dd className="text-slate-700 font-medium">
                                    {new Date(r.queued_at).toLocaleString()}
                                  </dd>
                                </div>
                                {r.sent_at && (
                                  <div>
                                    <dt className="text-slate-400">Sent</dt>
                                    <dd className="text-slate-700 font-medium">
                                      {new Date(r.sent_at).toLocaleString()}
                                    </dd>
                                  </div>
                                )}
                                {r.provider && (
                                  <div>
                                    <dt className="text-slate-400">Provider</dt>
                                    <dd className="text-slate-700 font-medium">{r.provider}</dd>
                                  </div>
                                )}
                                {r.provider_message_id && (
                                  <div className="col-span-2">
                                    <dt className="text-slate-400">Provider reference</dt>
                                    <dd className="text-slate-700 font-medium break-all">
                                      {r.provider_message_id}
                                    </dd>
                                  </div>
                                )}
                                {r.subject && (
                                  <div className="col-span-full">
                                    <dt className="text-slate-400">Subject</dt>
                                    <dd className="text-slate-700 font-medium">{r.subject}</dd>
                                  </div>
                                )}
                              </dl>
                            )}
                          </div>
                          <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">
                            {timeAgo(r.created_at)}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Honest note about why everything says Queued. Without this the page
              reads as broken when it is in fact working exactly as built. */}
          {!custLoading && !custError && statusCounts.queued > 0 && statusCounts.sent === 0 && (
            <div className="bg-[#ee7b22]/10 border border-[#ee7b22]/30 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[#c46040] flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-[#c46040]">Messages are queued but not sending</p>
                <p className="text-slate-600 mt-1">
                  No delivery provider is configured yet, so messages accumulate here instead of
                  reaching customers. Configure an SMS provider and deploy the worker to start
                  sending.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}