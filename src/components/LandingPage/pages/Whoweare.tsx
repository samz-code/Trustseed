import { useEffect, useRef, useState } from 'react';
import {
  Eye,
  Handshake,
  MapPinned,
  ShieldCheck,
  Sprout,
  Target,
  Users2,
} from 'lucide-react';

const pillars = [
  {
    icon: MapPinned,
    title: 'Built for the Field',
    description:
      'Designed around how branches in Nairobi, Kampala, and Juba actually operate, not generic banking assumptions imported from elsewhere.',
  },
  {
    icon: ShieldCheck,
    title: 'Security by Default',
    description:
      'Encryption, audit trails, and role-based access are core to the system, not features you have to configure or pay extra for.',
  },
  {
    icon: Sprout,
    title: 'Local First',
    description:
      'Multi-currency support, mobile money, and regional compliance realities are built in from day one, not bolted on later.',
  },
  {
    icon: Handshake,
    title: 'Human Support',
    description:
      "When something breaks, a real person answers, not just a ticket queue. We know downtime affects real members' money.",
  },
];

const values = [
  {
    icon: ShieldCheck,
    label: 'Integrity',
    description: "We do what we say, even when no one's checking.",
    bg: '#641f60',
  },
  {
    icon: Target,
    label: 'Reliability',
    description: 'Your systems stay up when your members need them most.',
    bg: '#ee7b22',
  },
  {
    icon: Eye,
    label: 'Transparency',
    description: 'No hidden fees, no fine print, no surprises.',
    bg: '#1ebcb2',
  },
  {
    icon: Users2,
    label: 'Community',
    description: 'We grow when the institutions we serve grow.',
    bg: '#c46040',
  },
];

export function WhoWeAre() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
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
    <section id="who-we-are" className="py-24 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-block px-4 py-1.5 bg-[#1ebcb2]/10 text-[#1ebcb2] text-sm font-medium rounded-full mb-4">
            Who We Are
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Technology Built With Financial Institutions, Not Just For Them
          </h2>
          <p className="text-lg text-slate-600">
            Trust Seed exists because too many SACCOs and microfinance institutions across Africa are still running
            on spreadsheets and disconnected systems. We build the infrastructure they deserve.
          </p>
        </div>

        <div ref={sectionRef} className="space-y-16">
          {/* Mission & Vision */}
          <div className="grid md:grid-cols-2 gap-6">
            <div
              style={{ transitionDelay: visible ? '0ms' : '0ms' }}
              className={`bg-[#641f60] rounded-2xl p-8 text-white transition-all duration-700 ease-out motion-reduce:transition-none motion-reduce:!translate-y-0 motion-reduce:!opacity-100 ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center mb-5">
                <Target className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Our Mission</h3>
              <p className="text-white/80 leading-relaxed">
                To give microfinance institutions, SACCOs, and money transfer operators across East Africa the
                technology backbone they need to serve their members reliably, without the cost or complexity of
                building it themselves.
              </p>
            </div>

            <div
              style={{ transitionDelay: visible ? '120ms' : '0ms' }}
              className={`bg-slate-50 border border-slate-200 rounded-2xl p-8 transition-all duration-700 ease-out motion-reduce:transition-none motion-reduce:!translate-y-0 motion-reduce:!opacity-100 ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-[#ee7b22]/10 flex items-center justify-center mb-5">
                <Eye className="w-6 h-6 text-[#ee7b22]" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">Our Vision</h3>
              <p className="text-slate-600 leading-relaxed">
                A future where every credit union and SACCO on the continent runs on secure, modern infrastructure,
                because access to good financial tools shouldn't depend on the size of an institution's IT budget.
              </p>
            </div>
          </div>

          {/* Pillars of Philosophy */}
          <div>
            <div className="text-center mb-10">
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Pillars of Our Philosophy</h3>
              <p className="text-slate-600">The principles that shape every product decision we make.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {pillars.map((pillar, idx) => {
                const Icon = pillar.icon;
                return (
                  <div
                    key={idx}
                    style={{ transitionDelay: visible ? `${idx * 100}ms` : '0ms' }}
                    className={`bg-white rounded-xl p-6 border border-slate-200 hover:border-[#1ebcb2] hover:shadow-lg hover:-translate-y-1 transition-all duration-700 ease-out motion-reduce:transition-none motion-reduce:!translate-y-0 motion-reduce:!opacity-100 ${
                      visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                    }`}
                  >
                    <div className="w-11 h-11 rounded-lg bg-[#1ebcb2]/10 flex items-center justify-center mb-4">
                      <Icon className="w-5 h-5 text-[#1ebcb2]" />
                    </div>
                    <h4 className="font-semibold text-slate-900 mb-2">{pillar.title}</h4>
                    <p className="text-sm text-slate-600 leading-relaxed">{pillar.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Values */}
          <div>
            <div className="text-center mb-10">
              <h3 className="text-2xl font-bold text-slate-900 mb-2">What We Value</h3>
              <p className="text-slate-600">The standards we hold ourselves to, on every account and every call.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {values.map((value, idx) => {
                const Icon = value.icon;
                return (
                  <div
                    key={idx}
                    style={{
                      transitionDelay: visible ? `${idx * 100}ms` : '0ms',
                      backgroundColor: value.bg,
                    }}
                    className={`rounded-2xl p-8 shadow-lg hover:-translate-y-1.5 hover:shadow-2xl transition-all duration-700 ease-out motion-reduce:transition-none motion-reduce:!translate-y-0 motion-reduce:!opacity-100 ${
                      visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                    }`}
                  >
                    <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center mb-5">
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <h4 className="text-2xl font-bold text-white mb-2">{value.label}</h4>
                    <p className="text-white/85 leading-relaxed">{value.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}