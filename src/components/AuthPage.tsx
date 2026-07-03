import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Mail,
  Lock,
  User,
  Building2,
  ArrowRight,
  Loader2,
  Eye,
  EyeOff,
  ArrowLeft,
  ShieldCheck,
  Layers,
  Globe,
} from 'lucide-react';

const PLANS = [
  { id: 'starter', label: 'Starter', price: 250 },
  { id: 'professional', label: 'Professional', price: 600 },
  { id: 'enterprise', label: 'Enterprise', price: 1500 },
] as const;

export function AuthPage() {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [institutionName, setInstitutionName] = useState('');
  const [plan, setPlan] = useState<(typeof PLANS)[number]['id']>('professional');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (isSignUp) {
        await signUp(email, password, fullName, institutionName, plan);
        // AuthContext now flips needsPayment=true, App.tsx routes to
        // CheckoutPage automatically - nothing further to do here.
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const highlights = [
    {
      icon: <Layers className="w-5 h-5" />,
      title: 'One platform',
      text: 'Customers, loans, savings, transfers, forex, and accounting together.',
    },
    {
      icon: <ShieldCheck className="w-5 h-5" />,
      title: 'Secure by design',
      text: 'Role-based access, tenant isolation, and full audit logging.',
    },
    {
      icon: <Globe className="w-5 h-5" />,
      title: 'Built for Africa',
      text: 'Multi-currency and mobile-money ready out of the box.',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white">
      {/* ===== Left: brand panel (desktop only) ===== */}
      <aside className="hidden lg:flex lg:w-[55%] xl:w-3/5 relative overflow-hidden bg-[#641f60]">
        {/* Ambient brand glows */}
        <div className="absolute -top-32 -right-24 w-[28rem] h-[28rem] rounded-full bg-[#1ebcb2]/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 w-[28rem] h-[28rem] rounded-full bg-[#ee7b22]/20 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#641f60] via-[#641f60] to-[#4a1646]" />

        {/* subtle grid texture so the lower empty area doesn't feel flat */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        <div className="relative z-10 flex flex-col justify-between w-full p-12 xl:p-16 2xl:p-20 text-white">
          {/* Brand lockup - text only, no image dependency */}
        
          {/* Value proposition */}
          <div className="max-w-lg py-12">
            <h2 className="text-4xl xl:text-5xl font-bold leading-[1.1] mb-6">
              Run your institution on one platform.
            </h2>
            <p className="text-lg text-white/80 leading-relaxed mb-12">
              Core banking for microfinance institutions, SACCOs, credit unions, and money
              transfer operators across Africa.
            </p>

            <div className="space-y-7">
              {highlights.map((h, idx) => (
                <div key={idx} className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center text-[#1ebcb2] flex-shrink-0">
                    {h.icon}
                  </div>
                  <div className="pt-0.5">
                    <p className="font-semibold text-base">{h.title}</p>
                    <p className="text-sm text-white/70 leading-relaxed">{h.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom trust strip - fills the previously empty space */}
          <div className="flex items-center gap-8 pt-8 border-t border-white/10">
            <div>
              <p className="text-2xl font-bold">5</p>
              <p className="text-xs text-white/60">Countries served</p>
            </div>
            <div className="w-px h-8 bg-white/15" />
            <div>
              <p className="text-2xl font-bold">99.9%</p>
              <p className="text-xs text-white/60">Uptime SLA</p>
            </div>
            <div className="w-px h-8 bg-white/15" />
            <div>
              <p className="text-2xl font-bold">24/7</p>
              <p className="text-xs text-white/60">Support</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ===== Right: form ===== */}
      <main className="flex-1 flex items-center justify-center bg-[#dae1e1]/25 px-6 py-10 sm:px-10 md:px-16 lg:px-12 xl:px-20">
        <div className="w-full max-w-md mx-auto">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-slate-600 hover:text-[#641f60] mb-10 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>

          {/* Mobile / tablet logo (brand panel is hidden below lg) */}
          <div className="lg:hidden text-center mb-10">
            <img
              src="/logo-bg.png"
              alt="Trust Seed"
              className="h-20 sm:h-24 w-auto max-w-[260px] object-contain rounded-lg mx-auto mb-4"
            />
          </div>

          {/* Desktop contextual heading */}
          <div className="mb-8 hidden lg:block">
            <h2 className="text-3xl font-bold text-[#641f60] mb-2">
              {isSignUp ? 'Create your account' : 'Welcome back'}
            </h2>
            <p className="text-slate-600">
              {isSignUp
                ? 'Register your institution to get started.'
                : 'Sign in to your institution dashboard.'}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 border border-[#dae1e1]">
            <div className="flex mb-7 bg-slate-100 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setIsSignUp(false)}
                disabled={submitting}
                className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${
                  !isSignUp ? 'bg-white text-[#641f60] shadow-md' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setIsSignUp(true)}
                disabled={submitting}
                className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${
                  isSignUp ? 'bg-white text-[#641f60] shadow-md' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Register
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {isSignUp && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      disabled={submitting}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-[#dae1e1] rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent transition-all disabled:opacity-50"
                      placeholder="John Doe"
                    />
                  </div>
                </div>
              )}

              {isSignUp && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Institution Name
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      value={institutionName}
                      onChange={(e) => setInstitutionName(e.target.value)}
                      required
                      disabled={submitting}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-[#dae1e1] rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent transition-all disabled:opacity-50"
                      placeholder="Amani Microfinance Ltd"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={submitting}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-[#dae1e1] rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent transition-all disabled:opacity-50"
                    placeholder="you@institution.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={submitting}
                    minLength={6}
                    className="w-full pl-10 pr-12 py-3 bg-slate-50 border border-[#dae1e1] rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent transition-all disabled:opacity-50"
                    placeholder="Min 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {isSignUp && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Plan</label>
                  <div className="grid grid-cols-3 gap-2">
                    {PLANS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPlan(p.id)}
                        disabled={submitting}
                        className={`py-2.5 px-2 rounded-lg border text-center transition-all ${
                          plan === p.id
                            ? 'border-[#1ebcb2] bg-[#1ebcb2]/10 text-[#641f60]'
                            : 'border-[#dae1e1] text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <div className="text-xs font-medium">{p.label}</div>
                        <div className="text-sm font-bold mt-0.5">${p.price}/mo</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    {isSignUp ? 'Continue to Payment' : 'Sign In'}
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            {!isSignUp && (
              <p className="mt-5 text-center text-sm text-slate-600">
                New here?{' '}
                <button
                  type="button"
                  onClick={() => setIsSignUp(true)}
                  className="text-[#ee7b22] hover:underline font-medium"
                >
                  Register your institution
                </button>
              </p>
            )}

            {isSignUp && (
              <p className="mt-5 text-center text-sm text-slate-600">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setIsSignUp(false)}
                  className="text-[#ee7b22] hover:underline font-medium"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>

          <p className="mt-8 text-center text-xs text-slate-500 leading-relaxed">
            By continuing, you agree to our{' '}
            <button
              type="button"
              onClick={() => navigate('/terms-of-service')}
              className="text-[#641f60] hover:text-[#ee7b22] underline underline-offset-2 transition-colors"
            >
              Terms of Service
            </button>{' '}
            and{' '}
            <button
              type="button"
              onClick={() => navigate('/privacy-policy')}
              className="text-[#641f60] hover:text-[#ee7b22] underline underline-offset-2 transition-colors"
            >
              Privacy Policy
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}