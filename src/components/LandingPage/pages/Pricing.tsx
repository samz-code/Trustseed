import { useEffect, useRef, useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { pricingPlans } from '../data';

interface PricingProps {
  onNavigate: (path: string) => void;
}

export function Pricing({ onNavigate }: PricingProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="pricing" className="py-16 sm:py-24 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Simple, Transparent Pricing</h2>
          <p className="text-lg text-slate-600">
            Choose the plan that fits your institution. All plans include core features and regular updates.
          </p>
        </div>

        <div
          ref={gridRef}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 max-w-5xl mx-auto"
        >
          {pricingPlans.map((plan, idx) => (
            <div
              key={idx}
              style={{ transitionDelay: visible ? `${idx * 120}ms` : '0ms' }}
              className={`relative bg-white rounded-2xl border-2 p-6 sm:p-8 flex flex-col
                transition-all duration-700 ease-out motion-reduce:transition-none motion-reduce:!translate-y-0 motion-reduce:!opacity-100
                hover:-translate-y-1.5 hover:shadow-xl
                ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}
                ${
                  plan.popular
                    ? 'border-[#1ebcb2] shadow-2xl lg:scale-105 hover:lg:scale-[1.07]'
                    : 'border-slate-200 shadow-sm hover:border-[#1ebcb2]/40'
                }
              `}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#ee7b22] text-white text-xs sm:text-sm font-medium px-3 sm:px-4 py-1 rounded-full whitespace-nowrap">
                  Most Popular
                </div>
              )}
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-slate-900 mb-2">{plan.name}</h3>
                <p className="text-sm text-slate-500 mb-4">{plan.description}</p>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold text-slate-900">${plan.price}</span>
                  <span className="text-slate-500">{plan.period}</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature, fidx) => (
                  <li key={fidx} className="flex items-center gap-2 text-sm text-slate-600">
                    <CheckCircle className="w-4 h-4 text-[#1ebcb2] flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => onNavigate('/auth')}
                className={`w-full py-3 rounded-xl font-medium transition-all duration-300 ${
                  plan.popular
                    ? 'bg-[#ee7b22] text-white shadow-lg hover:bg-[#c46040] hover:shadow-xl'
                    : 'border-2 border-[#641f60] text-[#641f60] hover:bg-[#641f60]/5'
                }`}
              >
                {plan.buttonText}
              </button>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-slate-500 mt-8">
          All plans include a 14-day free trial. No credit card required.
        </p>
      </div>
    </section>
  );
}