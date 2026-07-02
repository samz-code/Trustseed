import { BarChart3, CheckCircle, Clock, Lock, Smartphone } from 'lucide-react';

const benefitItems = [
  'Multi-currency support for USD, KES, UGX, TZS, SSP, and more',
  'Mobile money integration (M-Pesa, MTN Mobile Money)',
  'Offline-capable for areas with limited connectivity',
  'Compliance with local financial regulations',
  'Role-based access for different staff levels',
  'Real-time reporting and analytics',
];

export function Benefits() {
  return (
    <section className="py-24 bg-[#dae1e1]/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
              Built for African Financial Institutions
            </h2>
            <p className="text-lg text-slate-600 mb-8">
              We understand the unique challenges of microfinance in Africa. Our platform is designed to handle
              local regulations, multiple currencies, and mobile-first operations.
            </p>
            <div className="space-y-4">
              {benefitItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#1ebcb2] flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-slate-700">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-6 shadow-lg border border-slate-200">
              <Lock className="w-8 h-8 text-[#641f60] mb-3" />
              <h4 className="font-semibold text-slate-900 mb-1">Bank-Grade Security</h4>
              <p className="text-sm text-slate-600">End-to-end encryption and SOC 2 compliance</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-lg border border-slate-200">
              <Clock className="w-8 h-8 text-[#ee7b22] mb-3" />
              <h4 className="font-semibold text-slate-900 mb-1">Real-Time Updates</h4>
              <p className="text-sm text-slate-600">Instant sync across all branches and devices</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-lg border border-slate-200">
              <Smartphone className="w-8 h-8 text-[#1ebcb2] mb-3" />
              <h4 className="font-semibold text-slate-900 mb-1">Mobile-First</h4>
              <p className="text-sm text-slate-600">Full functionality on any device, anywhere</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-lg border border-slate-200">
              <BarChart3 className="w-8 h-8 text-[#c46040] mb-3" />
              <h4 className="font-semibold text-slate-900 mb-1">Analytics</h4>
              <p className="text-sm text-slate-600">Advanced insights to drive growth</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}