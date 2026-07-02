import { useNavigate, useLocation } from 'react-router-dom';
import { Briefcase, Send } from 'lucide-react';
import { LegalLayout } from './LegalLayout';

const values = [
  {
    title: 'Build for the last mile',
    description:
      'We design for the microfinance institutions and members that other platforms overlook, and we measure success by their outcomes.',
    accent: '#ee7b22',
  },
  {
    title: 'Trust is earned in the details',
    description:
      'Every field, timeout, and error message either builds confidence or erodes it. We sweat the details that keep people\u2019s money safe.',
    accent: '#1ebcb2',
  },
  {
    title: 'Move with the people you serve',
    description:
      'We work closely with loan officers and members across the continent, and we let what we learn from them shape the roadmap.',
    accent: '#641f60',
  },
];

export function Careers() {
  const navigate = useNavigate();
  const location = useLocation();

  // "Contact" only exists as a section on the landing page. From this page,
  // navigate home first, then scroll once the section has mounted.
  const goToContact = (e: React.MouseEvent) => {
    e.preventDefault();
    if (location.pathname === '/') {
      document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate('/#contact');
      setTimeout(() => {
        document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    }
  };

  return (
    <LegalLayout
      title="Careers"
      subtitle="Help us build the infrastructure that microfinance institutions across Africa run on."
    >
      <section>
        <h2 className="text-2xl font-semibold text-slate-900 mb-6">What we value</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {values.map((value) => (
            <div
              key={value.title}
              className="relative overflow-hidden rounded-2xl p-6 pt-7 border"
              style={{
                backgroundColor: `${value.accent}0d`,
                borderColor: `${value.accent}33`,
              }}
            >
              <div
                className="absolute top-0 left-0 right-0 h-1.5"
                style={{ backgroundColor: value.accent }}
              />
              <h3 className="font-semibold text-slate-900 mb-2">{value.title}</h3>
              <p className="text-sm text-slate-600">{value.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-slate-900 mb-6">Open roles</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div
            className="rounded-2xl text-white p-8 flex flex-col items-center justify-center text-center"
            style={{ backgroundColor: '#641f60' }}
          >
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4 bg-white/15">
              <Briefcase className="w-6 h-6" />
            </div>
            <h3 className="font-semibold mb-2">No open positions right now</h3>
            <p className="text-sm text-white/85">
              We're not actively hiring at the moment, but we're always growing. Check back soon or
              send us your CV and we'll reach out when a role opens up.
            </p>
          </div>

          <div
            className="rounded-2xl text-white p-8 flex flex-col items-center justify-center text-center"
            style={{ backgroundColor: '#1ebcb2' }}
          >
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4 bg-white/15">
              <Send className="w-6 h-6" />
            </div>
            <h3 className="font-semibold mb-2">Stay on our radar</h3>
            <p className="text-sm text-white/85 mb-4">
              Share a little about yourself and the kind of role you're looking for, and we'll keep
              you in mind as our team grows.
            </p>
            <a
              href="/#contact"
              onClick={goToContact}
              className="inline-block text-sm font-medium px-4 py-2 rounded-lg bg-white text-[#1ebcb2] hover:bg-white/90 transition-colors"
            >
              Send your CV
            </a>
          </div>
        </div>
      </section>
    </LegalLayout>
  );
}