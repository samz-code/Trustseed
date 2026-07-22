import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { TenantAdmin } from '../types';
import { applyBranding } from '../lib/branding';
import { CURRENCY_SYMBOLS } from '../lib/currency';
import {
  Settings,
  Users,
  Building,
  Globe,
  Shield,
  Palette,
  Loader2,
  Save,
  Plus,
  Edit,
  X,
  Upload,
  Link as LinkIcon,
  CheckCircle2,
  ShieldAlert,
  ChevronDown,
  Phone,
  MapPin,
} from 'lucide-react';

interface IntegrationField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'select';
  placeholder?: string;
  options?: string[];
}

interface IntegrationDef {
  id: string;
  label: string;
  fields: IntegrationField[];
}

const INTEGRATIONS: IntegrationDef[] = [
  {
    id: 'mpesa',
    label: 'M-Pesa',
    fields: [
      { key: 'paybill_number', label: 'Paybill / Till Number', type: 'text' },
      { key: 'consumer_key', label: 'Consumer Key', type: 'password' },
      { key: 'consumer_secret', label: 'Consumer Secret', type: 'password' },
      { key: 'passkey', label: 'Passkey', type: 'password' },
      { key: 'environment', label: 'Environment', type: 'select', options: ['sandbox', 'production'] },
    ],
  },
  {
    id: 'mtn',
    label: 'MTN Mobile Money',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password' },
      { key: 'subscription_key', label: 'Subscription Key', type: 'password' },
      { key: 'target_environment', label: 'Target Environment', type: 'text', placeholder: 'sandbox' },
    ],
  },
  {
    id: 'bank',
    label: 'Bank API',
    fields: [
      { key: 'bank_name', label: 'Bank Name', type: 'text' },
      { key: 'account_number', label: 'Account Number', type: 'text' },
      { key: 'api_key', label: 'API Key', type: 'password' },
    ],
  },
  {
    id: 'sms',
    label: 'SMS Gateway',
    fields: [
      { key: 'provider', label: 'Provider', type: 'text', placeholder: "e.g. Africa's Talking" },
      { key: 'api_key', label: 'API Key', type: 'password' },
      { key: 'sender_id', label: 'Sender ID', type: 'text' },
    ],
  },
  {
    id: 'email',
    label: 'Email Service',
    fields: [
      { key: 'provider', label: 'Provider', type: 'text', placeholder: 'e.g. SendGrid, SMTP' },
      { key: 'api_key', label: 'API Key', type: 'password' },
      { key: 'from_address', label: 'From Email Address', type: 'text' },
    ],
  },
];

// Currencies offered in the dropdowns, derived from the shared symbol map so
// there's one source of truth. KES first since that's the primary market.
const CURRENCY_OPTIONS = ['KES', 'USD', 'SSP', 'UGX', 'TZS', 'RWF', 'EUR', 'GBP', 'NGN'].filter(
  (c) => c in CURRENCY_SYMBOLS
);

// ============================================================================
// Flag-badge currency picker (matches the style used on the Transactions
// page) — real national flags as inline SVG, clipped to a circle. Kept in
// this file rather than a native <select> so every currency dropdown in the
// app (Transactions, Settings) looks and behaves the same way. Covers every
// code in CURRENCY_OPTIONS, including RWF and NGN which Transactions doesn't
// need.
// ============================================================================

function FlagGraphic({ code }: { code: string }) {
  switch (code) {
    case 'USD': // United States
      return (
        <>
          <rect width="40" height="40" fill="#b22234" />
          <rect y="3.08" width="40" height="3.08" fill="#fff" />
          <rect y="9.23" width="40" height="3.08" fill="#fff" />
          <rect y="15.38" width="40" height="3.08" fill="#fff" />
          <rect y="21.54" width="40" height="3.08" fill="#fff" />
          <rect y="27.69" width="40" height="3.08" fill="#fff" />
          <rect y="33.85" width="40" height="3.08" fill="#fff" />
          <rect width="18" height="21.54" fill="#3c3b6e" />
          <g fill="#fff">
            {[4, 10, 16].map((y) =>
              [3, 7, 11, 15].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1" />)
            )}
          </g>
        </>
      );
    case 'KES': // Kenya
      return (
        <>
          <rect width="40" height="10" fill="#000" />
          <rect y="10" width="40" height="4" fill="#fff" />
          <rect y="14" width="40" height="12" fill="#bb0000" />
          <rect y="26" width="40" height="4" fill="#fff" />
          <rect y="30" width="40" height="10" fill="#006600" />
          <ellipse cx="20" cy="20" rx="4.5" ry="8" fill="#fff" />
          <ellipse cx="20" cy="20" rx="3" ry="6.5" fill="#bb0000" />
          <path d="M20 11 L21.5 20 L20 29 L18.5 20 Z" fill="#000" />
        </>
      );
    case 'SSP': // South Sudan
      return (
        <>
          <rect width="40" height="12" fill="#000" />
          <rect y="12" width="40" height="2" fill="#fff" />
          <rect y="14" width="40" height="12" fill="#bb0000" />
          <rect y="26" width="40" height="2" fill="#fff" />
          <rect y="28" width="40" height="12" fill="#009543" />
          <path d="M0 0 L20 20 L0 40 Z" fill="#0f47af" />
          <path d="M4 20 l5.5 -1.8 -3.4 4.7 0 -5.8 3.4 4.7 z" fill="#fcdd09" />
        </>
      );
    case 'UGX': // Uganda
      return (
        <>
          <rect width="40" height="6.67" fill="#000" />
          <rect y="6.67" width="40" height="6.67" fill="#fcdc04" />
          <rect y="13.33" width="40" height="6.67" fill="#d90000" />
          <rect y="20" width="40" height="6.67" fill="#000" />
          <rect y="26.67" width="40" height="6.67" fill="#fcdc04" />
          <rect y="33.33" width="40" height="6.67" fill="#d90000" />
          <circle cx="20" cy="20" r="6" fill="#fff" />
          <circle cx="20" cy="20" r="5.4" fill="none" stroke="#000" strokeWidth="0.4" />
        </>
      );
    case 'TZS': // Tanzania
      return (
        <>
          <path d="M0 0 H40 V40 H0 Z" fill="#1eb53a" />
          <path d="M40 0 V40 H0 Z" fill="#00a3dd" />
          <path d="M0 40 L40 0v6 L6 40 Z" fill="#fcd116" />
          <path d="M0 40 L40 0h-6 L0 34 Z" fill="#fcd116" />
          <path d="M0 34 L34 0h-34 Z M40 6 L6 40h34 Z" fill="#000" />
        </>
      );
    case 'RWF': // Rwanda
      return (
        <>
          <rect width="40" height="40" fill="#20603d" />
          <rect y="0" width="40" height="24" fill="#00a1de" />
          <rect y="24" width="40" height="4" fill="#fad201" />
          <rect y="28" width="40" height="12" fill="#20603d" />
          {/* Sun with simple rays, upper-right of the blue field */}
          <g fill="#e5be01">
            {Array.from({ length: 24 }).map((_, i) => {
              const angle = (i * 15 * Math.PI) / 180;
              const x1 = 29 + 4.5 * Math.cos(angle);
              const y1 = 11 + 4.5 * Math.sin(angle);
              const x2 = 29 + 7.5 * Math.cos(angle);
              const y2 = 11 + 7.5 * Math.sin(angle);
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e5be01" strokeWidth="1.2" />;
            })}
            <circle cx="29" cy="11" r="4.5" />
          </g>
        </>
      );
    case 'NGN': // Nigeria
      return (
        <>
          <rect width="13.33" height="40" fill="#008751" />
          <rect x="13.33" width="13.34" height="40" fill="#fff" />
          <rect x="26.67" width="13.33" height="40" fill="#008751" />
        </>
      );
    case 'EUR': // European Union
      return (
        <>
          <rect width="40" height="40" fill="#003399" />
          <g fill="#ffcc00">
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = (i * 30 * Math.PI) / 180;
              const cx = 20 + 11 * Math.sin(angle);
              const cy = 20 - 11 * Math.cos(angle);
              return <circle key={i} cx={cx} cy={cy} r="1.6" />;
            })}
          </g>
        </>
      );
    case 'GBP': // United Kingdom
      return (
        <>
          <rect width="40" height="40" fill="#012169" />
          <path d="M0 0 L40 40 M40 0 L0 40" stroke="#fff" strokeWidth="6" />
          <path d="M0 0 L40 40 M40 0 L0 40" stroke="#c8102e" strokeWidth="3" />
          <path d="M20 0 V40 M0 20 H40" stroke="#fff" strokeWidth="10" />
          <path d="M20 0 V40 M0 20 H40" stroke="#c8102e" strokeWidth="6" />
        </>
      );
    default:
      return (
        <>
          <rect width="40" height="40" fill="#64748b" />
          <text
            x="20"
            y="21"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="14"
            fontWeight="700"
            fill="#fff"
            fontFamily="system-ui, sans-serif"
          >
            {code.slice(0, 2)}
          </text>
        </>
      );
  }
}

// A round flag badge for a currency. Clips the flag SVG to a circle and adds a
// thin ring so light-colored flags stay visible on white backgrounds.
function CurrencyBadge({ code, size = 22 }: { code: string; size?: number }) {
  const clipId = `settings-flag-clip-${code}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      role="img"
      aria-label={`${code} flag`}
      className="flex-shrink-0"
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx="20" cy="20" r="20" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <FlagGraphic code={code} />
      </g>
      <circle cx="20" cy="20" r="19" fill="none" stroke="#00000022" strokeWidth="2" />
    </svg>
  );
}

const CURRENCY_NAMES: Record<string, string> = {
  USD: 'US Dollar',
  KES: 'Kenyan Shilling',
  SSP: 'South Sudanese Pound',
  UGX: 'Ugandan Shilling',
  TZS: 'Tanzanian Shilling',
  RWF: 'Rwandan Franc',
  EUR: 'Euro',
  GBP: 'British Pound',
  NGN: 'Nigerian Naira',
};

// Flag-badge currency dropdown. Drop-in replacement for a native <select>
// wherever a currency needs picking — fully keyboard/click accessible, and
// responsive (currency name collapses on narrow screens, flag + code always
// show). `options` lets callers scope which currencies are offered.
function CurrencySelect({
  value,
  onChange,
  options = CURRENCY_OPTIONS,
}: {
  value: string;
  onChange: (v: string) => void;
  options?: string[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full flex items-center gap-2 pl-3 pr-3 py-2.5 border border-slate-300 rounded-lg bg-white text-left hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] transition-colors"
      >
        <CurrencyBadge code={value} />
        <span className="flex-1 min-w-0 truncate text-slate-900">
          <span className="font-medium">{value}</span>
          {CURRENCY_SYMBOLS[value] && <span className="text-slate-400"> ({CURRENCY_SYMBOLS[value]})</span>}
          <span className="hidden sm:inline text-slate-400"> · {CURRENCY_NAMES[value] || value}</span>
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {options.map((c) => (
            <button
              key={c}
              type="button"
              role="option"
              aria-selected={c === value}
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 transition-colors ${
                c === value ? 'bg-[#1ebcb2]/10' : ''
              }`}
            >
              <CurrencyBadge code={c} size={20} />
              <span className={`flex-shrink-0 ${c === value ? 'text-[#641f60] font-medium' : 'text-slate-700'}`}>
                {c} {CURRENCY_SYMBOLS[c] ? `(${CURRENCY_SYMBOLS[c]})` : ''}
              </span>
              <span className="text-slate-400 truncate">{CURRENCY_NAMES[c] || ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface SettingsPageProps {
  tab?: string;
}

interface BranchForm {
  name: string;
  code: string;
  address: string;
  operating_currency: string;
}

const EMPTY_BRANCH_FORM: BranchForm = {
  name: '',
  code: '',
  address: '',
  operating_currency: 'KES',
};

// ---------------------------------------------------------------------------
// Settings are a single JSONB column, so every save has to merge rather than
// rebuild. Three separate handlers here each reconstructed the whole object,
// and two of them wrote empty strings over fields they were not editing:
// saving an integration blanked the institution's branding, currency and
// timezone. That is why colours appeared not to stick - they were being
// saved correctly and then wiped by the next unrelated save.
//
// This merges the given patch over what is already stored, preserving
// anything not explicitly changed, and merges `branding` one level deeper so
// updating a logo does not drop the colours.
// ---------------------------------------------------------------------------
function mergeSettings(
  existing: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const base = existing ?? {};
  const merged: Record<string, unknown> = { ...base, ...patch };

  if (patch.branding || base.branding) {
    merged.branding = {
      ...((base.branding as Record<string, unknown>) ?? {}),
      ...((patch.branding as Record<string, unknown>) ?? {}),
    };
  }
  return merged;
}

export function SettingsPage({ tab = 'general' }: SettingsPageProps) {
  const { tenant, branches, branch, admin, refreshTenant } = useAuth();
  const [activeTab, setActiveTab] = useState(tab);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [admins, setAdmins] = useState<TenantAdmin[]>([]);
  const [formData, setFormData] = useState({
    institution_name: '',
    primary_color: '#641f60',
    secondary_color: '#1ebcb2',
    accent_color: '#ee7b22',
    default_currency: 'KES',
    timezone: 'Africa/Nairobi',
    website: '',
    // Printed in the header of remittance vouchers and receipts. Without
    // these the voucher header renders blank, which every voucher generated
    // so far has done.
    address: '',
    phone: '',
  });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  const [integrationSettings, setIntegrationSettings] = useState<Record<string, Record<string, string>>>({});
  const [activeIntegration, setActiveIntegration] = useState<IntegrationDef | null>(null);
  const [integrationForm, setIntegrationForm] = useState<Record<string, string>>({});

  // Add User. The button existed but had no onClick at all, so it did
  // nothing when pressed.
  const [showUserForm, setShowUserForm] = useState(false);
  const [userForm, setUserForm] = useState({
    email: '',
    full_name: '',
    role: 'teller',
    phone: '',
    // 'invite' emails a set-password link, so nobody learns anyone else's
    // password. 'password' lets an admin set a temporary one for staff
    // without reliable email, which a rural branch genuinely needs.
    mode: 'invite' as 'invite' | 'password',
    password: '',
  });
  // Shown once after creating an account this way. It is deliberately not
  // stored anywhere: the admin hands it over and it dies at first sign-in.
  const [tempPasswordNotice, setTempPasswordNotice] = useState<string | null>(null);
  const [userSaving, setUserSaving] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<TenantAdmin | null>(null);
  const [integrationSaving, setIntegrationSaving] = useState(false);
  const [integrationError, setIntegrationError] = useState<string | null>(null);

  const [showBranchForm, setShowBranchForm] = useState(false);
  const [branchFormData, setBranchFormData] = useState<BranchForm>(EMPTY_BRANCH_FORM);
  const [branchFormError, setBranchFormError] = useState<string | null>(null);
  const [branchSubmitting, setBranchSubmitting] = useState(false);

  useEffect(() => {
    if (tenant) {
      loadAdmins();
      const settings = tenant.settings as {
        branding?: { primary_color?: string; secondary_color?: string; accent_color?: string; logo_url?: string };
        default_currency?: string;
        timezone?: string;
        website?: string;
        address?: string;
        phone?: string;
        integrations?: Record<string, Record<string, string>>;
      } | null;

      setFormData({
        institution_name: tenant.name || '',
        primary_color: settings?.branding?.primary_color || '#641f60',
        secondary_color: settings?.branding?.secondary_color || '#1ebcb2',
        accent_color: settings?.branding?.accent_color || '#ee7b22',
        default_currency: settings?.default_currency || 'KES',
        timezone: settings?.timezone || 'Africa/Nairobi',
        website: settings?.website || '',
        address: settings?.address || '',
        phone: settings?.phone || '',
      });
      setLogoUrl(settings?.branding?.logo_url || null);
      setIntegrationSettings(settings?.integrations || {});
      setBranchFormData((prev) => ({
        ...prev,
        operating_currency: settings?.default_currency || 'KES',
      }));
    }
  }, [tenant]);

  const loadAdmins = async () => {
    if (!tenant) return;
    try {
      const { data } = await supabase
        .from('tenant_admins')
        .select('*')
        .eq('tenant_id', tenant.id);
      if (data) setAdmins(data as TenantAdmin[]);
    } catch (err) {
      console.error('Error loading admins:', err);
    }
  };

  // Live preview: apply brand colors to the running app the moment they change
  // in the pickers, so the admin sees the effect before saving.
  const previewBranding = (primary: string, secondary: string, accent: string) => {
    applyBranding({ primary, secondary, accent });
  };

  const handleSaveSettings = async () => {
    if (!tenant) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const existing = (tenant.settings as Record<string, unknown>) || {};
      const existingEnabled = Array.isArray((existing as { enabled_currencies?: string[] }).enabled_currencies)
        ? ((existing as { enabled_currencies?: string[] }).enabled_currencies as string[])
        : [];
      // Guarantee the default currency is part of the enabled set.
      const enabledCurrencies = Array.from(
        new Set([formData.default_currency, ...existingEnabled])
      );

      const { error } = await supabase
        .from('tenants')
        .update({
          name: formData.institution_name,
          // Merge, so notification settings, compliance thresholds and
          // integration credentials survive a branding change.
          settings: mergeSettings(existing, {
            branding: {
              primary_color: formData.primary_color,
              secondary_color: formData.secondary_color,
              accent_color: formData.accent_color,
              logo_url: logoUrl,
            },
            default_currency: formData.default_currency,
            enabled_currencies: enabledCurrencies,
            timezone: formData.timezone,
            website: formData.website.trim() || null,
            address: formData.address.trim() || null,
            phone: formData.phone.trim() || null,
          }),
        })
        .eq('id', tenant.id);
      if (error) throw error;

      // Apply immediately so the whole app reflects the new colors, then
      // refresh tenant so context (and every useCurrency consumer) updates.
      applyBranding({
        primary: formData.primary_color,
        secondary: formData.secondary_color,
        accent: formData.accent_color,
      });
      await refreshTenant();
      setSaveMessage('Settings saved.');
    } catch (err) {
      console.error('Error saving settings:', err);
      const supaErr = err as { message?: string } | null;
      setSaveMessage(supaErr?.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenant) return;

    if (!file.type.startsWith('image/')) {
      setLogoError('Please upload an image file (PNG, JPG, SVG).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError('Logo must be under 2MB.');
      return;
    }

    setLogoError(null);
    setLogoUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${tenant.id}/logo-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('tenant-logos')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('tenant-logos').getPublicUrl(path);
      const newLogoUrl = publicUrlData.publicUrl;

      // Persist immediately rather than waiting for "Save Changes", so a
      // logo upload can't be lost if the admin navigates away.
      const existing = (tenant.settings as Record<string, unknown>) || {};
      const existingBranding =
        ((existing as { branding?: Record<string, unknown> }).branding as Record<string, unknown>) || {};
      await supabase
        .from('tenants')
        .update({
          // Only the logo changes here. Merging keeps the colours, currency
          // and every other setting intact.
          settings: mergeSettings(existing, {
            branding: { ...existingBranding, logo_url: newLogoUrl },
          }),
        })
        .eq('id', tenant.id);

      setLogoUrl(newLogoUrl);
      await refreshTenant();
    } catch (err) {
      console.error('Error uploading logo:', err);
      const supaErr = err as { message?: string } | null;
      setLogoError(supaErr?.message || 'Failed to upload logo');
    } finally {
      setLogoUploading(false);
    }
  };

  const openIntegrationForm = (integration: IntegrationDef) => {
    setActiveIntegration(integration);
    setIntegrationForm(integrationSettings[integration.id] || {});
    setIntegrationError(null);
  };

  const closeIntegrationForm = () => {
    setActiveIntegration(null);
    setIntegrationForm({});
    setIntegrationError(null);
  };

  const openUserForm = (user?: TenantAdmin) => {
    if (user) {
      setEditingUser(user);
      setUserForm({
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        phone: user.phone ?? '',
        mode: 'invite',
        password: '',
      });
    } else {
      setEditingUser(null);
      setUserForm({ email: '', full_name: '', role: 'teller', phone: '', mode: 'invite', password: '' });
    }
    setUserError(null);
    setTempPasswordNotice(null);
    setShowUserForm(true);
  };

  const closeUserForm = () => {
    setShowUserForm(false);
    setEditingUser(null);
    setUserForm({ email: '', full_name: '', role: 'teller', phone: '', mode: 'invite', password: '' });
    setUserError(null);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError(null);

    if (!tenant) {
      setUserError('No institution context. Please sign in again.');
      return;
    }
    const email = userForm.email.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setUserError('Enter a valid email address.');
      return;
    }
    if (!userForm.full_name.trim()) {
      setUserError('Enter the person\u2019s full name.');
      return;
    }

    setUserSaving(true);
    try {
      if (editingUser) {
        // Email is not editable: it is the key the person signs in with, and
        // changing it here would silently orphan their account.
        const { error } = await supabase
          .from('tenant_admins')
          .update({
            full_name: userForm.full_name.trim(),
            role: userForm.role as TenantAdmin['role'],
            phone: userForm.phone.trim() || null,
          })
          .eq('id', editingUser.id)
          .eq('tenant_id', tenant.id);
        if (error) throw error;
      } else {
        if (userForm.mode === 'password' && userForm.password.length < 8) {
          setUserError('Temporary password must be at least 8 characters.');
          setUserSaving(false);
          return;
        }

        // Creating a login needs the service role key, which bypasses every
        // row-level policy and so can never live in the browser. The Edge
        // Function holds it and re-checks server-side that the caller really
        // is an admin of this institution before creating anything.
        const { data, error } = await supabase.functions.invoke('create-tenant-user', {
          body: {
            tenant_id: tenant.id,
            email,
            full_name: userForm.full_name.trim(),
            role: userForm.role,
            phone: userForm.phone.trim() || null,
            branch_id: branch?.id ?? null,
            mode: userForm.mode,
            password: userForm.mode === 'password' ? userForm.password : undefined,
          },
        });

        if (error) {
          throw new Error(
            `${error.message}. Has the "create-tenant-user" Edge Function been deployed?`
          );
        }
        if (!data?.success) {
          throw new Error(data?.message ?? 'Could not create the user.');
        }

        // Shown once so the admin can pass it on. Never stored: it is
        // invalidated the moment the person signs in and sets their own.
        if (data.temp_password) {
          setTempPasswordNotice(
            `Account created for ${email}. Temporary password: ${data.temp_password} — they will be asked to change it when they first sign in.`
          );
        } else {
          setTempPasswordNotice(data.message ?? null);
        }
      }

      await loadAdmins();
      // Leave the dialog open when there is a password to read; closing it
      // would lose the only copy.
      if (!userForm.password) {
        closeUserForm();
      }
    } catch (err) {
      console.error('Error saving user:', err);
      setUserError(err instanceof Error ? err.message : 'Failed to save user');
    } finally {
      setUserSaving(false);
    }
  };

  const toggleUserStatus = async (user: TenantAdmin) => {
    if (!tenant) return;
    // Deactivating yourself would lock you out of the very page needed to
    // undo it.
    if (user.id === admin?.id) {
      setUserError('You cannot deactivate your own account.');
      return;
    }
    try {
      const { error } = await supabase
        .from('tenant_admins')
        .update({ status: user.status === 'active' ? 'inactive' : 'active' })
        .eq('id', user.id)
        .eq('tenant_id', tenant.id);
      if (error) throw error;
      await loadAdmins();
    } catch (err) {
      console.error('Error updating user status:', err);
      setUserError(err instanceof Error ? err.message : 'Failed to update user');
    }
  };

  const handleSaveIntegration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !activeIntegration) return;
    setIntegrationError(null);

    const missing = activeIntegration.fields.find((f) => !integrationForm[f.key]?.trim());
    if (missing) {
      setIntegrationError(`${missing.label} is required.`);
      return;
    }

    setIntegrationSaving(true);
    try {
      const updatedIntegrations = {
        ...integrationSettings,
        [activeIntegration.id]: {
          ...integrationForm,
          enabled: 'true',
          configured_at: new Date().toISOString(),
        },
      };

      const existing = (tenant.settings as Record<string, unknown>) || {};
      const { error } = await supabase
        .from('tenants')
        .update({
          // This previously overwrote branding, currency and timezone with
          // empty values, so configuring an integration silently reset the
          // institution's colours. Only integrations change here.
          settings: mergeSettings(existing, { integrations: updatedIntegrations }),
        })
        .eq('id', tenant.id);
      if (error) throw error;

      setIntegrationSettings(updatedIntegrations);
      await refreshTenant();
      closeIntegrationForm();
    } catch (err) {
      console.error('Error saving integration:', err);
      const supaErr = err as { message?: string; details?: string; hint?: string } | null;
      setIntegrationError(
        supaErr?.message || supaErr?.details || supaErr?.hint || 'Failed to save integration'
      );
    } finally {
      setIntegrationSaving(false);
    }
  };

  const openCreateBranchForm = () => {
    setBranchFormData({
      ...EMPTY_BRANCH_FORM,
      operating_currency:
        (tenant?.settings as { default_currency?: string } | null)?.default_currency || 'KES',
    });
    setBranchFormError(null);
    setShowBranchForm(true);
  };

  const closeBranchForm = () => {
    setShowBranchForm(false);
    setBranchFormData(EMPTY_BRANCH_FORM);
    setBranchFormError(null);
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setBranchFormError(null);

    if (!tenant) {
      setBranchFormError('No institution context found. Please sign in again.');
      return;
    }
    if (!branchFormData.name.trim()) {
      setBranchFormError('Branch name is required.');
      return;
    }
    if (!branchFormData.code.trim()) {
      setBranchFormError('Branch code is required.');
      return;
    }
    const codeExists = branches.some(
      (b) => b.code.trim().toLowerCase() === branchFormData.code.trim().toLowerCase()
    );
    if (codeExists) {
      setBranchFormError(`Branch code "${branchFormData.code.trim()}" is already in use.`);
      return;
    }

    setBranchSubmitting(true);
    try {
      const { error } = await supabase.from('branches').insert({
        tenant_id: tenant.id,
        name: branchFormData.name.trim(),
        code: branchFormData.code.trim(),
        address: branchFormData.address.trim() || null,
        is_head_office: false,
        status: 'active',
        operating_currencies: [branchFormData.operating_currency],
        first_day_setup_completed: false,
      });
      if (error) throw error;

      await refreshTenant();
      closeBranchForm();
    } catch (err) {
      console.error('Error creating branch:', err);
      const supaErr = err as { message?: string; details?: string; hint?: string } | null;
      setBranchFormError(
        supaErr?.message || supaErr?.details || supaErr?.hint || 'Failed to create branch'
      );
    } finally {
      setBranchSubmitting(false);
    }
  };

  const tabs = [
    { id: 'general', label: 'General', icon: <Settings className="w-4 h-4" /> },
    { id: 'users', label: 'Users', icon: <Users className="w-4 h-4" /> },
    { id: 'branches', label: 'Branches', icon: <Building className="w-4 h-4" /> },
    { id: 'branding', label: 'Branding', icon: <Palette className="w-4 h-4" /> },
    { id: 'compliance', label: 'Compliance', icon: <Shield className="w-4 h-4" /> },
    { id: 'integrations', label: 'Integrations', icon: <Globe className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#641f60]">Settings</h1>
        <p className="text-slate-600 mt-1">Manage your institution settings and preferences</p>
      </div>

      <div className="bg-white rounded-xl border border-[#dae1e1] p-2">
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map(tabItem => (
            <button
              key={tabItem.id}
              onClick={() => setActiveTab(tabItem.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                activeTab === tabItem.id
                  ? 'bg-gradient-to-r from-[#ee7b22] to-[#c46040] text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tabItem.icon}
              {tabItem.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#dae1e1] overflow-hidden">
        {activeTab === 'general' && (
          <div className="p-6 space-y-6">
            <h2 className="text-lg font-semibold text-slate-900">General Settings</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Institution Name
                </label>
                <input
                  type="text"
                  value={formData.institution_name}
                  onChange={e => setFormData({ ...formData, institution_name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Default Currency
                </label>
                <CurrencySelect
                  value={formData.default_currency}
                  onChange={(v) => setFormData({ ...formData, default_currency: v })}
                />
                <p className="text-xs text-slate-400 mt-1">
                  Used as the display currency across dashboards and reports.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Timezone
                </label>
                <select
                  value={formData.timezone}
                  onChange={e => setFormData({ ...formData, timezone: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]"
                >
                  <option value="Africa/Nairobi">Africa/Nairobi (EAT)</option>
                  <option value="Africa/Kampala">Africa/Kampala</option>
                  <option value="Africa/Juba">Africa/Juba</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Website
                </label>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="url"
                    value={formData.website}
                    onChange={e => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://yourinstitution.com"
                    className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]"
                  />
                </div>
              </div>

              {/* Printed at the top of every remittance voucher and receipt.
                  Until now there was nowhere to enter them, so that header
                  rendered blank on every document the institution issued. */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Phone
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+254 700 000 000"
                    className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]"
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Physical Address
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                    placeholder="e.g. Kimathi Street, Nairobi, Kenya"
                    className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Appears in the header of remittance vouchers, receipts and invoices.
                </p>
              </div>
            </div>

            {/* A live preview, so it is obvious what these two fields are for
                and whether the result reads correctly before saving. */}
            {(formData.address.trim() || formData.phone.trim()) && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Document header preview
                </p>
                <div className="flex items-start gap-3">
                  {logoUrl && (
                    <img
                      src={logoUrl}
                      alt=""
                      className="h-10 w-auto object-contain flex-shrink-0"
                    />
                  )}
                  <div className="text-sm leading-snug">
                    <p className="font-bold text-slate-900">
                      {formData.institution_name || 'Your institution'}
                    </p>
                    {formData.address.trim() && (
                      <p className="text-slate-600 text-xs">{formData.address}</p>
                    )}
                    {formData.phone.trim() && (
                      <p className="text-slate-600 text-xs">T: {formData.phone}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              {saveMessage && <span className="text-sm text-slate-500">{saveMessage}</span>}
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="px-6 py-2.5 bg-gradient-to-r from-[#ee7b22] to-[#c46040] text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Save Changes
              </button>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-900">User Management</h2>
              <button
                onClick={() => openUserForm()}
                className="px-4 py-2 bg-[#1ebcb2] hover:bg-[#159089] text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add User
              </button>
            </div>
            {userError && !showUserForm && (
              <div className="mb-4 p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                {userError}
              </div>
            )}
            <div className="divide-y divide-[#dae1e1]">
              {admins.map(adminUser => (
                <div key={adminUser.id} className="py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1ebcb2] to-[#7eccc6] flex items-center justify-center text-white font-medium">
                      {adminUser.full_name?.[0] || 'U'}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{adminUser.full_name}</p>
                      <p className="text-sm text-slate-500">{adminUser.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 capitalize">
                      {adminUser.role.replace(/_/g, ' ')}
                    </span>
                    {/* Pending means invited but not yet signed in: the row is
                        linked to an auth account on their first login. */}
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                        adminUser.status === 'active'
                          ? 'bg-[#1ebcb2]/10 text-[#1ebcb2]'
                          : adminUser.status === 'pending'
                          ? 'bg-[#ee7b22]/10 text-[#ee7b22]'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {adminUser.status}
                    </span>
                    <button
                      onClick={() => openUserForm(adminUser)}
                      className="p-2 rounded-lg text-slate-400 hover:text-[#641f60] hover:bg-slate-100 transition-colors"
                      aria-label="Edit user"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    {adminUser.id !== admin?.id && (
                      <button
                        onClick={() => toggleUserStatus(adminUser)}
                        className={`p-2 rounded-lg transition-colors ${
                          adminUser.status === 'active'
                            ? 'text-slate-400 hover:text-[#c46040] hover:bg-[#c46040]/10'
                            : 'text-slate-400 hover:text-[#1ebcb2] hover:bg-[#1ebcb2]/10'
                        }`}
                        aria-label={adminUser.status === 'active' ? 'Deactivate' : 'Activate'}
                        title={adminUser.status === 'active' ? 'Deactivate' : 'Activate'}
                      >
                        <Shield className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'branches' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-900">Branch Management</h2>
              <button
                onClick={openCreateBranchForm}
                className="px-4 py-2 bg-[#1ebcb2] hover:bg-[#159089] text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Branch
              </button>
            </div>
            {branches.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-4">
                {branches.map(b => (
                  <div key={b.id} className={`p-4 rounded-lg border ${b.id === branch?.id ? 'border-[#1ebcb2] bg-[#1ebcb2]/5' : 'border-[#dae1e1]'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-slate-900">{b.name}</span>
                      {b.is_head_office && (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">HQ</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500">{b.code}</p>
                    <p className="text-xs text-slate-400 mt-2">
                      Status: <span className={b.status === 'active' ? 'text-green-600' : 'text-slate-500'}>{b.status}</span>
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <Building className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No branches yet</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'branding' && (
          <div className="p-6 space-y-6">
            <h2 className="text-lg font-semibold text-slate-900">Branding</h2>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Logo</label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Institution logo" className="w-full h-full object-contain" />
                  ) : (
                    <Building className="w-8 h-8 text-slate-300" />
                  )}
                </div>
                <div>
                  <label className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors">
                    {logoUploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    {logoUploading ? 'Uploading...' : 'Upload logo'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={logoUploading}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-slate-400 mt-1.5">PNG, JPG, or SVG. Max 2MB.</p>
                  {logoError && <p className="text-xs text-[#c46040] mt-1">{logoError}</p>}
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Primary Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.primary_color}
                    onChange={e => {
                      const v = e.target.value;
                      setFormData(prev => ({ ...prev, primary_color: v }));
                      previewBranding(v, formData.secondary_color, formData.accent_color);
                    }}
                    className="w-12 h-12 rounded-lg cursor-pointer border border-slate-300"
                  />
                  <input
                    type="text"
                    value={formData.primary_color}
                    onChange={e => {
                      const v = e.target.value;
                      setFormData(prev => ({ ...prev, primary_color: v }));
                      previewBranding(v, formData.secondary_color, formData.accent_color);
                    }}
                    className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Secondary Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.secondary_color}
                    onChange={e => {
                      const v = e.target.value;
                      setFormData(prev => ({ ...prev, secondary_color: v }));
                      previewBranding(formData.primary_color, v, formData.accent_color);
                    }}
                    className="w-12 h-12 rounded-lg cursor-pointer border border-slate-300"
                  />
                  <input
                    type="text"
                    value={formData.secondary_color}
                    onChange={e => {
                      const v = e.target.value;
                      setFormData(prev => ({ ...prev, secondary_color: v }));
                      previewBranding(formData.primary_color, v, formData.accent_color);
                    }}
                    className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Accent Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.accent_color}
                    onChange={e => {
                      const v = e.target.value;
                      setFormData(prev => ({ ...prev, accent_color: v }));
                      previewBranding(formData.primary_color, formData.secondary_color, v);
                    }}
                    className="w-12 h-12 rounded-lg cursor-pointer border border-slate-300"
                  />
                  <input
                    type="text"
                    value={formData.accent_color}
                    onChange={e => {
                      const v = e.target.value;
                      setFormData(prev => ({ ...prev, accent_color: v }));
                      previewBranding(formData.primary_color, formData.secondary_color, v);
                    }}
                    className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Live preview strip so the admin sees the palette immediately. */}
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Preview</p>
              <div className="flex flex-wrap gap-3">
                <span
                  className="px-4 py-2 rounded-lg text-sm font-medium"
                  style={{ backgroundColor: 'var(--brand-primary)', color: 'var(--brand-primary-text)' }}
                >
                  Primary button
                </span>
                <span
                  className="px-4 py-2 rounded-lg text-sm font-medium"
                  style={{ backgroundColor: 'var(--brand-secondary)', color: 'var(--brand-secondary-text)' }}
                >
                  Secondary
                </span>
                <span
                  className="px-4 py-2 rounded-lg text-sm font-medium"
                  style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-accent-text)' }}
                >
                  Accent
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Colors preview instantly. Click &ldquo;Save Branding&rdquo; to make them permanent.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              {saveMessage && <span className="text-sm text-slate-500">{saveMessage}</span>}
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="px-6 py-2.5 bg-gradient-to-r from-[#ee7b22] to-[#c46040] text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Save Branding
              </button>
            </div>
          </div>
        )}

        {activeTab === 'compliance' && (
          <div className="p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-6">Compliance Settings</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-[#dae1e1] rounded-lg">
                <div>
                  <p className="font-medium text-slate-900">KYC Required</p>
                  <p className="text-sm text-slate-500">Require KYC verification for all customers</p>
                </div>
                <input type="checkbox" defaultChecked className="w-5 h-5 text-[#1ebcb2]" />
              </div>
              <div className="flex items-center justify-between p-4 border border-[#dae1e1] rounded-lg">
                <div>
                  <p className="font-medium text-slate-900">AML Screening</p>
                  <p className="text-sm text-slate-500">Enable AML screening for transactions</p>
                </div>
                <input type="checkbox" defaultChecked className="w-5 h-5 text-[#1ebcb2]" />
              </div>
              <div className="flex items-center justify-between p-4 border border-[#dae1e1] rounded-lg">
                <div>
                  <p className="font-medium text-slate-900">Large Transaction Threshold</p>
                  <p className="text-sm text-slate-500">Transactions above this amount require approval</p>
                </div>
                <input
                  type="number"
                  defaultValue={10000}
                  className="w-32 px-3 py-2 border border-slate-300 rounded-lg text-right"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'integrations' && (
          <div className="p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Integrations</h2>
            <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-6">
              <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#ee7b22]" />
              <span>
                Credentials entered here are stored on your tenant record. Before going live with
                real payment processing, move production secrets to server-side storage (Supabase
                Vault / Edge Function secrets) rather than a client-readable table.
              </span>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {INTEGRATIONS.map((integration) => {
                const configured = integrationSettings[integration.id]?.enabled === 'true';
                return (
                  <div
                    key={integration.id}
                    className="p-4 border border-[#dae1e1] rounded-lg flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900">{integration.label}</p>
                        {configured && (
                          <span className="flex items-center gap-1 text-xs text-[#1ebcb2] font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Connected
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">
                        {configured ? 'Configured' : `Configure ${integration.label} integration`}
                      </p>
                    </div>
                    <button
                      onClick={() => openIntegrationForm(integration)}
                      className="px-4 py-2 border border-[#dae1e1] rounded-lg text-sm hover:bg-slate-50 transition-colors"
                    >
                      {configured ? 'Edit' : 'Configure'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Create Branch modal */}
      {showBranchForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl shadow-2xl flex flex-col h-full sm:h-auto sm:max-h-[90vh] overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg sm:text-xl font-bold text-[#641f60]">Add Branch</h2>
              <button
                onClick={closeBranchForm}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              id="add-branch-form"
              onSubmit={handleCreateBranch}
              className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-5 space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Branch Name *</label>
                <input
                  type="text"
                  required
                  value={branchFormData.name}
                  onChange={(e) => setBranchFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  placeholder="Mombasa Branch"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Branch Code *</label>
                <input
                  type="text"
                  required
                  value={branchFormData.code}
                  onChange={(e) => setBranchFormData((prev) => ({ ...prev, code: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  placeholder="MSA-01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  value={branchFormData.address}
                  onChange={(e) => setBranchFormData((prev) => ({ ...prev, address: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Operating Currency</label>
                <CurrencySelect
                  value={branchFormData.operating_currency}
                  onChange={(v) => setBranchFormData((prev) => ({ ...prev, operating_currency: v }))}
                />
              </div>

              {branchFormError && (
                <div className="p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm">
                  {branchFormError}
                </div>
              )}
            </form>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-200 flex-shrink-0 bg-white">
              <button
                type="button"
                onClick={closeBranchForm}
                className="px-4 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="add-branch-form"
                disabled={branchSubmitting}
                className="px-6 py-2.5 bg-[#1ebcb2] hover:bg-[#159089] text-white font-medium rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
              >
                {branchSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    Create Branch
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Configure Integration modal */}
      {activeIntegration && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl shadow-2xl flex flex-col h-full sm:h-auto sm:max-h-[90vh] overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg sm:text-xl font-bold text-[#641f60]">
                Configure {activeIntegration.label}
              </h2>
              <button
                onClick={closeIntegrationForm}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              id="configure-integration-form"
              onSubmit={handleSaveIntegration}
              className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-5 space-y-4"
            >
              {activeIntegration.fields.map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {field.label} *
                  </label>
                  {field.type === 'select' ? (
                    <select
                      required
                      value={integrationForm[field.key] || ''}
                      onChange={(e) =>
                        setIntegrationForm((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    >
                      <option value="">Select...</option>
                      {field.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type}
                      required
                      value={integrationForm[field.key] || ''}
                      onChange={(e) =>
                        setIntegrationForm((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      placeholder={field.placeholder}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    />
                  )}
                </div>
              ))}

              {integrationError && (
                <div className="p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm">
                  {integrationError}
                </div>
              )}
            </form>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-200 flex-shrink-0 bg-white">
              <button
                type="button"
                onClick={closeIntegrationForm}
                className="px-4 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="configure-integration-form"
                disabled={integrationSaving}
                className="px-6 py-2.5 bg-[#1ebcb2] hover:bg-[#159089] text-white font-medium rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
              >
                {integrationSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / edit user */}
      {showUserForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-[#641f60]">
                {editingUser ? 'Edit User' : 'Add User'}
              </h2>
              <button
                type="button"
                onClick={closeUserForm}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  disabled={!!editingUser}
                  value={userForm.email}
                  onChange={(e) => setUserForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="person@institution.co.ke"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] disabled:bg-slate-50 disabled:text-slate-500"
                />
                <p className="text-xs text-slate-400 mt-1">
                  {editingUser
                    ? 'Email is fixed: it is how this person signs in.'
                    : 'They can be invited before registering. Their account links to this row the first time they sign in with this email.'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={userForm.full_name}
                  onChange={(e) => setUserForm((p) => ({ ...p, full_name: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={userForm.phone}
                  onChange={(e) => setUserForm((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]"
                />
              </div>

              {/* How the account gets its password. Only relevant when
                  creating: an existing member's password is never touched
                  from here. */}
              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    How should they sign in?
                  </label>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setUserForm((p) => ({ ...p, mode: 'invite' }))}
                      className={`w-full flex items-start gap-2.5 p-3 rounded-lg border-2 text-left transition-all ${
                        userForm.mode === 'invite'
                          ? 'border-[#1ebcb2] bg-[#1ebcb2]/[0.07]'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <CheckCircle2
                        className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                          userForm.mode === 'invite' ? 'text-[#1ebcb2]' : 'text-slate-300'
                        }`}
                      />
                      <span>
                        <span className="block text-sm font-semibold text-slate-900">
                          Email them an invite
                        </span>
                        <span className="block text-xs text-slate-500 mt-0.5">
                          They set their own password from a link. Nobody else ever knows it.
                        </span>
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setUserForm((p) => ({ ...p, mode: 'password' }))}
                      className={`w-full flex items-start gap-2.5 p-3 rounded-lg border-2 text-left transition-all ${
                        userForm.mode === 'password'
                          ? 'border-[#ee7b22] bg-[#ee7b22]/[0.07]'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <Shield
                        className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                          userForm.mode === 'password' ? 'text-[#ee7b22]' : 'text-slate-300'
                        }`}
                      />
                      <span>
                        <span className="block text-sm font-semibold text-slate-900">
                          Set a temporary password
                        </span>
                        <span className="block text-xs text-slate-500 mt-0.5">
                          For staff without email. They must change it when they first sign in.
                        </span>
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {!editingUser && userForm.mode === 'password' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Temporary password *
                  </label>
                  <input
                    type="text"
                    value={userForm.password}
                    onChange={(e) => setUserForm((p) => ({ ...p, password: e.target.value }))}
                    placeholder="At least 8 characters"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] font-mono"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Shown in plain text so you can read it out. It stops working once they set
                    their own, which keeps their actions attributable to them alone.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role *</label>
                <select
                  required
                  value={userForm.role}
                  onChange={(e) => setUserForm((p) => ({ ...p, role: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]"
                >
                  <optgroup label="Operations">
                    <option value="teller">Teller</option>
                    <option value="cashier">Cashier</option>
                    <option value="customer_service">Customer Service</option>
                    <option value="forex_officer">Forex Officer</option>
                  </optgroup>
                  <optgroup label="Lending">
                    <option value="loan_officer">Loan Officer</option>
                  </optgroup>
                  <optgroup label="Finance">
                    <option value="accountant">Accountant</option>
                    <option value="finance_officer">Finance Officer</option>
                  </optgroup>
                  <optgroup label="Oversight">
                    <option value="compliance_officer">Compliance Officer</option>
                    <option value="auditor">Auditor</option>
                    <option value="branch_manager">Branch Manager</option>
                    <option value="head_office_admin">Head Office Admin</option>
                    <option value="institution_admin">Institution Admin</option>
                  </optgroup>
                </select>
                <p className="text-xs text-slate-400 mt-1">
                  The role decides which pages they can reach and what they can do there.
                </p>
              </div>

              {tempPasswordNotice && (
                <div className="p-3 bg-[#1ebcb2]/10 border border-[#1ebcb2]/30 rounded-lg text-sm">
                  <div className="flex items-start gap-2 text-slate-800">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#1ebcb2]" />
                    <span className="break-words">{tempPasswordNotice}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Note it down now: it is not stored and cannot be shown again.
                  </p>
                </div>
              )}

              {userError && (
                <div className="p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {userError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeUserForm}
                  className="px-4 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={userSaving}
                  className="px-6 py-2.5 bg-[#1ebcb2] hover:bg-[#159089] text-white font-medium rounded-lg shadow-lg disabled:opacity-50 flex items-center gap-2"
                >
                  {userSaving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : editingUser ? (
                    <Save className="w-5 h-5" />
                  ) : (
                    <Plus className="w-5 h-5" />
                  )}
                  {editingUser
                    ? 'Save Changes'
                    : userForm.mode === 'invite'
                    ? 'Send Invite'
                    : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}