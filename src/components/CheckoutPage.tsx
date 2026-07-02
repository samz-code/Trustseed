import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle2, ShieldCheck, Loader2 } from 'lucide-react';

const PLAN_DETAILS: Record<string, { label: string; price: number; features: string[] }> = {
  starter: {
    label: 'Starter',
    price: 99,
    features: ['1 branch', 'Up to 500 customers', 'Core wallets & transactions'],
  },
  professional: {
    label: 'Professional',
    price: 250,
    features: [
      'Up to 5 branches',
      'Unlimited customers',
      'Loans, savings & accounting modules',
      'Multi-level transaction approvals',
    ],
  },
  enterprise: {
    label: 'Enterprise',
    price: 500,
    features: ['Unlimited branches', 'Dedicated support', 'Custom integrations'],
  },
};

export function CheckoutPage() {
  const { pendingPlan, pendingInstitutionName, completeProvisioning, signOut, error } = useAuth();
  const [institutionName, setInstitutionName] = useState(pendingInstitutionName || '');
  const [submitting, setSubmitting] = useState(false);

  const plan = PLAN_DETAILS[pendingPlan || 'professional'] || PLAN_DETAILS.professional;

  const handlePay = async () => {
    if (!institutionName.trim()) return;
    setSubmitting(true);
    try {
      // PLACEHOLDER: replace this block with a real payment processor call
      // (Stripe Checkout Session, Paystack Popup, M-Pesa STK push, etc.).
      // On real success, the processor's webhook should call the same
      // provision_tenant_after_payment RPC server-side - this client-side
      // call is a stand-in until that's wired up.
      await completeProvisioning(institutionName.trim(), pendingPlan || 'professional');
    } catch {
      // error is already surfaced via useAuth().error
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-[#641f60] to-[#4a1646] p-6 text-white">
          <p className="text-white/70 text-sm">Almost there</p>
          <h1 className="text-xl font-bold mt-1">Activate your TrustSeed account</h1>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Institution name
            </label>
            <input
              type="text"
              value={institutionName}
              onChange={(e) => setInstitutionName(e.target.value)}
              placeholder="e.g. Amani Microfinance Ltd"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
            />
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-baseline justify-between mb-3">
              <span className="font-semibold text-slate-900">{plan.label} plan</span>
              <span className="text-2xl font-bold text-[#641f60]">
                ${plan.price}
                <span className="text-sm font-normal text-slate-500">/mo</span>
              </span>
            </div>
            <ul className="space-y-1.5">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-[#1ebcb2] flex-shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {error && (
            <div className="text-sm text-[#c46040] bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            onClick={handlePay}
            disabled={submitting || !institutionName.trim()}
            className="w-full py-3 bg-[#ee7b22] hover:bg-[#c46040] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Activating...
              </>
            ) : (
              `Pay $${plan.price}/mo to activate`
            )}
          </button>

          <p className="text-xs text-slate-400 flex items-center gap-1.5 justify-center">
            <ShieldCheck className="w-3.5 h-3.5" />
            Payment placeholder - wire up Stripe/Paystack here
          </p>

          <button
            onClick={() => signOut()}
            className="w-full text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            Sign out instead
          </button>
        </div>
      </div>
    </div>
  );
}