// Passwordless "Email me a login link" — drop this into your AuthPage.
//
// Invited users get their first login link in the invite email. For every
// login after that (or if the invite link expired), they use this: enter the
// email, receive a fresh magic link, click it, and they're signed in. No
// password is ever required.
//
// Requirements:
//   • Supabase → Authentication → Providers → Email: enable "Email OTP /
//     Magic Link" (it's on by default).
//   • Supabase → Authentication → URL Configuration → Redirect URLs: add your
//     app origin (the emailRedirectTo below).
//   • Your AuthContext should react to the resulting session (onAuthStateChange)
//     — the auto-link trigger (link_admin_on_signup.sql) connects the user to
//     their tenant_admins row.

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Mail, CheckCircle, AlertCircle } from 'lucide-react';

export function MagicLinkLogin() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }

    setSending(true);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          emailRedirectTo: window.location.origin,
          // Only let people who were invited (already exist) request a link,
          // so this can't be used to self-register random accounts. Remove
          // this line if you want open magic-link sign-up.
          shouldCreateUser: false,
        },
      });
      if (otpError) throw otpError;
      setSent(true);
    } catch (err) {
      // Supabase errors are plain objects — read message/details, not just Error.
      const e = err as { message?: string; error_description?: string } | null;
      setError(e?.message || e?.error_description || 'Could not send the login link.');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="p-4 bg-[#1ebcb2]/10 border border-[#1ebcb2]/30 rounded-lg text-sm text-slate-700 flex items-start gap-2">
        <CheckCircle className="w-5 h-5 text-[#1ebcb2] flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-slate-900">Check your email</p>
          <p>
            We sent a secure login link to <strong>{email.trim().toLowerCase()}</strong>. Click it to
            sign in — no password needed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSend} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@institution.com"
            className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
          />
        </div>
      </div>

      {error && (
        <div className="p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={sending}
        className="w-full inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg disabled:opacity-50 transition-all"
      >
        {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />}
        Email me a login link
      </button>
    </form>
  );
}