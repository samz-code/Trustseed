import { ArrowRight } from 'lucide-react';

interface CTAProps {
  onNavigate: (path: string) => void;
}

export function CTA({ onNavigate }: CTAProps) {
  return (
    <section className="py-24 bg-[#dae1e1]/50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Ready to Transform Your Institution?</h2>
        <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto">
          Join 50+ financial institutions already using Trust Seed to streamline their operations, improve
          compliance, and serve their customers better.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => onNavigate('/auth')}
            className="px-8 py-4 bg-[#ee7b22] text-white font-semibold rounded-xl shadow-xl hover:bg-[#c46040] transition-all flex items-center justify-center gap-2 text-lg"
          >
            Start Free Trial
            <ArrowRight className="w-5 h-5" />
          </button>
          <button
            onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-8 py-4 border-2 border-[#641f60] text-[#641f60] font-semibold rounded-xl hover:bg-[#641f60]/5 transition-all text-lg"
          >
            Talk to Sales
          </button>
        </div>
      </div>
    </section>
  );
}