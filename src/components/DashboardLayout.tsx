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
  Pencil,
  Loader2,
  AlertCircle,
  RefreshCw,
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

  const unreadCount = notifications.filter((n) => !n.read_at).length;

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
      console.error('Error loading notifications:', err);
      const message = err instanceof Error ? err.message : 'Failed to load notifications';
      // Surface a clearer hint for the most common setup issue.
      if (/relation .* does not exist/i.test(message) || (err as { code?: string })?.code === '42P01') {
        setNotifError('The notifications table doesn\u2019t exist yet in your database.');
      } else {
        setNotifError(message);
      }
      setNotifications([]);
    } finally {
      setNotifLoading(false);
    }
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
          <div className="relative bg-white w-full sm:max-w-2xl md:max-w-3xl sm:rounded-3xl shadow-2xl flex flex-col h-full sm:h-auto sm:max-h-[92vh] overflow-hidden ring-1 ring-black/5 animate-[fadeIn_0.15s_ease-out]">
            {/* Decorative brand gradient band */}
            <div className="h-1.5 w-full bg-gradient-to-r from-[#641f60] via-[#ee7b22] to-[#1ebcb2] flex-shrink-0" />

            {/* Fixed header */}
            <div className="px-6 sm:px-8 py-5 border-b border-[#dcdfe0] flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-[#641f60]/5 via-white to-[#1ebcb2]/5">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#641f60]">Edit Profile</h2>
                <p className="text-sm text-slate-500 mt-0.5">Update your details and pick a look you like</p>
              </div>
              <button
                onClick={closeProfile}
                className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-[#641f60] hover:rotate-90 transition-all duration-300"
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
                    <div className="absolute -inset-2 rounded-full bg-gradient-to-br from-[#ee7b22] via-[#641f60] to-[#1ebcb2] opacity-0 group-hover:opacity-100 blur-md transition-opacity duration-300" />
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
                className="px-7 py-3 bg-[#ee7b22] hover:bg-[#641f60] text-white font-semibold rounded-xl shadow-lg shadow-[#ee7b22]/30 hover:shadow-xl hover:shadow-[#641f60]/40 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2 transition-all duration-200"
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