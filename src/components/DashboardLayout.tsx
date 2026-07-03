import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  LayoutDashboard,
  Users,
  Wallet,
  ArrowRightLeft,
  PiggyBank,
  Receipt,
  Calculator,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Bell,
  Search,
  Building,
  Banknote,
  Globe,
  Clock,
  UserCog,
  CheckCheck,
  Inbox,
  Wallet2,
} from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

interface NavChild {
  label: string;
  path: string;
  icon?: React.ReactNode;
}

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path?: string;
  children?: NavChild[];
}

interface NotificationRow {
  id: string;
  title: string;
  message: string | null;
  created_at: string;
  read_at: string | null;
}

const navigationItems: NavItem[] = [
  {
    label: 'Dashboard',
    icon: <LayoutDashboard className="w-5 h-5" />,
    path: 'dashboard',
  },
  {
    label: 'Customers',
    icon: <Users className="w-5 h-5" />,
    path: 'customers',
  },
  {
    label: 'Wallets',
    icon: <Wallet className="w-5 h-5" />,
    path: 'wallets',
  },
  {
    label: 'Transactions',
    icon: <ArrowRightLeft className="w-5 h-5" />,
    children: [
      { label: 'All Transactions', path: 'transactions' },
      { label: 'Money Transfers', path: 'transfers' },
      { label: 'Forex', path: 'forex', icon: <Globe className="w-4 h-4" /> },
      { label: 'Pending Approvals', path: 'approvals', icon: <Clock className="w-4 h-4" /> },
    ],
  },
  {
    label: 'Loans',
    icon: <Banknote className="w-5 h-5" />,
    children: [
      { label: 'Loan Products', path: 'loan-products' },
      { label: 'Applications', path: 'loan-applications' },
      { label: 'Active Loans', path: 'loans' },
      { label: 'Repayments', path: 'repayments' },
    ],
  },
  {
    label: 'Savings',
    icon: <PiggyBank className="w-5 h-5" />,
    children: [
      { label: 'Savings Products', path: 'savings-products' },
      { label: 'Accounts', path: 'savings-accounts' },
    ],
  },
  {
    label: 'Expenses',
    icon: <Wallet2 className="w-5 h-5" />,
    path: 'expenses',
  },
  {
    label: 'Float',
    icon: <Receipt className="w-5 h-5" />,
    path: 'float',
  },
  {
    label: 'Operations',
    icon: <Building className="w-5 h-5" />,
    children: [
      { label: 'Daily Opening', path: 'daily-opening' },
      { label: 'Daily Closing', path: 'daily-closing' },
      { label: 'Branch Transfers', path: 'branch-transfers' },
    ],
  },
  {
    label: 'Accounting',
    icon: <Calculator className="w-5 h-5" />,
    children: [
      { label: 'Chart of Accounts', path: 'chart-of-accounts' },
      { label: 'Journal Entries', path: 'journals' },
      { label: 'General Ledger', path: 'ledger' },
      { label: 'Trial Balance', path: 'trial-balance' },
    ],
  },
  {
    label: 'Reports',
    icon: <FileText className="w-5 h-5" />,
    path: 'reports',
  },
  {
    label: 'Users & Roles',
    icon: <UserCog className="w-5 h-5" />,
    path: 'users-roles',
  },
  {
    label: 'Settings',
    icon: <Settings className="w-5 h-5" />,
    path: 'settings',
  },
];

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const { admin, tenant, branch, branches, signOut, setBranch } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState('dashboard');

  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  // Assumes a `notifications` table scoped by tenant_id, optionally by
  // admin_id for per-user notices. Adjust the `.eq(...)` filters below to
  // match your actual schema once notifications are being written somewhere.
  const loadNotifications = useCallback(async () => {
    if (!tenant) return;
    setNotifLoading(true);
    setNotifError(null);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, title, message, created_at, read_at')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      setNotifications(data ?? []);
    } catch (err) {
      console.error('Error loading notifications:', err);
      setNotifError(err instanceof Error ? err.message : 'Failed to load notifications');
      setNotifications([]);
    } finally {
      setNotifLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Close the notifications dropdown when clicking outside it.
  useEffect(() => {
    if (!notifOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [notifOpen]);

  const markAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n))
    );
    try {
      // Cast: `notifications` isn't in the generated Supabase types yet.
      // Regenerate types once the table exists, then this cast can go away.
      const { error } = await (supabase.from('notifications') as any)
        .update({ read_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read_at).map((n) => n.id);
    if (unreadIds.length === 0) return;
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    try {
      // Cast: `notifications` isn't in the generated Supabase types yet.
      const { error } = await (supabase.from('notifications') as any)
        .update({ read_at: now })
        .in('id', unreadIds);
      if (error) throw error;
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const toggleExpanded = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label) ? prev.filter((i) => i !== label) : [...prev, label]
    );
  };

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'super_admin':
      case 'institution_admin':
        return 'bg-[#641f60]/10 text-[#641f60]';
      case 'branch_manager':
        return 'bg-[#1ebcb2]/10 text-[#1ebcb2]';
      case 'compliance_officer':
        return 'bg-amber-100 text-amber-700';
      case 'finance_officer':
      case 'accountant':
        return 'bg-[#ee7b22]/10 text-[#ee7b22]';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const handleNavigation = (path: string) => {
    setCurrentPath(path);
    setSidebarOpen(false);
    window.dispatchEvent(new CustomEvent('navigate', { detail: path }));
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-[#641f60] text-white transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/20">
          <div className="min-w-0 flex-1">
         
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-3 overflow-y-auto h-[calc(100%-160px)]">
          <ul className="space-y-1">
            {navigationItems.map((item) => (
              <li key={item.label}>
                {item.children ? (
                  <>
                    <button
                      onClick={() => toggleExpanded(item.label)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all ${
                        expandedItems.includes(item.label)
                          ? 'bg-white/10 text-white'
                          : 'text-white/70 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {item.icon}
                        <span className="font-medium">{item.label}</span>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${
                          expandedItems.includes(item.label) ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {expandedItems.includes(item.label) && (
                      <ul className="mt-1 ml-8 space-y-1">
                        {item.children.map((child) => (
                          <li key={child.path}>
                            <button
                              onClick={() => handleNavigation(child.path)}
                              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                                currentPath === child.path
                                  ? 'bg-[#ee7b22] text-white'
                                  : 'text-white/60 hover:bg-white/10 hover:text-white'
                              }`}
                            >
                              {child.icon}
                              {child.label}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => handleNavigation(item.path || '')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                      currentPath === item.path
                        ? 'bg-[#ee7b22] text-white'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {item.icon}
                    <span className="font-medium">{item.label}</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/20">
          <button
            onClick={() => {
              signOut();
              navigate('/');
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/70 hover:bg-[#c46040]/20 hover:text-white transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top header */}
        <header className="sticky top-0 z-30 bg-white border-b border-[#dae1e1] shadow-sm">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Open sidebar"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search customers, transactions..."
                  className="w-80 pl-10 pr-4 py-2 bg-slate-100 border border-[#dae1e1] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Branch selector */}
              {branches.length > 1 && (
                <div className="relative">
                  <button
                    onClick={() => setBranchDropdownOpen(!branchDropdownOpen)}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors"
                  >
                    <Building className="w-4 h-4" />
                    {branch?.name || 'Select Branch'}
                    <ChevronDown className="w-4 h-4" />
                  </button>

                  {branchDropdownOpen && (
                    <div className="absolute right-0 mt-1 w-56 bg-white border border-[#dae1e1] rounded-lg shadow-lg overflow-hidden">
                      {branches.map((b) => (
                        <button
                          key={b.id}
                          onClick={() => {
                            setBranch(b);
                            setBranchDropdownOpen(false);
                          }}
                          className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center justify-between ${
                            b.id === branch?.id ? 'bg-[#1ebcb2]/10 text-[#1ebcb2]' : 'text-slate-700'
                          }`}
                        >
                          <span>{b.name}</span>
                          {b.is_head_office && (
                            <span className="text-xs bg-[#dae1e1] px-2 py-0.5 rounded text-slate-600">HQ</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Notifications */}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setNotifOpen((prev) => !prev)}
                  className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                  aria-label="Notifications"
                  aria-expanded={notifOpen}
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-[#c46040] rounded-full text-[10px] font-semibold text-white flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 mt-1 w-80 bg-white border border-[#dae1e1] rounded-lg shadow-lg overflow-hidden z-40">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="font-semibold text-slate-900 text-sm">Notifications</h3>
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllAsRead}
                          className="text-xs text-[#1ebcb2] hover:text-[#641f60] font-medium flex items-center gap-1 transition-colors"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          Mark all read
                        </button>
                      )}
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                      {notifLoading ? (
                        <div className="p-4 space-y-3">
                          {Array.from({ length: 3 }).map((_, idx) => (
                            <div key={idx} className="animate-pulse">
                              <div className="h-3.5 w-32 bg-slate-200 rounded mb-2" />
                              <div className="h-3 w-48 bg-slate-100 rounded" />
                            </div>
                          ))}
                        </div>
                      ) : notifError ? (
                        <div className="p-4 text-sm text-[#c46040]">{notifError}</div>
                      ) : notifications.length === 0 ? (
                        <div className="py-10 text-center px-4">
                          <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p className="text-sm text-slate-500">No notifications yet</p>
                        </div>
                      ) : (
                        <ul className="divide-y divide-slate-100">
                          {notifications.map((n) => (
                            <li key={n.id}>
                              <button
                                onClick={() => markAsRead(n.id)}
                                className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${
                                  !n.read_at ? 'bg-[#1ebcb2]/5' : ''
                                }`}
                              >
                                <div className="flex items-start gap-2">
                                  {!n.read_at && (
                                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#ee7b22] flex-shrink-0" />
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-slate-900 truncate">{n.title}</p>
                                    {n.message && (
                                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                                    )}
                                    <p className="text-xs text-slate-400 mt-1">{timeAgo(n.created_at)}</p>
                                  </div>
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* User menu */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#ee7b22] flex items-center justify-center text-white font-medium">
                  {admin?.full_name ? getInitials(admin.full_name) : 'U'}
                </div>
                <div className="hidden md:block text-right">
                  <p className="font-medium text-slate-900 text-sm">{admin?.full_name || 'User'}</p>
                  <p className={`text-xs px-2 py-0.5 rounded-full inline-block ${getRoleBadgeColor(admin?.role || '')}`}>
                    {admin?.role?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'User'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}