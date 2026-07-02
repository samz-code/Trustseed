import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LegalLayout } from './LegalLayout';

export function Sitemap() {
  const navigate = useNavigate();
  const location = useLocation();

  // Section links only exist on the landing page. From this page, navigate
  // home first, then scroll once the section has mounted.
  const goToSection = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (location.pathname === '/') {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate(`/#${id}`);
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    }
  };

  const sections = [
    {
      title: 'Product',
      accent: '#1ebcb2',
      links: [
        { label: 'Home', to: '/' },
        { label: 'Features', href: '/#features', onClick: goToSection('features') },
        { label: 'Pricing', href: '/#pricing', onClick: goToSection('pricing') },
        { label: 'API Documentation', to: '/api-documentation' },
        { label: 'Integrations', to: '/integrations' },
      ],
    },
    {
      title: 'Company',
      accent: '#ee7b22',
      links: [
        { label: 'About Us', href: '/#who-we-are', onClick: goToSection('who-we-are') },
        { label: 'Careers', to: '/careers' },
        { label: 'Contact', href: '/#contact', onClick: goToSection('contact') },
      ],
    },
    {
      title: 'Legal',
      accent: '#641f60',
      links: [
        { label: 'Privacy Policy', to: '/privacy-policy' },
        { label: 'Terms of Service', to: '/terms-of-service' },
        { label: 'Security', to: '/security' },
        { label: 'Compliance', to: '/compliance' },
      ],
    },
    {
      title: 'Account',
      accent: '#1a3c6e',
      links: [
        { label: 'Sign In / Get Started', to: '/auth' },
      ],
    },
  ];

  return (
    <LegalLayout
      title="Sitemap"
      subtitle="Every page on Trust Seed, in one place."
    >
      <div className="grid sm:grid-cols-2 gap-8">
        {sections.map((section) => (
          <div key={section.title}>
            <h2
              className="text-sm font-semibold uppercase tracking-wide mb-4"
              style={{ color: section.accent }}
            >
              {section.title}
            </h2>
            <ul className="space-y-3">
              {section.links.map((link) =>
                'to' in link && link.to ? (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      className="text-slate-700 hover:underline"
                      style={{ textUnderlineOffset: '3px' }}
                    >
                      {link.label}
                    </Link>
                  </li>
                ) : (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      onClick={link.onClick}
                      className="text-slate-700 hover:underline"
                      style={{ textUnderlineOffset: '3px' }}
                    >
                      {link.label}
                    </a>
                  </li>
                )
              )}
            </ul>
          </div>
        ))}
      </div>
    </LegalLayout>
  );
}