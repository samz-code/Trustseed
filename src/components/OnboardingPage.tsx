import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { OnboardingPhase, TenantSettings } from '../types';
import { supabase } from '../lib/supabase';
import {
  Building2,
  User,
  CreditCard,
  DollarSign,
  Settings,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Globe,
  Palette,
  Shield,
  Users,
  Building,
  Landmark
} from 'lucide-react';

const ONBOARDING_PHASES: { key: OnboardingPhase; label: string; icon: React.ReactNode }[] = [
  { key: 'business_registration', label: 'Business Registration', icon: <Building2 className="w-5 h-5" /> },
  { key: 'administrator_setup', label: 'Administrator Setup', icon: <User className="w-5 h-5" /> },
  { key: 'subscription_selection', label: 'Subscription', icon: <CreditCard className="w-5 h-5" /> },
  { key: 'payment', label: 'Payment', icon: <DollarSign className="w-5 h-5" /> },
  { key: 'provisioning', label: 'Provisioning', icon: <Settings className="w-5 h-5" /> },
  { key: 'branch_setup', label: 'Branch Setup', icon: <Building className="w-5 h-5" /> },
  { key: 'first_day_setup', label: 'First Day Setup', icon: <Landmark className="w-5 h-5" /> },
];

const PLAN_DETAILS = {
  starter: {
    name: 'Starter',
    monthly: 250,
    annual: 3000,
    branches: 'Up to 2',
    users: 'Up to 10',
    features: ['Customers & Wallets', 'Savings Management', 'Basic Reports', 'Customer Portal'],
  },
  professional: {
    name: 'Professional',
    monthly: 600,
    annual: 7200,
    branches: 'Up to 10',
    users: 'Up to 50',
    features: [
      'All Starter Features',
      'Loans Management',
      'Money Transfer',
      'Forex Trading',
      'Advanced Reports',
      'API Access',
    ],
  },
  enterprise: {
    name: 'Enterprise',
    monthly: 1500,
    annual: 18000,
    branches: 'Unlimited',
    users: 'Unlimited',
    features: [
      'All Professional Features',
      'Custom Branding',
      'Dedicated Support',
      'Advanced Security',
      'Custom Integrations',
      'SLA Guarantee',
    ],
  },
};

const CURRENCIES = ['USD', 'EUR', 'GBP', 'KES', 'SSP', 'UGX', 'RWF', 'TZS', 'ZAR'];

interface FormData {
  // Phase 1: Business Registration
  institutionName: string;
  businessType: string;
  registrationNumber: string;
  taxNumber: string;
  country: string;
  physicalAddress: string;
  city: string;
  contactPhone: string;
  contactEmail: string;
  defaultCurrency: string;
  enabledCurrencies: string[];
  primaryColor: string;
  secondaryColor: string;
  timezone: string;
  language: string;
  // Phase 2: Administrator
  adminFullName: string;
  adminEmail: string;
  adminPhone: string;
  adminPosition: string;
  // Phase 3: Subscription
  selectedPlan: 'starter' | 'professional' | 'enterprise';
  billingCycle: 'monthly' | 'annual';
  // Phase 4: Payment - handled separately
}

const initialFormData: FormData = {
  institutionName: '',
  businessType: '',
  registrationNumber: '',
  taxNumber: '',
  country: '',
  physicalAddress: '',
  city: '',
  contactPhone: '',
  contactEmail: '',
  defaultCurrency: 'USD',
  enabledCurrencies: ['USD'],
  primaryColor: '#ee7b22',
  secondaryColor: '#1ebcb2',
  timezone: 'UTC',
  language: 'en',
  adminFullName: '',
  adminEmail: '',
  adminPhone: '',
  adminPosition: 'institution_admin',
  selectedPlan: 'starter',
  billingCycle: 'monthly',
};

export function OnboardingPage() {
  const { tenant, admin, refreshTenant } = useAuth();
  const [currentPhase, setCurrentPhase] = useState<OnboardingPhase>(
    tenant?.onboarding_phase || 'business_registration'
  );
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentPhaseIndex = ONBOARDING_PHASES.findIndex(p => p.key === currentPhase);

  const updateField = (field: keyof FormData, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const toggleCurrency = (currency: string) => {
    setFormData(prev => {
      const enabled = prev.enabledCurrencies.includes(currency);
      const newCurrencies = enabled
        ? prev.enabledCurrencies.filter(c => c !== currency)
        : [...prev.enabledCurrencies, currency];
      return {
        ...prev,
        enabledCurrencies: newCurrencies,
        defaultCurrency: newCurrencies.includes(prev.defaultCurrency)
          ? prev.defaultCurrency
          : newCurrencies[0] || 'USD',
      };
    });
  };

  const handleNext = async () => {
    setError(null);
    setLoading(true);

    try {
      if (currentPhase === 'business_registration') {
        if (!formData.institutionName || !formData.country || !formData.defaultCurrency) {
          throw new Error('Please fill in all required fields');
        }
      }

      if (currentPhase === 'administrator_setup') {
        if (!formData.adminFullName || !formData.adminEmail) {
          throw new Error('Please fill in all required fields');
        }
      }

      if (currentPhase === 'subscription_selection') {
        if (!tenant) throw new Error('Tenant not found');

        const planDetails = PLAN_DETAILS[formData.selectedPlan];
        const settings: Partial<TenantSettings> = {
          default_currency: formData.defaultCurrency,
          enabled_currencies: formData.enabledCurrencies,
          branding: {
            primary_color: formData.primaryColor,
            secondary_color: formData.secondaryColor,
            logo_url: null,
          },
          timezone: formData.timezone,
          language: formData.language,
        };

        const monthlyFee =
          formData.billingCycle === 'annual'
            ? planDetails.annual / 12
            : planDetails.monthly;

        const { error: subError } = await supabase.from('subscriptions').insert({
          tenant_id: tenant.id,
          plan: formData.selectedPlan,
          billing_cycle: formData.billingCycle,
          monthly_fee: monthlyFee,
          status: 'active',
          current_period_start: new Date().toISOString().split('T')[0],
          current_period_end:
            formData.billingCycle === 'annual'
              ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        });

        if (subError) throw subError;

        const { error: updateError } = await supabase
          .from('tenants')
          .update({
            settings: settings as unknown as TenantSettings,
            onboarding_phase: 'provisioning',
          })
          .eq('id', tenant.id);

        if (updateError) throw updateError;

        setCurrentPhase('provisioning');
        await refreshTenant();
        return;
      }

      if (currentPhase === 'payment') {
        setCurrentPhase('provisioning');
        return;
      }

      if (currentPhase === 'provisioning') {
        setCurrentPhase('branch_setup');
        return;
      }

      if (currentPhase === 'branch_setup') {
        setCurrentPhase('first_day_setup');
        return;
      }

      if (currentPhase === 'first_day_setup') {
        if (!tenant) throw new Error('Tenant not found');

        const { error: completeError } = await supabase
          .from('tenants')
          .update({
            onboarding_phase: 'completed',
            onboarding_completed: true,
          })
          .eq('id', tenant.id);

        if (completeError) throw completeError;

        await refreshTenant();
        return;
      }

      const nextIndex = currentPhaseIndex + 1;
      if (nextIndex < ONBOARDING_PHASES.length) {
        const nextPhase = ONBOARDING_PHASES[nextIndex].key;
        if (tenant) {
          await supabase
            .from('tenants')
            .update({ onboarding_phase: nextPhase })
            .eq('id', tenant.id);
        }
        setCurrentPhase(nextPhase);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const renderPhaseContent = () => {
    switch (currentPhase) {
      case 'business_registration':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-900">Register Your Institution</h2>
            <p className="text-slate-600">Tell us about your financial institution</p>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Institution Name *
                  </label>
                  <input
                    type="text"
                    value={formData.institutionName}
                    onChange={e => updateField('institutionName', e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-[#1ebcb2] transition-all"
                    placeholder="Enter institution name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Business Type
                  </label>
                  <select
                    value={formData.businessType}
                    onChange={e => updateField('businessType', e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-[#1ebcb2] transition-all"
                  >
                    <option value="">Select type</option>
                    <option value="microfinance">Microfinance Institution</option>
                    <option value="sacco">SACCO</option>
                    <option value="credit_institution">Credit Institution</option>
                    <option value="money_transfer">Money Transfer Operator</option>
                    <option value="forex_bureau">Forex Bureau</option>
                    <option value="agency_banking">Agency Banking</option>
                    <option value="ngo">NGO</option>
                    <option value="savings_group">Savings Group</option>
                    <option value="cooperative">Financial Cooperative</option>
                    <option value="digital_wallet">Digital Wallet Provider</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Registration Number
                  </label>
                  <input
                    type="text"
                    value={formData.registrationNumber}
                    onChange={e => updateField('registrationNumber', e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-[#1ebcb2] transition-all"
                    placeholder="Company registration number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Tax Identification Number
                  </label>
                  <input
                    type="text"
                    value={formData.taxNumber}
                    onChange={e => updateField('taxNumber', e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-[#1ebcb2] transition-all"
                    placeholder="Tax PIN or TIN"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Country *
                  </label>
                  <select
                    value={formData.country}
                    onChange={e => updateField('country', e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-[#1ebcb2] transition-all"
                  >
                    <option value="">Select country</option>
                    <option value="KE">Kenya</option>
                    <option value="UG">Uganda</option>
                    <option value="TZ">Tanzania</option>
                    <option value="RW">Rwanda</option>
                    <option value="SS">South Sudan</option>
                    <option value="NG">Nigeria</option>
                    <option value="GH">Ghana</option>
                    <option value="ZA">South Africa</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Physical Address
                  </label>
                  <input
                    type="text"
                    value={formData.physicalAddress}
                    onChange={e => updateField('physicalAddress', e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-[#1ebcb2] transition-all"
                    placeholder="Street address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={e => updateField('city', e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-[#1ebcb2] transition-all"
                    placeholder="City name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Contact Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.contactPhone}
                      onChange={e => updateField('contactPhone', e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-[#1ebcb2] transition-all"
                      placeholder="+254..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Contact Email
                    </label>
                    <input
                      type="email"
                      value={formData.contactEmail}
                      onChange={e => updateField('contactEmail', e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-[#1ebcb2] transition-all"
                      placeholder="info@..."
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-6 space-y-4">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <Globe className="w-5 h-5 text-[#1ebcb2]" />
                Currency Settings
              </h3>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Default Currency *
                  </label>
                  <select
                    value={formData.defaultCurrency}
                    onChange={e => updateField('defaultCurrency', e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-[#1ebcb2] transition-all"
                  >
                    {CURRENCIES.map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Enabled Currencies
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {CURRENCIES.map(currency => (
                      <button
                        key={currency}
                        type="button"
                        onClick={() => toggleCurrency(currency)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          formData.enabledCurrencies.includes(currency)
                            ? 'bg-[#ee7b22] text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {currency}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-6 space-y-4">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <Palette className="w-5 h-5 text-[#1ebcb2]" />
                Branding
              </h3>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Primary Color
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={formData.primaryColor}
                      onChange={e => updateField('primaryColor', e.target.value)}
                      className="w-12 h-12 rounded-lg cursor-pointer border border-slate-300"
                    />
                    <input
                      type="text"
                      value={formData.primaryColor}
                      onChange={e => updateField('primaryColor', e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Secondary Color
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={formData.secondaryColor}
                      onChange={e => updateField('secondaryColor', e.target.value)}
                      className="w-12 h-12 rounded-lg cursor-pointer border border-slate-300"
                    />
                    <input
                      type="text"
                      value={formData.secondaryColor}
                      onChange={e => updateField('secondaryColor', e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Timezone
                  </label>
                  <select
                    value={formData.timezone}
                    onChange={e => updateField('timezone', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="UTC">UTC</option>
                    <option value="Africa/Nairobi">Africa/Nairobi (EAT)</option>
                    <option value="Africa/Kampala">Africa/Kampala</option>
                    <option value="Africa/Dar_es_Salaam">Africa/Dar es Salaam</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        );

      case 'administrator_setup':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-900">Administrator Account</h2>
            <p className="text-slate-600">Set up your primary administrator who will manage this institution</p>

            <div className="bg-[#1ebcb2]/10 border border-[#1ebcb2]/30 rounded-lg p-4 flex gap-3">
              <Shield className="w-6 h-6 text-[#1ebcb2] flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-[#641f60]">Administrator Role</p>
                <p className="text-sm text-slate-600">
                  This account will have full access to manage your institution including user management, configuration, and operations.
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={formData.adminFullName}
                  onChange={e => updateField('adminFullName', e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-[#1ebcb2] transition-all"
                  placeholder="Enter administrator's full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Position
                </label>
                <select
                  value={formData.adminPosition}
                  onChange={e => updateField('adminPosition', e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-[#1ebcb2] transition-all"
                >
                  <option value="institution_admin">Institution Administrator</option>
                  <option value="head_office_admin">Head Office Administrator</option>
                  <option value="finance_officer">Finance Officer</option>
                  <option value="compliance_officer">Compliance Officer</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={formData.adminEmail}
                  onChange={e => updateField('adminEmail', e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-[#1ebcb2] transition-all"
                  placeholder="admin@institution.com"
                />
                {admin && (
                  <p className="text-sm text-slate-500 mt-1">
                    Using your logged-in account email
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.adminPhone}
                  onChange={e => updateField('adminPhone', e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-[#1ebcb2] transition-all"
                  placeholder="+254..."
                />
              </div>
            </div>
          </div>
        );

      case 'subscription_selection':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-slate-900">Choose Your Plan</h2>
              <p className="text-slate-600 mt-2">Select the subscription plan that best fits your institution</p>
            </div>

            <div className="flex justify-center gap-4 mb-6">
              <button
                type="button"
                onClick={() => updateField('billingCycle', 'monthly')}
                className={`px-6 py-2 rounded-lg font-medium transition-all ${
                  formData.billingCycle === 'monthly'
                    ? 'bg-[#ee7b22] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => updateField('billingCycle', 'annual')}
                className={`px-6 py-2 rounded-lg font-medium transition-all ${
                  formData.billingCycle === 'annual'
                    ? 'bg-[#ee7b22] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Annual (Save 17%)
              </button>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {(['starter', 'professional', 'enterprise'] as const).map(plan => {
                const details = PLAN_DETAILS[plan];
                const price = formData.billingCycle === 'annual' ? details.annual / 12 : details.monthly;
                const isSelected = formData.selectedPlan === plan;

                return (
                  <button
                    key={plan}
                    type="button"
                    onClick={() => updateField('selectedPlan', plan)}
                    className={`relative p-6 rounded-2xl border-2 text-left transition-all ${
                      isSelected
                        ? 'border-[#ee7b22] bg-[#ee7b22]/5 shadow-lg'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    {plan === 'professional' && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#ee7b22] text-white text-xs font-medium px-3 py-1 rounded-full">
                        Most Popular
                      </div>
                    )}
                    <h3 className="text-xl font-bold text-slate-900">{details.name}</h3>
                    <div className="mt-2 mb-4">
                      <span className="text-3xl font-bold text-slate-900">${price}</span>
                      <span className="text-slate-500">/month</span>
                      {formData.billingCycle === 'annual' && (
                        <span className="block text-sm text-[#1ebcb2] font-medium">
                          Billed annually (${details.annual}/year)
                        </span>
                      )}
                    </div>
                    <div className="space-y-2 text-sm text-slate-600 mb-4">
                      <p className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        {details.users} users
                      </p>
                      <p className="flex items-center gap-2">
                        <Building className="w-4 h-4" />
                        {details.branches} branches
                      </p>
                    </div>
                    <ul className="space-y-2">
                      {details.features.map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-sm text-slate-600">
                          <CheckCircle className="w-4 h-4 text-[#1ebcb2] flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>

            <div className="bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg p-4">
              <p className="text-sm text-[#c46040]">
                Minimum subscription: $250/month. All plans include customer support, automatic backups, and regular updates.
              </p>
            </div>
          </div>
        );

      case 'payment':
        return (
          <div className="space-y-6 text-center">
            <h2 className="text-2xl font-bold text-slate-900">Complete Payment</h2>
            <p className="text-slate-600">Secure payment processing</p>

            <div className="bg-slate-50 rounded-xl p-6 max-w-md mx-auto">
              <p className="text-sm text-slate-600 mb-2">Selected Plan</p>
              <p className="text-2xl font-bold text-slate-900">
                {PLAN_DETAILS[formData.selectedPlan].name}
              </p>
              <p className="text-lg text-slate-600 mt-2">
                ${PLAN_DETAILS[formData.selectedPlan].monthly}/month
                {formData.billingCycle === 'annual' && ' (billed annually)'}
              </p>
            </div>

            <p className="text-sm text-slate-500">
              Payment integration will be configured after initial setup.
              Your institution will be provisioned immediately.
            </p>
          </div>
        );

      case 'provisioning':
        return (
          <div className="space-y-6 text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Provisioning Complete!</h2>
            <p className="text-slate-600 max-w-md mx-auto">
              Your institution workspace has been created. We've set up your head office branch,
              user roles, and default configurations.
            </p>

            <div className="bg-slate-50 rounded-xl p-6 text-left max-w-md mx-auto">
              <h3 className="font-semibold text-slate-900 mb-4">What's been created:</h3>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Head Office Branch
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Administrator Account
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  {formData.selectedPlan === 'starter'
                    ? 'Core modules: Customers, Wallets, Savings'
                    : 'All modules including Loans, Forex, Transfers'}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Customer Portal
                </li>
              </ul>
            </div>
          </div>
        );

      case 'branch_setup':
        return (
          <div className="space-y-6 text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-[#1ebcb2]/20 flex items-center justify-center">
              <Building className="w-10 h-10 text-[#1ebcb2]" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Branch Management</h2>
            <p className="text-slate-600 max-w-md mx-auto">
              Your Head Office branch has been created. You can add additional branches
              from the settings page after completing setup.
            </p>

            <div className="bg-slate-50 rounded-xl p-6 text-left max-w-md mx-auto">
              <h3 className="font-semibold text-slate-900 mb-2">Head Office Branch</h3>
              <p className="text-sm text-slate-600">
                This is your primary branch location. All operations will start here.
              </p>
            </div>
          </div>
        );

      case 'first_day_setup':
        return (
          <div className="space-y-6 text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-amber-100 flex items-center justify-center">
              <Landmark className="w-10 h-10 text-amber-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Ready to Start!</h2>
            <p className="text-slate-600 max-w-md mx-auto">
              Your institution is set up and ready to go. Before processing your first transactions,
              you'll need to complete the First Day Setup from your dashboard.
            </p>

            <div className="bg-[#1ebcb2]/10 border border-[#1ebcb2]/30 rounded-xl p-6 text-left max-w-md mx-auto">
              <h3 className="font-semibold text-[#641f60] mb-2">First Day Setup includes:</h3>
              <ul className="space-y-2 text-sm text-slate-600">
                <li>Verify opening cash balances</li>
                <li>Set initial float amounts</li>
                <li>Confirm currency holdings</li>
                <li>Get manager approval to begin operations</li>
              </ul>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#dae1e1]/30">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-[#ee7b22] shadow-lg mb-4">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-[#641f60]">Trust Seed Setup</h1>
          <p className="text-slate-600 mt-1">{tenant?.name || 'Your Institution'}</p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-8 overflow-x-auto pb-4">
          {ONBOARDING_PHASES.map((phase, index) => {
            const isCompleted = index < currentPhaseIndex;
            const isCurrent = index === currentPhaseIndex;

            return (
              <React.Fragment key={phase.key}>
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                    isCompleted
                      ? 'bg-[#1ebcb2]/10 text-[#1ebcb2]'
                      : isCurrent
                      ? 'bg-[#641f60] text-white shadow-lg'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    phase.icon
                  )}
                  <span className="text-sm font-medium hidden sm:inline">{phase.label}</span>
                </div>
                {index < ONBOARDING_PHASES.length - 1 && (
                  <div
                    className={`w-8 h-0.5 ${
                      index < currentPhaseIndex ? 'bg-[#1ebcb2]' : 'bg-slate-200'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-[#dae1e1] p-8">
          {renderPhaseContent()}

          {error && (
            <div className="mt-6 p-4 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040]">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#dae1e1]">
            <button
              type="button"
              disabled={currentPhaseIndex === 0 || loading}
              onClick={() => {
                const prevIndex = currentPhaseIndex - 1;
                if (prevIndex >= 0) {
                  setCurrentPhase(ONBOARDING_PHASES[prevIndex].key);
                }
              }}
              className="px-6 py-2.5 text-slate-600 hover:text-[#641f60] font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
              Previous
            </button>

            <button
              type="button"
              onClick={handleNext}
              disabled={loading}
              className="px-6 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {currentPhase === 'first_day_setup' ? 'Complete Setup' : 'Continue'}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
