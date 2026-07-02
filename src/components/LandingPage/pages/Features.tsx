import { useEffect, useRef, useState } from 'react';
import { features } from '../data';

export function Features() {
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
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="features" className="py-24 bg-slate-50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Everything You Need to Run Your Institution
          </h2>
          <p className="text-lg text-slate-600">
            A comprehensive suite of tools designed specifically for microfinance operations, from customer
            onboarding to financial reporting.
          </p>
        </div>

        <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, idx) => (
            <div
              key={idx}
              style={{ transitionDelay: visible ? `${(idx % 4) * 90}ms` : '0ms' }}
              className={`bg-white rounded-xl p-6 border border-slate-200 hover:shadow-xl hover:border-[#1ebcb2] hover:-translate-y-1 transition-all duration-700 ease-out group
                motion-reduce:transition-none motion-reduce:!translate-y-0 motion-reduce:!opacity-100
                ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
              `}
            >
              <div
                className={`w-12 h-12 rounded-xl ${feature.color} text-white flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}
              >
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">{feature.title}</h3>
              <p className="text-sm text-slate-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}