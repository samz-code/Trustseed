import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle2, ShieldCheck, Loader2, CreditCard, Smartphone, Wallet, Building, ExternalLink } from 'lucide-react';

const PLAN_DETAILS: Record<string, { label: string; price: number; features: string[] }> = {
  starter: { label: 'Starter', price: 250, features: ['Up to 2 branches', 'Up to 10 users', 'Customer & Wallet Management', 'Savings Products', 'Basic Reporting', 'Email Support'] },
  professional: { label: 'Professional', price: 600, features: ['Up to 10 branches', 'Up to 50 users', 'All Starter features', 'Loan Management', 'Money Transfers', 'Forex Trading', 'Advanced Analytics', 'API Access', 'Priority Support'] },
  enterprise: { label: 'Enterprise', price: 1500, features: ['Unlimited branches', 'Unlimited users', 'All Professional features', 'Custom Branding', 'Dedicated Account Manager', 'Custom Integrations', 'On-premise Option', 'SLA Guarantee'] },
};

type PaymentMethod = 'mpesa' | 'card' | 'paypal' | 'bank';

const PAYMENT_METHODS = [
  { id: 'mpesa', label: 'M-Pesa', icon: Smartphone, color: 'bg-green-600 hover:bg-green-700', textColor: 'text-white' },
  { id: 'card', label: 'Credit/Debit Card', icon: CreditCard, color: 'bg-blue-600 hover:bg-blue-700', textColor: 'text-white' },
  { id: 'paypal', label: 'PayPal', icon: Wallet, color: 'bg-[#003087] hover:bg-[#00246b]', textColor: 'text-white' },
  { id: 'bank', label: 'Bank Transfer', icon: Building, color: 'bg-slate-700 hover:bg-slate-800', textColor: 'text-white' },
];

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
  const [status, setStatus] = useState<'idle' | 'sending' | 'waiting' | 'success'>('idle');

  const plan = PLAN_DETAILS[pendingPlan || 'professional'] || PLAN_DETAILS.professional;

  const isValidMpesaNumber = (value: string) => {
    const digits = value.replace(/\s+/g, '');
    return /^(?:254|0)(7|1)\d{8}$/.test(digits);
  };

  const handlePay = async () => {
    if (!institutionName.trim()) {
      setLocalError('Please enter your institution name.');
      return;
    }

    setLocalError(null);
    setSubmitting(true);

    try {
      if (method === 'mpesa') {
        if (!isValidMpesaNumber(mpesaPhone)) {
          setLocalError('Enter a valid M-Pesa number (e.g. 0712345678)');
          setSubmitting(false);
          return;
        }
        setStatus('sending');
        // ... existing STK push logic ...
        await new Promise(resolve => setTimeout(resolve, 8000));
      } else if (method === 'paypal') {
        window.open(`https://www.paypal.com/paypalme/yourpaypalemail/${plan.price}`, '_blank');
        await new Promise(resolve => setTimeout(resolve, 1500));
      } else if (method === 'bank') {
        alert(`Bank Transfer Instructions:\n\nBank: Equity Bank\nAccount Name: TrustSeed Ltd\nAccount Number: 1234567890\nAmount: $${plan.price}\nReference: ${institutionName.trim()}\n\nSend proof to support@trustseed.com`);
      } else {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      await completeProvisioning(institutionName.trim(), pendingPlan || 'professional');
      setStatus('success');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Payment failed.');
    } finally {
      setSubmitting(false);
      setStatus('idle');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-[#641f60] to-[#4a1646] p-6 text-white">
          <p className="text-white/70 text-sm">Almost there</p>
          <h1 className="text-2xl font-bold mt-1">Activate your account</h1>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Institution Name</label>
            <input
              type="text"
              value={institutionName}
              onChange={(e) => setInstitutionName(e.target.value)}
              placeholder="e.g. Amani Microfinance Ltd"
              disabled={submitting}
              className="w-full px-4 py-3 border border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#1ebcb2]"
            />
          </div>

          {/* Plan Summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
            <div className="flex justify-between items-baseline mb-4">
              <span className="font-semibold text-lg">{plan.label} Plan</span>
              <span className="text-3xl font-bold text-[#641f60]"> ${plan.price}<span className="text-base font-normal">/mo</span></span>
            </div>
            <ul className="space-y-2 text-sm text-slate-600">
              {plan.features.map((f, i) => (
                <li key={i} className="flex gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" /> {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Payment Methods */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">Payment Method</label>
            <div className="grid grid-cols-2 gap-3">
              {PAYMENT_METHODS.map(({ id, label, icon: Icon, color, textColor }) => (
                <button
                  key={id}
                  onClick={() => setMethod(id as PaymentMethod)}
                  className={`flex items-center gap-3 p-4 rounded-2xl border transition-all text-sm font-medium ${method === id ? 'border-[#1ebcb2] ring-2 ring-[#1ebcb2]/30' : 'border-slate-200 hover:border-slate-300'} ${color} ${textColor}`}
                >
                  <Icon className="w-6 h-6" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Details */}
          {method === 'mpesa' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">M-Pesa Number</label>
              <input
                type="tel"
                value={mpesaPhone}
                onChange={(e) => setMpesaPhone(e.target.value)}
                placeholder="0712345678"
                disabled={submitting}
                className="w-full px-4 py-3 border border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#1ebcb2]"
              />
            </div>
          )}

          {method === 'card' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Card Number</label>
                <input type="text" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="4242 4242 4242 4242" className="w-full px-4 py-3 border border-slate-300 rounded-2xl" disabled={submitting} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Expiry (MM/YY)</label>
                  <input type="text" value={cardExpiry} onChange={(e) => setCardExpiry(e.target.value)} placeholder="12/28" className="w-full px-4 py-3 border border-slate-300 rounded-2xl" disabled={submitting} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">CVC</label>
                  <input type="text" value={cardCvc} onChange={(e) => setCardCvc(e.target.value)} placeholder="123" className="w-full px-4 py-3 border border-slate-300 rounded-2xl" disabled={submitting} />
                </div>
              </div>
            </div>
          )}

          {method === 'paypal' && (
            <div className="bg-[#003087] text-white p-6 rounded-2xl">
              <p className="font-medium mb-3">Pay with PayPal</p>
              <button
                onClick={() => window.open(`https://www.paypal.com/paypalme/yourpaypalemail/${plan.price}`, '_blank')}
                className="w-full bg-white text-[#003087] py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors"
              >
                Continue to PayPal <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          )}

          {method === 'bank' && (
            <div className="bg-blue-50 border border-blue-200 p-6 rounded-2xl">
              <p className="font-semibold mb-4 text-blue-900">Bank Transfer Instructions</p>
              <div className="space-y-2 text-sm text-blue-800">
                <p><strong>Bank:</strong> Equity Bank</p>
                <p><strong>Account Name:</strong> TrustSeed Ltd</p>
                <p><strong>Account Number:</strong> 1234567890</p>
                <p><strong>Amount:</strong> ${plan.price}</p>
                <p className="pt-2 font-medium text-blue-900">Reference: <span className="font-mono">{institutionName || 'YOUR_INSTITUTION'}</span></p>
              </div>
              <p className="text-xs text-blue-700 mt-4">Send proof of payment to <span className="font-medium">support@trustseed.com</span> after transfer.</p>
            </div>
          )}

          {(localError || error) && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm">
              {localError || error}
            </div>
          )}

          <button
            onClick={handlePay}
            disabled={submitting || !institutionName.trim()}
            className="w-full py-4 bg-[#ee7b22] hover:bg-[#c46040] disabled:opacity-50 text-white font-semibold rounded-2xl transition-all flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              `Pay $${plan.price}/mo`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}