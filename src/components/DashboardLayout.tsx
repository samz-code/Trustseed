import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  Pencil,
  Loader2,
  AlertCircle,
  RefreshCw,
  BarChart3,
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

// ============================================================================
// The bell merges two sources.
//
// `notifications` addresses staff: approvals waiting, system notices. These
// have a read/unread state.
//
// `customer_notifications` is the outbound member message queue. These have a
// delivery status instead. A queued message is the system working normally and
// needs nobody's attention; a failed one means a member did not receive
// confirmation of their money, which is exactly the kind of thing a SACCO
// officer must chase.
//
// So the badge counts unread staff alerts plus failed member messages. The
// list shows everything, merged by time, so the bell is a complete picture
// rather than half of one.
// ============================================================================

interface CustomerMessageRow {
  id: string;
  customer_id: string | null;
  event_key: string;
  channel: 'sms' | 'email' | 'in_app';
  recipient: string | null;
  body: string;
  status: 'queued' | 'sending' | 'sent' | 'failed' | 'skipped';
  error_message: string | null;
  created_at: string;
}

type FeedItem =
  | { kind: 'staff'; id: string; created_at: string; row: NotificationRow }
  | { kind: 'member'; id: string; created_at: string; row: CustomerMessageRow };

const MEMBER_STATUS_STYLE: Record<CustomerMessageRow['status'], string> = {
  queued: 'bg-slate-100 text-slate-500',
  sending: 'bg-[#ee7b22]/15 text-[#c46040]',
  sent: 'bg-[#1ebcb2]/15 text-[#159089]',
  failed: 'bg-[#c46040]/15 text-[#c46040]',
  skipped: 'bg-slate-100 text-slate-400',
};

function prettyEventKey(key: string): string {
  return key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
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
    label: 'Notifications',
    icon: <Bell className="w-5 h-5" />,
    path: 'notifications',
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

// Head-office-only navigation. Branch users never see these entries; the pages
// themselves also gate access, so this is defense-in-depth for the menu.
const HEAD_OFFICE_ROLES = new Set(['super_admin', 'institution_admin', 'head_office_admin']);

// ============================================================================
// Role-based navigation visibility
// ----------------------------------------------------------------------------
// An explicit role -> allowed-paths map, extending the same pattern already
// used for HEAD_OFFICE_ROLES / Branch Performance above. Chosen over gating
// on hasPermission() because it's unconfirmed whether the permissions table
// has entries for pages like accounting.view or transactions.view yet — a
// permission-driven gate would silently hide everything if those rows don't
// exist. This map fails visibly (wrong role sees wrong thing) rather than
// silently (everyone sees nothing), which is the safer default until the
// permission set is confirmed populated.
//
// Paths refer to NavItem.path and NavChild.path values in navigationItems
// above. A role not listed here (or an unrecognised role) falls back to
// FULL_ACCESS_ROLES-style full visibility, matching how HEAD_OFFICE_ROLES
// already treats admins.
// ============================================================================

const FULL_ACCESS_ROLES = new Set([
  'super_admin',
  'institution_admin',
  'head_office_admin',
  'branch_manager',
]);

// Branch managers get everything except the two institution-wide admin
// pages; modelled as an exclusion rather than a duplicate inclusion list.
const BRANCH_MANAGER_EXCLUDE = new Set(['users-roles', 'settings']);

const ROLE_NAV_MAP: Record<string, Set<string>> = {
  teller: new Set([
    'dashboard',
    'notifications',
    'customers',
    'wallets',
    'transactions',
    'transfers',
    'forex',
    'daily-opening',
    'daily-closing',
    'float',
    'repayments',
  ]),
  cashier: new Set([
    'dashboard',
    'notifications',
    'customers',
    'wallets',
    'transactions',
    'transfers',
    'daily-opening',
    'daily-closing',
    'float',
  ]),
  loan_officer: new Set([
    'dashboard',
    'notifications',
    'customers',
    'loan-products',
    'loan-applications',
    'loans',
    'repayments',
    'reports',
  ]),
  finance_officer: new Set([
    'dashboard',
    'notifications',
    'chart-of-accounts',
    'journals',
    'ledger',
    'trial-balance',
    'expenses',
    'reports',
    'transactions',
  ]),
  accountant: new Set([
    'dashboard',
    'notifications',
    'chart-of-accounts',
    'journals',
    'ledger',
    'trial-balance',
    'expenses',
    'reports',
    'transactions',
  ]),
  compliance_officer: new Set([
    'dashboard',
    'notifications',
    'customers',
    'transactions',
    'approvals',
    'reports',
  ]),
  forex_officer: new Set([
    'dashboard',
    'notifications',
    'customers',
    'wallets',
    'transactions',
    'transfers',
    'forex',
  ]),
  customer_service: new Set([
    'dashboard',
    'notifications',
    'customers',
    'wallets',
    'savings-products',
    'savings-accounts',
  ]),
  auditor: new Set([
    'dashboard',
    'notifications',
    'reports',
    'chart-of-accounts',
    'journals',
    'ledger',
    'trial-balance',
    'transactions',
  ]),
};

/**
 * Filters a NavItem tree down to what a given role may see. A parent with
 * children is kept only if it has a direct path the role can see OR at least
 * one visible child; children are filtered the same way individually.
 */
function filterNavByRole(items: NavItem[], role: string | undefined): NavItem[] {
  if (!role || FULL_ACCESS_ROLES.has(role)) {
    if (role === 'branch_manager') {
      return items
        .filter((item) => !item.path || !BRANCH_MANAGER_EXCLUDE.has(item.path))
        .map((item) => ({
          ...item,
          children: item.children?.filter((c) => !BRANCH_MANAGER_EXCLUDE.has(c.path)),
        }));
    }
    return items;
  }

  const allowed = ROLE_NAV_MAP[role];
  if (!allowed) {
    // Unrecognised role: fail toward showing only Dashboard rather than
    // either hiding everything or granting full access by accident.
    return items.filter((item) => item.path === 'dashboard');
  }

  const result: NavItem[] = [];
  for (const item of items) {
    const children: NavChild[] | undefined = item.children?.filter((c) => allowed.has(c.path));
    const hasOwnPath = item.path ? allowed.has(item.path) : false;
    const hasVisibleChildren = !!children && children.length > 0;
    if (!hasOwnPath && !hasVisibleChildren) continue;
    result.push({ ...item, children: item.children ? children : undefined });
  }
  return result;
}


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

// ---- Auto-generated cartoon avatars -----------------------------------
// Every user gets a deterministic, cartoon-style face avatar built from a
// handful of randomized-but-seeded SVG features (skin tone, hair, eyes,
// mouth, accessories, background). Nothing is uploaded — the same seed
// (the admin's id, falling back to their name), gender, and variant number
// always render the same face. Users can switch gender and shuffle through
// variants to land on a look they like.

export type AvatarGender = 'male' | 'female';

const SKIN_TONES = ['#ffdbb4', '#edb98a', '#d08b5b', '#ae5d29', '#f1c27d', '#8d5524'];
const HAIR_COLORS = ['#2c1b18', '#4a2c1e', '#6b4423', '#a56b3f', '#1c1c1e', '#8b4513', '#d4a017', '#5c3a21', '#b0b0b0'];
const BG_COLORS = [
  '#641f60', '#ee7b22', '#1ebcb2', '#c46040', '#3b82f6', '#10b981',
  '#8b5cf6', '#f59e0b', '#ec4899', '#0891b2', '#65a30d', '#dc2626',
];
// Hair silhouettes, split by gender so the style pool matches the toggle.
const MALE_HAIR_STYLES = ['short', 'bald', 'spiky', 'side-part', 'curly', 'mohawk', 'buzz'] as const;
const FEMALE_HAIR_STYLES = ['long', 'bun', 'bob', 'side-part', 'ponytail', 'curly', 'braid'] as const;
const MOUTH_STYLES = ['smile', 'grin', 'flat', 'open', 'smirk', 'surprised'] as const;
const FACIAL_HAIR_STYLES = ['none', 'none', 'mustache', 'beard', 'goatee'] as const;

type HairStyle = (typeof MALE_HAIR_STYLES)[number] | (typeof FEMALE_HAIR_STYLES)[number];
type FacialHairStyle = (typeof FACIAL_HAIR_STYLES)[number];

// Small deterministic PRNG seeded from a string, so a given seed always
// produces the same sequence of feature choices.
function makeRng(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = seed.charCodeAt(i) + ((h << 5) - h);
  }
  let state = Math.abs(h) || 1;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

interface CartoonFeatures {
  bg: string;
  skin: string;
  hairColor: string;
  hairStyle: HairStyle;
  mouthStyle: (typeof MOUTH_STYLES)[number];
  facialHair: FacialHairStyle;
  eyeSpacing: number;
  hasFreckles: boolean;
  hasGlasses: boolean;
}

function getCartoonFeatures(seed: string, gender: AvatarGender, variant: number): CartoonFeatures {
  // Fold gender and variant into the seed so switching gender, or hitting
  // "shuffle", reliably changes the generated face rather than reusing the
  // same random draws.
  const rng = makeRng(`${seed}:${gender}:${variant}`);
  const hairPool = gender === 'female' ? FEMALE_HAIR_STYLES : MALE_HAIR_STYLES;
  return {
    bg: pick(rng, BG_COLORS),
    skin: pick(rng, SKIN_TONES),
    hairColor: pick(rng, HAIR_COLORS),
    hairStyle: pick(rng, hairPool),
    mouthStyle: pick(rng, MOUTH_STYLES),
    facialHair: gender === 'male' ? pick(rng, FACIAL_HAIR_STYLES) : 'none',
    eyeSpacing: 14 + Math.floor(rng() * 6), // 14–19
    hasFreckles: rng() > 0.75,
    hasGlasses: rng() > 0.7,
  };
}

function HairSvg({ style, color }: { style: HairStyle; color: string }) {
  switch (style) {
    case 'bald':
      return null;
    case 'buzz':
      // Very short, close to the scalp — just a thin cap of color.
      return <path d="M16 40 Q18 8 50 8 Q82 8 84 40 Q84 26 50 24 Q16 26 16 40 Z" fill={color} opacity="0.85" />;
    case 'bun':
      return (
        <>
          <path d="M20 42 Q50 8 80 42 L80 30 Q50 -2 20 30 Z" fill={color} />
          <circle cx="50" cy="10" r="9" fill={color} />
        </>
      );
    case 'ponytail':
      return (
        <>
          <path d="M16 44 Q18 6 50 6 Q82 6 84 44 Q84 20 50 18 Q16 20 16 44 Z" fill={color} />
          <path d="M84 40 Q100 46 96 70 Q92 60 82 48 Z" fill={color} />
        </>
      );
    case 'braid':
      return (
        <>
          <path d="M15 46 Q14 4 50 4 Q86 4 85 46 Q85 24 50 20 Q15 24 15 46 Z" fill={color} />
          <rect x="46" y="46" width="8" height="14" rx="3" fill={color} />
          <rect x="46" y="62" width="8" height="14" rx="3" fill={color} />
          <rect x="46" y="78" width="8" height="10" rx="3" fill={color} />
        </>
      );
    case 'spiky':
      return (
        <path
          d="M18 40 L26 14 L36 32 L44 8 L54 30 L64 8 L72 32 L82 40 Q50 20 18 40 Z"
          fill={color}
        />
      );
    case 'mohawk':
      return (
        <>
          <path d="M16 46 Q16 30 50 30 Q84 30 84 46 Q84 36 50 36 Q16 36 16 46 Z" fill={color} opacity="0.5" />
          <path d="M42 6 L58 6 L54 34 L46 34 Z" fill={color} />
        </>
      );
    case 'curly':
      return (
        <>
          <circle cx="24" cy="30" r="9" fill={color} />
          <circle cx="38" cy="16" r="10" fill={color} />
          <circle cx="54" cy="12" r="10" fill={color} />
          <circle cx="70" cy="16" r="10" fill={color} />
          <circle cx="82" cy="32" r="9" fill={color} />
          <circle cx="50" cy="20" r="14" fill={color} />
        </>
      );
    case 'side-part':
      return <path d="M16 42 Q30 4 58 10 Q84 16 84 42 Q84 22 55 18 Q28 14 16 42 Z" fill={color} />;
    case 'long':
      // Long hair frames the sides of the face down past the ears.
      return (
        <path
          d="M14 46 Q14 4 50 4 Q86 4 86 46 L86 78 Q80 70 78 46 Q78 16 50 16 Q22 16 22 46 Q20 70 14 78 Z"
          fill={color}
        />
      );
    case 'bob':
      // Bob cut: rounded, ends just past the ears.
      return (
        <path
          d="M15 48 Q13 2 50 2 Q87 2 85 48 Q85 58 78 60 Q80 30 50 26 Q20 30 22 60 Q15 58 15 48 Z"
          fill={color}
        />
      );
    case 'short':
    default:
      return <path d="M16 44 Q18 6 50 6 Q82 6 84 44 Q84 20 50 18 Q16 20 16 44 Z" fill={color} />;
  }
}

function MouthSvg({ style }: { style: CartoonFeatures['mouthStyle'] }) {
  switch (style) {
    case 'grin':
      return <path d="M38 66 Q50 78 62 66 Q50 72 38 66 Z" fill="#7a3b2e" />;
    case 'flat':
      return <line x1="40" y1="68" x2="60" y2="68" stroke="#7a3b2e" strokeWidth="3" strokeLinecap="round" />;
    case 'open':
      return <ellipse cx="50" cy="68" rx="7" ry="6" fill="#7a3b2e" />;
    case 'smirk':
      return (
        <path d="M40 66 Q52 70 60 62" fill="none" stroke="#7a3b2e" strokeWidth="3.5" strokeLinecap="round" />
      );
    case 'surprised':
      return <circle cx="50" cy="68" r="5" fill="#7a3b2e" />;
    case 'smile':
    default:
      return (
        <path
          d="M38 64 Q50 76 62 64"
          fill="none"
          stroke="#7a3b2e"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      );
  }
}

function FacialHairSvg({ style, color }: { style: FacialHairStyle; color: string }) {
  switch (style) {
    case 'mustache':
      return <path d="M36 60 Q43 56 50 60 Q57 56 64 60 Q57 62 50 60 Q43 62 36 60 Z" fill={color} />;
    case 'beard':
      return (
        <path
          d="M22 58 Q22 82 50 86 Q78 82 78 58 Q78 72 50 76 Q22 72 22 58 Z"
          fill={color}
          opacity="0.9"
        />
      );
    case 'goatee':
      return <path d="M40 68 Q50 84 60 68 Q50 78 40 68 Z" fill={color} />;
    case 'none':
    default:
      return null;
  }
}

// Auto-generated cartoon-face avatar. Derived from a stable seed (admin id,
// falling back to name), the chosen gender, and a variant number — no
// upload, no URL entry. Users pick male/female and can shuffle variants.
function Avatar({
  name,
  seed,
  gender = 'male',
  variant = 0,
  size = 40,
}: {
  name: string;
  seed?: string;
  gender?: AvatarGender;
  variant?: number;
  size?: number;
}) {
  const f = getCartoonFeatures(seed || name || 'user', gender, variant);
  const cx = 50;
  const leftEyeX = cx - f.eyeSpacing;
  const rightEyeX = cx + f.eyeSpacing;

  return (
    <div
      className="rounded-full overflow-hidden flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: f.bg }}
    >
      <svg viewBox="0 0 100 100" width="100%" height="100%" role="img" aria-label={`${name || 'User'} avatar`}>
        {/* Head */}
        <circle cx="50" cy="56" r="34" fill={f.skin} />
        {/* Ears */}
        <circle cx="17" cy="56" r="6" fill={f.skin} />
        <circle cx="83" cy="56" r="6" fill={f.skin} />
        {/* Freckles */}
        {f.hasFreckles && (
          <>
            <circle cx="38" cy="60" r="1.4" fill="#b5754f" opacity="0.6" />
            <circle cx="43" cy="63" r="1.4" fill="#b5754f" opacity="0.6" />
            <circle cx="57" cy="63" r="1.4" fill="#b5754f" opacity="0.6" />
            <circle cx="62" cy="60" r="1.4" fill="#b5754f" opacity="0.6" />
          </>
        )}
        {/* Eyes */}
        <circle cx={leftEyeX} cy="52" r="4" fill="#2c1b18" />
        <circle cx={rightEyeX} cy="52" r="4" fill="#2c1b18" />
        <circle cx={leftEyeX + 1.2} cy="50.5" r="1.1" fill="#fff" />
        <circle cx={rightEyeX + 1.2} cy="50.5" r="1.1" fill="#fff" />
        {/* Eyelashes (female style) */}
        {gender === 'female' && (
          <>
            <line x1={leftEyeX - 4} y1="47" x2={leftEyeX - 6} y2="44" stroke="#2c1b18" strokeWidth="1.3" strokeLinecap="round" />
            <line x1={rightEyeX + 4} y1="47" x2={rightEyeX + 6} y2="44" stroke="#2c1b18" strokeWidth="1.3" strokeLinecap="round" />
          </>
        )}
        {/* Glasses */}
        {f.hasGlasses && (
          <g stroke="#33302e" strokeWidth="2" fill="none">
            <circle cx={leftEyeX} cy="52" r="7" />
            <circle cx={rightEyeX} cy="52" r="7" />
            <line x1={leftEyeX + 7} y1="52" x2={rightEyeX - 7} y2="52" />
            <line x1={leftEyeX - 7} y1="52" x2={leftEyeX - 12} y2="49" />
            <line x1={rightEyeX + 7} y1="52" x2={rightEyeX + 12} y2="49" />
          </g>
        )}
        {/* Mouth */}
        <MouthSvg style={f.mouthStyle} />
        {/* Facial hair (male only) */}
        <FacialHairSvg style={f.facialHair} color={f.hairColor} />
        {/* Hair (drawn last, on top of head silhouette edges) */}
        <HairSvg style={f.hairStyle} color={f.hairColor} />
      </svg>
    </div>
  );
}

interface ProfileForm {
  full_name: string;
  phone: string;
  avatar_gender: AvatarGender;
  avatar_variant: number;
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
  const [memberMessages, setMemberMessages] = useState<CustomerMessageRow[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Profile editing. AuthContext's `admin` object may not expose a setter/
  // refresh function, so we keep a local override merged on top of it —
  // this makes name/phone/avatar changes appear immediately without needing
  // AuthContext to be modified. If AuthContext later exposes a
  // `refreshAdmin()`, call that instead of relying on this override.
  // Note: avatars are auto-generated cartoon faces (see `Avatar` component
  // above) — there's no avatar_url to track, only gender + variant number.
  const [profileOverride, setProfileOverride] = useState<Partial<ProfileForm>>({});
  const displayName = profileOverride.full_name ?? admin?.full_name ?? 'User';
  const displayPhone = profileOverride.phone ?? admin?.phone ?? '';
  const displayGender: AvatarGender =
    profileOverride.avatar_gender ?? (admin as any)?.avatar_gender ?? 'male';
  const displayVariant: number =
    profileOverride.avatar_variant ?? (admin as any)?.avatar_variant ?? 0;

  const [showProfile, setShowProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    full_name: '',
    phone: '',
    avatar_gender: 'male',
    avatar_variant: 0,
  });
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Unread staff alerts plus failed member messages. A queued or sent message
  // is not a task, so it does not inflate the badge.
  const unreadStaffCount = notifications.filter((n) => !n.read_at).length;
  const failedMemberCount = memberMessages.filter((m) => m.status === 'failed').length;
  const unreadCount = unreadStaffCount + failedMemberCount;

  // Merged, newest first. Both sources are already limited server-side, so
  // this sorts at most 40 items.
  const feed: FeedItem[] = useMemo(() => {
    const items: FeedItem[] = [
      ...notifications.map((n) => ({
        kind: 'staff' as const,
        id: `staff-${n.id}`,
        created_at: n.created_at,
        row: n,
      })),
      ...memberMessages.map((m) => ({
        kind: 'member' as const,
        id: `member-${m.id}`,
        created_at: m.created_at,
        row: m,
      })),
    ];
    return items.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [notifications, memberMessages]);

  // Branch users see only their branch's menu; head office gets the extra
  // Branch Performance comparison view (inserted right after Reports).
  const navItems = useMemo(() => {
    const items = [...navigationItems];
    if (HEAD_OFFICE_ROLES.has(admin?.role ?? '')) {
      const bp: NavItem = {
        label: 'Branch Performance',
        icon: <BarChart3 className="w-5 h-5" />,
        path: 'branch-performance',
      };
      const idx = items.findIndex((i) => i.path === 'reports');
      items.splice(idx >= 0 ? idx + 1 : items.length, 0, bp);
    }
    // Role-based visibility, applied AFTER Branch Performance is inserted so
    // head-office roles (which pass straight through filterNavByRole via
    // FULL_ACCESS_ROLES) keep seeing it.
    return filterNavByRole(items, admin?.role);
  }, [admin?.role]);

  // Fetch notifications for this tenant that are either tenant-wide
  // (admin_id IS NULL — e.g. the approval notices inserted from
  // TransactionsPage) or addressed specifically to this admin. If you still
  // see zero notifications after this change and rows exist in the table,
  // the most likely cause is a Row Level Security policy on `notifications`
  // that only allows admin_id = auth.uid() and silently excludes the
  // tenant-wide (admin_id IS NULL) rows — that has to be fixed in Supabase's
  // policy editor, not from this component.
  const loadNotifications = useCallback(async () => {
    if (!tenant) return;
    setNotifLoading(true);
    setNotifError(null);

    // The two fetches are deliberately independent. If the member message
    // table is missing or blocked, staff alerts should still show, and the
    // reverse. A single try/catch around both would blank the bell entirely
    // whenever either one failed.
    const errors: string[] = [];

    // ---- Staff alerts -------------------------------------------------
    try {
      let query = supabase
        .from('notifications')
        .select('id, title, message, created_at, read_at')
        .eq('tenant_id', tenant.id);

      query = admin?.id
        ? query.or(`admin_id.is.null,admin_id.eq.${admin.id}`)
        : query.is('admin_id', null);

      const { data, error } = await query.order('created_at', { ascending: false }).limit(20);
      if (error) throw error;
      setNotifications(data ?? []);
    } catch (err) {
      console.error('Error loading staff notifications:', err);
      const message = err instanceof Error ? err.message : 'Failed to load notifications';
      if (/relation .* does not exist/i.test(message) || (err as { code?: string })?.code === '42P01') {
        errors.push('The notifications table does not exist yet.');
      } else {
        errors.push(message);
      }
      setNotifications([]);
    }

    // ---- Member messages ----------------------------------------------
    //
    // Deliberately NOT filtered by the selected branch. Institution-wide
    // messages carry no branch_id, and a branch filter silently hides them.
    // The bell is a tenant-level summary; the full page provides filtering.
    try {
      const { data, error } = await (supabase.from('customer_notifications') as any)
        .select('id, customer_id, event_key, channel, recipient, body, status, error_message, created_at')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setMemberMessages((data ?? []) as CustomerMessageRow[]);
    } catch (err) {
      console.error('Error loading member messages:', err);
      const message = err instanceof Error ? err.message : 'Failed to load member messages';
      if (/relation .* does not exist/i.test(message) || (err as { code?: string })?.code === '42P01') {
        errors.push('Run the notification system migration to enable member messages.');
      } else {
        errors.push(message);
      }
      setMemberMessages([]);
    }

    // Only surface an error if BOTH failed. One working source is still a
    // useful bell, and a warning over a populated list reads as broken.
    if (errors.length === 2) {
      setNotifError(errors.join(' '));
    }

    setNotifLoading(false);
  }, [tenant, admin?.id]);

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

  // ---- Profile editing -------------------------------------------------

  const openProfile = () => {
    setProfileForm({
      full_name: displayName === 'User' ? '' : displayName,
      phone: displayPhone,
      avatar_gender: displayGender,
      avatar_variant: displayVariant,
    });
    setProfileError(null);
    setShowProfile(true);
  };

  const closeProfile = () => {
    setShowProfile(false);
    setProfileError(null);
  };

  // Cycles to a new deterministic look within the current gender, so the
  // user can shuffle until they find a face they like.
  const shuffleAvatar = () => {
    setProfileForm((prev) => ({ ...prev, avatar_variant: (prev.avatar_variant + 1) % 1000 }));
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);

    if (!admin?.id) {
      setProfileError('No admin account found. Please sign in again.');
      return;
    }
    if (!profileForm.full_name.trim()) {
      setProfileError('Name cannot be empty.');
      return;
    }

    setProfileSubmitting(true);
    try {
      // Table name assumed as `tenant_admins` to match the TenantAdmin type
      // used elsewhere in this app — adjust if your table is named
      // differently. Cast via `as any` because this app's generated
      // Supabase types may lag behind the actual schema. If your
      // `tenant_admins` table doesn't yet have `avatar_gender` (text,
      // 'male' | 'female') and `avatar_variant` (int) columns, add them to
      // persist these choices.
      const { error } = await (supabase.from('tenant_admins') as any)
        .update({
          full_name: profileForm.full_name.trim(),
          phone: profileForm.phone.trim() || null,
          avatar_gender: profileForm.avatar_gender,
          avatar_variant: profileForm.avatar_variant,
        })
        .eq('id', admin.id);
      if (error) throw error;

      setProfileOverride({
        full_name: profileForm.full_name.trim(),
        phone: profileForm.phone.trim(),
        avatar_gender: profileForm.avatar_gender,
        avatar_variant: profileForm.avatar_variant,
      });
      setShowProfile(false);
    } catch (err) {
      console.error('Error updating profile:', err);
      setProfileError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setProfileSubmitting(false);
    }
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
          <div className="min-w-0 flex-1" />
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
            {navItems.map((item) => (
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
          <div className="flex items-center justify-between px-4 py-3 gap-2">
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

            <div className="flex items-center gap-2 sm:gap-4">
              {/* Branch selector */}
              {branches.length > 1 && (
                <div className="relative">
                  <button
                    onClick={() => setBranchDropdownOpen(!branchDropdownOpen)}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors"
                  >
                    <Building className="w-4 h-4" />
                    <span className="hidden sm:inline">{branch?.name || 'Select Branch'}</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>

                  {branchDropdownOpen && (
                    <div className="absolute right-0 mt-1 w-56 bg-white border border-[#dae1e1] rounded-lg shadow-lg overflow-hidden z-40">
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
                  <div className="absolute right-0 mt-1 w-[calc(100vw-2rem)] max-w-80 bg-white border border-[#dae1e1] rounded-lg shadow-lg overflow-hidden z-40">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-slate-900 text-sm">Notifications</h3>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={loadNotifications}
                          disabled={notifLoading}
                          className="text-slate-400 hover:text-[#641f60] transition-colors disabled:opacity-50"
                          aria-label="Refresh notifications"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${notifLoading ? 'animate-spin' : ''}`} />
                        </button>
                        {/* Only staff alerts have a read state; member
                            messages are cleared by fixing the delivery, not
                            by dismissing them. */}
                        {unreadStaffCount > 0 && (
                          <button
                            onClick={markAllAsRead}
                            className="text-xs text-[#1ebcb2] hover:text-[#641f60] font-medium flex items-center gap-1 transition-colors"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                            Mark all read
                          </button>
                        )}
                      </div>
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
                        <div className="p-4">
                          <div className="flex items-start gap-2 text-sm text-[#c46040]">
                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span>{notifError}</span>
                          </div>
                          <button
                            onClick={loadNotifications}
                            className="mt-3 w-full text-xs font-medium px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center justify-center gap-1.5"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Retry
                          </button>
                        </div>
                      ) : feed.length === 0 ? (
                        <div className="py-10 text-center px-4">
                          <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p className="text-sm text-slate-500">No notifications yet</p>
                        </div>
                      ) : (
                        <ul className="divide-y divide-slate-100">
                          {feed.map((item) =>
                            item.kind === 'staff' ? (
                              <li key={item.id}>
                                <button
                                  onClick={() => markAsRead(item.row.id)}
                                  className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${
                                    !item.row.read_at ? 'bg-[#1ebcb2]/5' : ''
                                  }`}
                                >
                                  <div className="flex items-start gap-2">
                                    {!item.row.read_at && (
                                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#ee7b22] flex-shrink-0" />
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium text-slate-900 truncate">
                                        {item.row.title}
                                      </p>
                                      {item.row.message && (
                                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                                          {item.row.message}
                                        </p>
                                      )}
                                      <p className="text-xs text-slate-400 mt-1">
                                        {timeAgo(item.row.created_at)}
                                      </p>
                                    </div>
                                  </div>
                                </button>
                              </li>
                            ) : (
                              <li key={item.id}>
                                <button
                                  onClick={() => {
                                    setNotifOpen(false);
                                    window.dispatchEvent(
                                      new CustomEvent('navigate', { detail: 'notifications' })
                                    );
                                  }}
                                  className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${
                                    item.row.status === 'failed' ? 'bg-[#c46040]/5' : ''
                                  }`}
                                >
                                  <div className="flex items-start gap-2">
                                    {item.row.status === 'failed' && (
                                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#c46040] flex-shrink-0" />
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium text-slate-900 truncate">
                                          {prettyEventKey(item.row.event_key)}
                                        </p>
                                        <span
                                          className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                                            MEMBER_STATUS_STYLE[item.row.status]
                                          }`}
                                        >
                                          {item.row.status}
                                        </span>
                                      </div>
                                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                                        {item.row.body}
                                      </p>
                                      {item.row.error_message && (
                                        <p className="text-xs text-[#c46040] mt-0.5 line-clamp-1">
                                          {item.row.error_message}
                                        </p>
                                      )}
                                      <p className="text-xs text-slate-400 mt-1">
                                        {item.row.channel.toUpperCase()}
                                        {item.row.recipient ? ` · ${item.row.recipient}` : ''} ·{' '}
                                        {timeAgo(item.row.created_at)}
                                      </p>
                                    </div>
                                  </div>
                                </button>
                              </li>
                            )
                          )}
                        </ul>
                      )}
                    </div>

                    {/* The dropdown shows only the 20 most recent of each kind.
                        Anything older, plus filtering and delivery detail,
                        lives on the full page. */}
                    <div className="px-4 py-2.5 border-t border-slate-100">
                      <button
                        onClick={() => {
                          setNotifOpen(false);
                          window.dispatchEvent(
                            new CustomEvent('navigate', { detail: 'notifications' })
                          );
                        }}
                        className="w-full text-center text-xs font-medium text-[#1ebcb2] hover:text-[#641f60] transition-colors"
                      >
                        View all notifications
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* User menu — opens the editable profile modal */}
              <button
                onClick={openProfile}
                className="flex items-center gap-3 group"
                aria-label="Edit profile"
              >
                <div className="relative">
                  <Avatar name={displayName} seed={admin?.id} gender={displayGender} variant={displayVariant} size={40} />
                  <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-[#641f60] transition-colors">
                    <Pencil className="w-2.5 h-2.5" />
                  </span>
                </div>
                <div className="hidden md:block text-right">
                  <p className="font-medium text-slate-900 text-sm">{displayName}</p>
                  <p className={`text-xs px-2 py-0.5 rounded-full inline-block ${getRoleBadgeColor(admin?.role || '')}`}>
                    {admin?.role?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'User'}
                  </p>
                </div>
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">{children}</main>
      </div>

      {/* Edit Profile modal */}
      {showProfile && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-6">
          <div className="relative bg-white w-full sm:max-w-2xl md:max-w-3xl sm:rounded-3xl shadow-2xl flex flex-col h-full sm:h-auto sm:max-h-[92vh] overflow-hidden ring-1 ring-black/5">
            {/* Brand accent band (solid) */}
            <div className="h-1.5 w-full bg-[#641f60] flex-shrink-0" />

            {/* Fixed header */}
            <div className="px-6 sm:px-8 py-5 border-b border-[#dcdfe0] flex items-center justify-between flex-shrink-0 bg-white">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#641f60]">Edit Profile</h2>
                <p className="text-sm text-slate-500 mt-0.5">Update your details and pick a look you like</p>
              </div>
              <button
                onClick={closeProfile}
                className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-[#641f60] transition-all duration-200"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable body */}
            <form
              id="edit-profile-form"
              onSubmit={handleProfileSubmit}
              className="flex-1 overflow-y-auto overscroll-contain px-6 sm:px-8 py-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-8">
                {/* Avatar is auto-generated — user picks a style and can shuffle looks */}
                <div className="flex flex-col items-center gap-4 md:pr-8 md:border-r md:border-[#dcdfe0]">
                  <div className="relative group cursor-pointer" onClick={shuffleAvatar}>
                    <div className="relative ring-4 ring-[#dcdfe0] group-hover:ring-[#8dd3cd] rounded-full transition-all duration-300 group-hover:scale-105 group-hover:shadow-xl">
                      <Avatar
                        name={profileForm.full_name || displayName}
                        seed={admin?.id}
                        gender={profileForm.avatar_gender}
                        variant={profileForm.avatar_variant}
                        size={112}
                      />
                    </div>
                    <span className="absolute inset-0 flex items-center justify-center rounded-full bg-[#641f60]/0 group-hover:bg-[#641f60]/40 text-white opacity-0 group-hover:opacity-100 transition-all duration-300 text-xs font-semibold">
                      <RefreshCw className="w-5 h-5" />
                    </span>
                  </div>

                  <div className="flex flex-col items-center gap-2 w-full">
                    <div className="flex rounded-xl border-2 border-[#dcdfe0] overflow-hidden w-full max-w-[220px]">
                      <button
                        type="button"
                        onClick={() => setProfileForm((prev) => ({ ...prev, avatar_gender: 'male' }))}
                        className={`flex-1 px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                          profileForm.avatar_gender === 'male'
                            ? 'bg-[#641f60] text-white shadow-inner'
                            : 'bg-white text-slate-600 hover:bg-[#641f60]/10 hover:text-[#641f60]'
                        }`}
                      >
                        Male
                      </button>
                      <button
                        type="button"
                        onClick={() => setProfileForm((prev) => ({ ...prev, avatar_gender: 'female' }))}
                        className={`flex-1 px-4 py-2 text-sm font-semibold transition-all duration-200 border-l-2 border-[#dcdfe0] ${
                          profileForm.avatar_gender === 'female'
                            ? 'bg-[#641f60] text-white shadow-inner'
                            : 'bg-white text-slate-600 hover:bg-[#641f60]/10 hover:text-[#641f60]'
                        }`}
                      >
                        Female
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={shuffleAvatar}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl border-2 border-[#1ebcb2] text-[#1ebcb2] hover:bg-[#1ebcb2] hover:text-white hover:shadow-lg hover:shadow-[#1ebcb2]/30 hover:-translate-y-0.5 transition-all duration-200 w-full max-w-[220px] justify-center"
                      aria-label="Shuffle avatar look"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Shuffle look
                    </button>
                  </div>
                </div>

                {/* Fields */}
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-[#641f60] mb-1.5">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={profileForm.full_name}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, full_name: e.target.value }))}
                      className="w-full px-4 py-3 border-2 border-[#dcdfe0] rounded-xl text-base focus:outline-none focus:ring-4 focus:ring-[#1ebcb2]/20 focus:border-[#1ebcb2] hover:border-[#8dd3cd] transition-all duration-200"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#641f60] mb-1.5">Phone</label>
                    <input
                      type="tel"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-4 py-3 border-2 border-[#dcdfe0] rounded-xl text-base focus:outline-none focus:ring-4 focus:ring-[#1ebcb2]/20 focus:border-[#1ebcb2] hover:border-[#8dd3cd] transition-all duration-200"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-500 mb-1.5">Email</label>
                      <input
                        type="email"
                        value={admin?.email || ''}
                        readOnly
                        className="w-full px-4 py-3 border-2 border-[#dcdfe0] bg-slate-50 rounded-xl text-slate-500"
                      />
                      <p className="text-xs text-slate-400 mt-1">Requires verification to change.</p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-500 mb-1.5">Role</label>
                      <input
                        type="text"
                        value={admin?.role?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || ''}
                        readOnly
                        className="w-full px-4 py-3 border-2 border-[#dcdfe0] bg-slate-50 rounded-xl text-slate-500 capitalize"
                      />
                    </div>
                  </div>

                  {profileError && (
                    <div className="p-3.5 bg-[#c46040]/10 border-2 border-[#c46040]/30 rounded-xl text-[#c46040] text-sm flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      {profileError}
                    </div>
                  )}
                </div>
              </div>
            </form>

            {/* Fixed footer */}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-3 px-6 sm:px-8 py-5 border-t border-[#dcdfe0] flex-shrink-0 bg-white">
              <button
                type="button"
                onClick={closeProfile}
                className="px-5 py-3 border-2 border-[#dcdfe0] text-slate-700 font-semibold rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all duration-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-profile-form"
                disabled={profileSubmitting}
                className="px-7 py-3 bg-[#ee7b22] hover:bg-[#641f60] text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2 transition-all duration-200"
              >
                {profileSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}