import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle2, ShieldCheck, Loader2, CreditCard, Smartphone, Wallet } from 'lucide-react';

const PLAN_DETAILS: Record<string, { label: string; price: number; features: string[] }> = {
  starter: {
    label: 'Starter',
    price: 250,
    features: [
      'Up to 2 branches',
      'Up to 10 users',
      'Customer & Wallet Management',
      'Savings Products',
      'Basic Reporting',
      'Email Support',
    ],
  },
  professional: {
    label: 'Professional',
    price: 600,
    features: [
      'Up to 10 branches',
      'Up to 50 users',
      'All Starter features',
      'Loan Management',
      'Money Transfers',
      'Forex Trading',
      'Advanced Analytics',
      'API Access',
      'Priority Support',
    ],
  },
  enterprise: {
    label: 'Enterprise',
    price: 1500,
    features: [
      'Unlimited branches',
      'Unlimited users',
      'All Professional features',
      'Custom Branding',
      'Dedicated Account Manager',
      'Custom Integrations',
      'On-premise Option',
      'SLA Guarantee',
    ],
  },
};

type PaymentMethod = 'card' | 'mpesa' | 'paypal';

const PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: typeof CreditCard }[] = [
  { id: 'card', label: 'Card', icon: CreditCard },
  { id: 'mpesa', label: 'M-Pesa', icon: Smartphone },
  { id: 'paypal', label: 'PayPal', icon: Wallet },
];

// Basic Kenyan mobile number check: 07XXXXXXXX, 01XXXXXXXX, or 254XXXXXXXXX.
function isValidMpesaNumber(value: string) {
  const digits = value.replace(/\s+/g, '');
  return /^(?:254|0)(7|1)\d{8}$/.test(digits);
}

export function CheckoutPage() {
  const { pendingPlan, pendingInstitutionName, completeProvisioning, signOut, error } = useAuth();
  const [institutionName, setInstitutionName] = useState(pendingInstitutionName || '');
  const [method, setMethod] = useState<PaymentMethod>('mpesa');
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [stkStatus, setStkStatus] = useState<'idle' | 'sent' | 'waiting'>('idle');

  const plan = PLAN_DETAILS[pendingPlan || 'professional'] || PLAN_DETAILS.professional;

  const validateBeforePay = (): string | null => {
    if (!institutionName.trim()) return 'Please enter your institution name.';
    if (method === 'mpesa' && !isValidMpesaNumber(mpesaPhone)) {
      return 'Enter a valid M-Pesa number, e.g. 0712345678.';
    }
    if (method === 'card') {
      if (cardNumber.replace(/\s+/g, '').length < 12) return 'Enter a valid card number.';
      if (!cardExpiry.trim()) return 'Enter the card expiry date.';
      if (cardCvc.trim().length < 3) return 'Enter a valid CVC.';
    }
    return null;
  };

  const handlePay = async () => {
    const validationError = validateBeforePay();
    if (validationError) {
      setLocalError(validationError);
      return;
    }
    setLocalError(null);
    setSubmitting(true);

    try {
      if (method === 'mpesa') {
        // PLACEHOLDER: trigger Safaricom Daraja / M-Pesa STK push here.
        // e.g. await fetch('/api/mpesa/stk-push', { method: 'POST', body: JSON.stringify({
        //   phone: mpesaPhone, amount: plan.price, accountRef: institutionName,
        // }) });
        // The backend should poll/callback and confirm payment before we call
        // completeProvisioning - for now this simulates that wait.
        setStkStatus('sent');
        await new Promise((resolve) => setTimeout(resolve, 1200));
        setStkStatus('waiting');
        await new Promise((resolve) => setTimeout(resolve, 1800));
      } else if (method === 'card') {
        // PLACEHOLDER: replace with Stripe/Paystack card charge.
        // e.g. const { error: chargeError } = await stripe.confirmCardPayment(clientSecret, {...})
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } else if (method === 'paypal') {
        // PLACEHOLDER: replace with PayPal Checkout SDK approve/capture flow.
        // Typically PayPal's own button component handles this and calls
        // onApprove(data, actions) -> actions.order.capture(), then you'd
        // call completeProvisioning from that callback instead of a click here.
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // On real integrations, this call should ideally be triggered by the
      // payment processor's webhook confirming success server-side, with this
      // client-side call as a fallback/optimistic path.
      await completeProvisioning(institutionName.trim(), pendingPlan || 'professional');
    } catch {
      // error is already surfaced via useAuth().error
    } finally {
      setSubmitting(false);
      setStkStatus('idle');
    }
  };

  const payButtonLabel = () => {
    if (submitting) {
      if (method === 'mpesa' && stkStatus === 'sent') return 'Sending STK push...';
      if (method === 'mpesa' && stkStatus === 'waiting') return 'Waiting for M-Pesa PIN...';
      return 'Activating...';
    }
    if (method === 'mpesa') return `Send STK Push - $${plan.price}/mo`;
    if (method === 'paypal') return `Pay with PayPal - $${plan.price}/mo`;
    return `Pay $${plan.price}/mo to activate`;
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
              disabled={submitting}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent disabled:opacity-60"
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

          {/* Payment method selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Payment method
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setMethod(id);
                    setLocalError(null);
                  }}
                  disabled={submitting}
                  className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg border text-center transition-all disabled:opacity-50 ${
                    method === id
                      ? 'border-[#1ebcb2] bg-[#1ebcb2]/10 text-[#641f60]'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Method-specific fields */}
          {method === 'mpesa' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                M-Pesa number
              </label>
              <input
                type="tel"
                value={mpesaPhone}
                onChange={(e) => setMpesaPhone(e.target.value)}
                placeholder="0712345678"
                disabled={submitting}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent disabled:opacity-60"
              />
              <p className="text-xs text-slate-400 mt-1.5">
                You'll get a prompt on your phone to enter your M-Pesa PIN.
              </p>
            </div>
          )}

          {method === 'card' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Card number
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  placeholder="4242 4242 4242 4242"
                  disabled={submitting}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent disabled:opacity-60"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Expiry
                  </label>
                  <input
                    type="text"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)}
                    placeholder="MM/YY"
                    disabled={submitting}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">CVC</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={cardCvc}
                    onChange={(e) => setCardCvc(e.target.value)}
                    placeholder="123"
                    disabled={submitting}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent disabled:opacity-60"
                  />
                </div>
              </div>
            </div>
          )}

          {method === 'paypal' && (
            <div className="bg-[#0070ba]/5 border border-[#0070ba]/20 rounded-lg p-3 text-xs text-slate-600">
              You'll be redirected to PayPal to approve the payment, then brought back here to
              finish activating your account.
            </div>
          )}

          {(localError || error) && (
            <div className="text-sm text-[#c46040] bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg px-3 py-2">
              {localError || error}
            </div>
          )}

          <button
            onClick={handlePay}
            disabled={submitting || !institutionName.trim()}
            className="w-full py-3 bg-[#ee7b22] hover:bg-[#c46040] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {payButtonLabel()}
          </button>

          <p className="text-xs text-slate-400 flex items-center gap-1.5 justify-center">
            <ShieldCheck className="w-3.5 h-3.5" />
            Payment placeholder - wire up Daraja/Stripe/PayPal here
          </p>

          <button
            onClick={() => signOut()}
            disabled={submitting}
            className="w-full text-sm text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
          >
            Sign out instead
          </button>
        </div>
      </div>
    </div>
  );
}