import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  FileText,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Circle,
} from 'lucide-react';
import { PlatformOverview } from './PlatformOverview';
import { PlatformInstitutions } from './PlatformInstitutions';
import { PlatformSubscriptions } from './PlatformSubscriptions';
import { PlatformInvoices } from './PlatformInvoices';
import { PlatformAdmins } from './PlatformAdmins';

export type PlatformPage =
  | 'overview'
  | 'institutions'
  | 'subscriptions'
  | 'invoices'
  | 'admins';

interface NavItem {
  id: PlatformPage;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const NAV_GROUPS: { heading: string; items: NavItem[] }[] = [
  {
    heading: 'Monitor',
    items: [
      {
        id: 'overview',
        label: 'Overview',
        icon: <LayoutDashboard className="w-5 h-5" />,
        description: 'Platform metrics',
      },
    ],
  },
  {
    heading: 'Manage',
    items: [
      {
        id: 'institutions',
        label: 'Institutions',
        icon: <Building2 className="w-5 h-5" />,
        description: 'Subscribing organisations',
      },
      {
        id: 'subscriptions',
        label: 'Subscriptions',
        icon: <CreditCard className="w-5 h-5" />,
        description: 'Billing and revenue',
      },
      {
        id: 'invoices',
        label: 'Invoices',
        icon: <FileText className="w-5 h-5" />,
        description: 'Billing records and receipts',
      },
    ],
  },
  {
    heading: 'Access',
    items: [
      {
        id: 'admins',
        label: 'Platform Admins',
        icon: <ShieldCheck className="w-5 h-5" />,
        description: 'Trust Seed staff',
      },
    ],
  },
];

const PAGE_TITLES: Record<PlatformPage, string> = {
  overview: 'Overview',
  institutions: 'Institutions',
  subscriptions: 'Subscriptions',
  invoices: 'Invoices',
  admins: 'Platform Admins',
};

/**
 * Trust Seed's own console: the platform owner's view across ALL subscribing
 * institutions. Rendered only when AuthContext confirms an active
 * platform_admins row. Cross-tenant data access is enforced by the
 * is_platform_admin() RLS policies in the database, not by this component.
 */
export function PlatformPortal() {
  const { platformAdmin, signOut } = useAuth();
  const [page, setPage] = useState<PlatformPage>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const roleLabel = (platformAdmin?.role ?? 'platform_admin')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const fullName = platformAdmin?.full_name ?? 'Platform Admin';
  const initials = fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const renderPage = () => {
    switch (page) {
      case 'overview':
        return <PlatformOverview />;
      case 'institutions':
        return <PlatformInstitutions />;
      case 'subscriptions':
        return <PlatformSubscriptions />;
      case 'invoices':
        return <PlatformInvoices />;
      case 'admins':
        return <PlatformAdmins />;
      default:
        return <PlatformOverview />;
    }
  };

  const go = (id: PlatformPage) => {
    setPage(id);
    setSidebarOpen(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Error signing out:', err);
    } finally {
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-[264px] bg-[#12172a] text-white flex flex-col transform transition-transform duration-200 ease-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="px-4 h-20 flex items-center justify-between border-b border-white/[0.06] flex-shrink-0">
          {/* Brand mark only — the logo carries the identity, so no wordmark
              or chip behind it. */}
          <img
            src="/logo-bg.png"
            alt="Trust Seed"
            className="h-14 w-auto max-w-[190px] object-contain object-left"
          />
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 rounded-md text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.heading}>
              <p className="px-2.5 mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white/30">
                {group.heading}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = page === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => go(item.id)}
                        className={`w-full group relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${
                          active
                            ? 'bg-white/[0.08] text-white'
                            : 'text-white/55 hover:bg-white/[0.04] hover:text-white/90'
                        }`}
                      >
                        {active && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r bg-[#ee7b22]" />
                        )}
                        <span className={active ? 'text-[#ee7b22]' : ''}>{item.icon}</span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[14px] font-medium leading-tight">
                            {item.label}
                          </span>
                        </span>
                        {active && <ChevronRight className="w-3.5 h-3.5 text-white/30" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer status */}
        <div className="px-3 py-3 border-t border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/[0.03]">
            <Circle className="w-2 h-2 fill-emerald-400 text-emerald-400 flex-shrink-0" />
            <span className="text-[11px] text-white/50">All systems operational</span>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200">
          <div className="h-20 px-5 sm:px-8 flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-md text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-[15px] min-w-0">
              <span className="text-slate-400 hidden sm:inline">Platform</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 hidden sm:inline" />
              <span className="font-semibold text-slate-900 truncate">{PAGE_TITLES[page]}</span>
            </div>

            {/* Account */}
            <div className="ml-auto relative" ref={accountRef}>
              <button
                onClick={() => setAccountOpen((v) => !v)}
                className="flex items-center gap-2.5 pl-2 pr-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#641f60] to-[#4a1646] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {initials}
                </div>
                <div className="text-left hidden sm:block leading-tight">
                  <p className="text-sm font-semibold text-slate-900 truncate max-w-[180px]">
                    {fullName}
                  </p>
                  <p className="text-xs text-slate-500">{roleLabel}</p>
                </div>
              </button>

              {accountOpen && (
                <div className="absolute right-0 mt-1.5 w-60 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-40">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-semibold text-slate-900 truncate">{fullName}</p>
                    <p className="text-xs text-slate-500 truncate">{platformAdmin?.email}</p>
                    <span className="inline-block mt-2 px-2 py-0.5 rounded border border-[#641f60]/20 bg-[#641f60]/[0.07] text-[10px] font-bold uppercase tracking-wider text-[#641f60]">
                      {roleLabel}
                    </span>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-rose-50 hover:text-rose-700 flex items-center gap-2.5 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="p-5 sm:p-8">{renderPage()}</main>
      </div>
    </div>
  );
}