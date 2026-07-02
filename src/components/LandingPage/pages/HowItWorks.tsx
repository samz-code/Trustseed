import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ListChecks, UserPlus, CreditCard, Rocket } from 'lucide-react';

const steps = [
  {
    icon: ListChecks,
    title: 'Choose Plan',
    description: 'Pick the subscription that fits your institution. Transparent pricing, starting at USD 250/month.',
    color: '#ee7b22',
  },
  {
    icon: UserPlus,
    title: 'Create Account',
    description: 'Complete the onboarding wizard with your institution, admin, and branch details.',
    color: '#1ebcb2',
  },
  {
    icon: CreditCard,
    title: 'Complete Payment',
    description: 'Secure your subscription with a quick, seamless payment. No one-time purchase required.',
    color: '#641f60',
  },
  {
    icon: Rocket,
    title: 'Start Using',
    description: 'Your institution is instantly provisioned. Start processing transactions and growing right away.',
    color: '#1a3c6e',
  },
];

export function HowItWorks() {
  const rowRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="py-24 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">How It Works</h2>
          <p className="text-lg text-slate-600">
            Get started in minutes, not months. Our streamlined onboarding makes it easy.
          </p>
        </div>

        <div ref={rowRef} className="relative">
          {/* Connector line for desktop, sits behind the step circles */}
          <div
            className={`hidden md:block absolute top-8 left-0 h-0.5 bg-slate-200 transition-transform duration-[1200ms] ease-out origin-left ${
              visible ? 'scale-x-100' : 'scale-x-0'
            }`}
            style={{ right: 0, marginLeft: 'calc(100% / 8)', marginRight: 'calc(100% / 8)' }}
          />

          <div className="grid md:grid-cols-4 gap-12 md:gap-6 relative">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              return (
                <div key={idx} className="relative">
                  {/* Connecting arrow between steps on desktop */}
                  {idx < steps.length - 1 && (
                    <div
                      className={`hidden md:flex absolute top-6 -right-6 lg:-right-7 z-10 items-center justify-center w-6 h-6 rounded-full bg-white transition-all duration-500 ${
                        visible ? 'opacity-100' : 'opacity-0'
                      }`}
                      style={{ transitionDelay: visible ? `${(idx + 1) * 200}ms` : '0ms' }}
                    >
                      <ArrowRight className="w-5 h-5 text-slate-300" />
                    </div>
                  )}

                  <div
                    style={{ transitionDelay: visible ? `${idx * 180}ms` : '0ms' }}
                    className={`text-center transition-all duration-700 ease-out motion-reduce:transition-none motion-reduce:!translate-y-0 motion-reduce:!opacity-100 ${
                      visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                    }`}
                  >
                    <div className="relative inline-flex mb-6">
                      <div
                        className="w-16 h-16 rounded-2xl text-white flex items-center justify-center text-2xl font-bold shadow-lg"
                        style={{ backgroundColor: step.color }}
                      >
                        <Icon className="w-7 h-7" />
                      </div>
                      <span
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border-2 flex items-center justify-center text-xs font-bold"
                        style={{ borderColor: step.color, color: step.color }}
                      >
                        {idx + 1}
                      </span>
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">{step.title}</h3>
                    <p className="text-slate-600 max-w-xs mx-auto">{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}