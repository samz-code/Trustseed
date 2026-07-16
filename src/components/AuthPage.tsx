import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Mail,
  Lock,
  User,
  Building2,
  ArrowRight,
  Loader2,
  Eye,
  EyeOff,
  Home,
} from 'lucide-react';

const PLANS = [
  { id: 'starter', label: 'Starter', price: 250 },
  { id: 'professional', label: 'Professional', price: 600 },
  { id: 'enterprise', label: 'Enterprise', price: 1500 },
] as const;

export function AuthPage() {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [institutionName, setInstitutionName] = useState('');
  const [plan, setPlan] = useState<(typeof PLANS)[number]['id']>('professional');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      if (mode === 'reset') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth?mode=reset`,
        });
        if (resetError) throw resetError;
        setSuccess('Password reset link sent! Check your email.');
      } else if (mode === 'signup') {
        await signUp(email, password, fullName, institutionName, plan);
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img
            src="/logo-bg.png"
            alt="Trust Seed"
            className="h-16 sm:h-20 md:h-24 w-auto object-contain"
          />
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-8">
          {/* Mode Tabs */}
          <div className="flex bg-slate-100 rounded-2xl p-1 mb-8">
            <button
              onClick={() => setMode('signin')}
              className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${mode === 'signin' ? 'bg-white shadow-sm text-[#641f60]' : 'text-slate-500'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${mode === 'signup' ? 'bg-white shadow-sm text-[#641f60]' : 'text-slate-500'}`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      disabled={submitting}
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#1ebcb2]"
                      placeholder="John Doe"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Institution Name</label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      value={institutionName}
                      onChange={(e) => setInstitutionName(e.target.value)}
                      required
                      disabled={submitting}
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#1ebcb2]"
                      placeholder="Amani Microfinance Ltd"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={submitting}
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#1ebcb2]"
                  placeholder="you@institution.com"
                />
              </div>
            </div>

            {(mode === 'signin' || mode === 'signup') && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={submitting}
                    minLength={6}
                    className="w-full pl-11 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#1ebcb2]"
                    placeholder="Min 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>

                {mode === 'signin' && (
                  <div className="text-right mt-2">
                    <button
                      type="button"
                      onClick={() => setMode('reset')}
                      className="text-sm text-[#ee7b22] hover:underline font-medium"
                    >
                      Forgot Password?
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Improved Plans Section - Visible on Mobile */}
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">Choose Plan</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {PLANS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPlan(p.id)}
                      disabled={submitting}
                      className={`p-4 rounded-2xl border text-center transition-all ${
                        plan === p.id
                          ? 'border-[#1ebcb2] bg-[#1ebcb2]/10 text-[#641f60] shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-semibold text-base">{p.label}</div>
                      <div className="text-2xl font-bold mt-1 text-[#641f60]">${p.price}</div>
                      <div className="text-xs text-slate-500">per month</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm">{error}</div>}
            {success && <div className="p-4 bg-green-50 border border-green-200 rounded-2xl text-green-700 text-sm">{success}</div>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 bg-[#ee7b22] hover:bg-[#c46040] text-white font-semibold rounded-2xl shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-base"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : mode === 'reset' ? (
                'Send Reset Link'
              ) : mode === 'signup' ? (
                'Continue to Payment'
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-500">
          <button onClick={() => navigate('/')} className="flex items-center gap-1.5 hover:text-[#641f60] transition-colors font-medium">
            <Home className="w-4 h-4" /> Back to Home
          </button>
          <span className="text-slate-300">•</span>
          <button onClick={() => navigate('/terms-of-service')} className="hover:text-[#641f60] underline underline-offset-2 transition-colors">Terms of Service</button>
          <span className="text-slate-300">•</span>
          <button onClick={() => navigate('/privacy-policy')} className="hover:text-[#641f60] underline underline-offset-2 transition-colors">Privacy Policy</button>
        </div>
      </div>
    </div>
  );
}