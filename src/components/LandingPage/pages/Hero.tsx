import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';

interface HeroProps {
  onNavigate: (path: string) => void;
}

const ALL_AFRICA_FLAGS = [
  { name: 'Kenya', code: 'ke' },
  { name: 'Uganda', code: 'ug' },
  { name: 'Tanzania', code: 'tz' },
  { name: 'South Sudan', code: 'ss' },
  { name: 'Nigeria', code: 'ng' },
  { name: 'Ghana', code: 'gh' },
  { name: 'Rwanda', code: 'rw' },
  { name: 'South Africa', code: 'za' },
  { name: 'Egypt', code: 'eg' },
  { name: 'Ethiopia', code: 'et' },
  { name: 'Morocco', code: 'ma' },
  { name: 'Zambia', code: 'zm' },
  { name: 'Zimbabwe', code: 'zw' },
  { name: 'Senegal', code: 'sn' },
  { name: 'Ivory Coast', code: 'ci' },
  { name: 'Cameroon', code: 'cm' },
  { name: 'Algeria', code: 'dz' },
  { name: 'Tunisia', code: 'tn' },
  { name: 'Libya', code: 'ly' },
  { name: 'Sudan', code: 'sd' },
  { name: 'Mali', code: 'ml' },
  { name: 'Niger', code: 'ne' },
  { name: 'Burkina Faso', code: 'bf' },
  { name: 'Chad', code: 'td' },
  { name: 'Mauritania', code: 'mr' },
  { name: 'Somalia', code: 'so' },
  { name: 'Djibouti', code: 'dj' },
  { name: 'Eritrea', code: 'er' },
  { name: 'Botswana', code: 'bw' },
  { name: 'Namibia', code: 'na' },
  { name: 'Lesotho', code: 'ls' },
  { name: 'Eswatini', code: 'sz' },
  { name: 'Malawi', code: 'mw' },
  { name: 'Mozambique', code: 'mz' },
  { name: 'Angola', code: 'ao' },
  { name: 'Gabon', code: 'ga' },
  { name: 'Republic of the Congo', code: 'cg' },
  { name: 'Democratic Republic of the Congo', code: 'cd' },
  { name: 'Central African Republic', code: 'cf' },
  { name: 'Equatorial Guinea', code: 'gq' },
  { name: 'Sao Tome and Principe', code: 'st' },
  { name: 'Cape Verde', code: 'cv' },
  { name: 'Seychelles', code: 'sc' },
  { name: 'Comoros', code: 'km' },
  { name: 'Madagascar', code: 'mg' },
  { name: 'Mauritius', code: 'mu' },
  { name: 'Burundi', code: 'bi' },
  { name: 'Liberia', code: 'lr' },
  { name: 'Sierra Leone', code: 'sl' },
  { name: 'Guinea', code: 'gn' },
  { name: 'Guinea-Bissau', code: 'gw' },
  { name: 'Togo', code: 'tg' },
  { name: 'Benin', code: 'bj' },
  { name: 'Gambia', code: 'gm' },
];

export function Hero({ onNavigate }: HeroProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center overflow-x-hidden">
      <div className="absolute inset-0 bg-[#dae1e1]/20" />

      {/* Ambient background blur blobs — smaller on phones so they can't force overflow */}
      <div className="absolute top-20 right-0 w-56 h-56 sm:w-96 sm:h-96 bg-[#1ebcb2]/10 rounded-full blur-3xl animate-[floatBlobA_14s_ease-in-out_infinite] motion-reduce:animate-none" />
      <div className="absolute bottom-0 left-0 w-56 h-56 sm:w-96 sm:h-96 bg-[#ee7b22]/10 rounded-full blur-3xl animate-[floatBlobB_18s_ease-in-out_infinite] motion-reduce:animate-none" />
      <div className="absolute top-1/3 left-1/4 w-44 h-44 sm:w-72 sm:h-72 bg-[#641f60]/10 rounded-full blur-3xl animate-[floatBlobC_16s_ease-in-out_infinite] motion-reduce:animate-none" />

      <div
        className="absolute inset-0 opacity-[0.15] animate-[driftGrid_40s_linear_infinite] motion-reduce:animate-none"
        style={{
          backgroundImage: 'radial-gradient(#641f60 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 w-full">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">

          {/* Left Text Column */}
          <div
            className={`space-y-6 sm:space-y-8 text-center lg:text-left transition-all duration-700 ease-out motion-reduce:transition-none motion-reduce:!translate-y-0 motion-reduce:!opacity-100 ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-[#641f60]/10 rounded-full max-w-full">
              <span className="w-2 h-2 shrink-0 bg-[#1ebcb2] rounded-full animate-pulse" />
              <span className="text-[#641f60] font-medium text-xs sm:text-sm whitespace-normal">
                Trusted by 50+ Financial Institutions
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 leading-tight">
              Empowering <span className="text-[#ee7b22]">Microfinance</span> Across Africa
            </h1>

            <p className="text-base sm:text-lg text-slate-600 max-w-xl mx-auto lg:mx-0">
              A complete enterprise financial platform designed for microfinance institutions, SACCOs, credit unions,
              and money transfer operators. Manage customers, loans, savings, transfers, and accounting in one
              integrated system.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <button
                onClick={() => onNavigate('/auth')}
                className="w-full sm:w-auto px-8 py-4 bg-[#ee7b22] text-white font-semibold rounded-xl shadow-xl hover:bg-[#c46040] transition-all flex items-center justify-center gap-2 text-lg"
              >
                Start Free Trial
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => onNavigate('/auth')}
                className="w-full sm:w-auto px-8 py-4 border-2 border-[#641f60] text-[#641f60] font-semibold rounded-xl hover:bg-[#641f60]/5 transition-all flex items-center justify-center gap-2 text-lg"
              >
                Watch Demo
              </button>
            </div>
          </div>

          {/* Right Column: Map Showcase + Flag Ticker */}
          <div
            className={`flex flex-col items-center justify-center gap-6 sm:gap-8 transition-all duration-700 ease-out delay-150 motion-reduce:transition-none motion-reduce:!translate-y-0 motion-reduce:!opacity-100 ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
          >
            <div className="w-full max-w-[240px] sm:max-w-[320px] md:max-w-[380px] aspect-square flex items-center justify-center overflow-hidden rounded-full bg-transparent">
              <img
                src="/map.png"
                alt="Africa Map Representation"
                className="w-full h-full object-contain animate-[circularSpin_45s_linear_infinite]"
              />
            </div>

            <div className="w-full max-w-[340px] sm:max-w-[420px] relative mt-2">
              <div className="absolute inset-y-0 left-0 w-8 sm:w-12 bg-gradient-to-r from-[#eff2f2] to-transparent z-10 pointer-events-none" />
              <div className="absolute inset-y-0 right-0 w-8 sm:w-12 bg-gradient-to-l from-[#eff2f2] to-transparent z-10 pointer-events-none" />

              <div className="w-full overflow-hidden flex whitespace-nowrap py-2">
                <div className="flex gap-6 items-center shrink-0 animate-[tickerMarquee_70s_linear_infinite]">
                  {ALL_AFRICA_FLAGS.map((flag, idx) => (
                    <div key={`g1-${flag.code}-${idx}`} className="flex items-center gap-2 bg-white/60 border border-slate-200/80 rounded-lg pl-1.5 pr-2.5 py-1 shadow-sm">
                      <img
                        src={`https://flagcdn.com/w40/${flag.code}.png`}
                        alt={flag.name}
                        className="w-6 h-4 rounded object-cover"
                      />
                      <span className="text-xs font-semibold text-slate-700">{flag.name}</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-6 items-center shrink-0 animate-[tickerMarquee_70s_linear_infinite]" aria-hidden="true">
                  {ALL_AFRICA_FLAGS.map((flag, idx) => (
                    <div key={`g2-${flag.code}-${idx}`} className="flex items-center gap-2 bg-white/60 border border-slate-200/80 rounded-lg pl-1.5 pr-2.5 py-1 shadow-sm">
                      <img
                        src={`https://flagcdn.com/w40/${flag.code}.png`}
                        alt={flag.name}
                        className="w-6 h-4 rounded object-cover"
                      />
                      <span className="text-xs font-semibold text-slate-700">{flag.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <button
        type="button"
        aria-label="Scroll down"
        onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}
        className="group absolute bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-slate-400 hover:text-[#641f60] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#641f60] focus-visible:ring-offset-2 rounded-full"
      >
        <span className="text-xs font-medium tracking-wide uppercase opacity-70 group-hover:opacity-100 transition-opacity">
          Scroll
        </span>
        <span className="w-6 h-10 rounded-full border-2 border-current flex justify-center pt-2">
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-[scrollWheel_1.6s_ease-in-out_infinite] motion-reduce:animate-none" />
        </span>
      </button>

      <style>{`
        @keyframes circularSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes tickerMarquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-100%); }
        }
        @keyframes scrollWheel {
          0% { opacity: 0; transform: translateY(0); }
          30% { opacity: 1; }
          60% { opacity: 1; transform: translateY(10px); }
          100% { opacity: 0; transform: translateY(10px); }
        }
        @keyframes floatBlobA {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-30px, 40px) scale(1.1); }
          66% { transform: translate(20px, -20px) scale(0.95); }
        }
        @keyframes floatBlobB {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(35px, -25px) scale(1.08); }
          66% { transform: translate(-20px, 30px) scale(0.92); }
        }
        @keyframes floatBlobC {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(25px, 25px) scale(1.12); }
        }
        @keyframes driftGrid {
          from { background-position: 0 0; }
          to { background-position: 280px 280px; }
        }
      `}</style>
    </section>
  );
}