import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  FaFacebookF,
  FaInstagram,
  FaLinkedinIn,
  FaXTwitter,
  FaYoutube,
} from 'react-icons/fa6';

const socialLinks = [
  { icon: FaFacebookF, label: 'Facebook', href: 'https://facebook.com/trustseedmfi' },
  { icon: FaXTwitter, label: 'X (Twitter)', href: 'https://x.com/trustseedmfi' },
  { icon: FaLinkedinIn, label: 'LinkedIn', href: 'https://linkedin.com/company/trustseedmfi' },
  { icon: FaInstagram, label: 'Instagram', href: 'https://instagram.com/trustseedmfi' },
  { icon: FaYoutube, label: 'YouTube', href: 'https://youtube.com/@trustseedmfi' },
];

export function Footer() {
  const navigate = useNavigate();
  const location = useLocation();

  // Section links (#who-we-are, #features, #pricing, #contact) only exist on
  // the landing page. From any other route, navigate home first, then scroll
  // once the section has mounted.
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

  return (
    <footer className="relative bg-slate-900 text-white py-12 sm:py-16 overflow-x-hidden">
      {/* Brand palette accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{
          background: 'linear-gradient(90deg, #ee7b22 0%, #1ebcb2 33%, #641f60 66%, #1a3c6e 100%)',
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full min-w-0">
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div className="min-w-0">
            <img
              src="/logo.png"
              alt="Trust Seed"
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-contain bg-white p-2 mb-4"
            />
            <p className="text-sm text-slate-400 break-words">
              Empowering microfinance institutions across Africa with modern technology.
            </p>

            {/* Social icons */}
            <div className="flex items-center gap-3 mt-5 flex-wrap">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                    className="w-9 h-9 shrink-0 rounded-lg bg-white/10 hover:bg-[#1ebcb2] flex items-center justify-center transition-colors"
                  >
                    <Icon className="w-4 h-4 text-white" />
                  </a>
                );
              })}
            </div>
          </div>

          <div className="min-w-0">
            <h4 className="font-semibold mb-4 text-[#1ebcb2]">Product</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <a href="/#features" onClick={goToSection('features')} className="hover:text-[#1ebcb2] transition-colors">Features</a>
              </li>
              <li>
                <a href="/#pricing" onClick={goToSection('pricing')} className="hover:text-[#1ebcb2] transition-colors">Pricing</a>
              </li>
              <li>
                <Link to="/api-documentation" className="hover:text-[#1ebcb2] transition-colors">API Documentation</Link>
              </li>
              <li>
                <Link to="/integrations" className="hover:text-[#1ebcb2] transition-colors">Integrations</Link>
              </li>
            </ul>
          </div>

          <div className="min-w-0">
            <h4 className="font-semibold mb-4 text-[#ee7b22]">Company</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <a href="/#who-we-are" onClick={goToSection('who-we-are')} className="hover:text-[#ee7b22] transition-colors">About Us</a>
              </li>
              <li>
                <Link to="/careers" className="hover:text-[#ee7b22] transition-colors">Careers</Link>
              </li>
              <li>
                <Link to="/sitemap" className="hover:text-[#a06b9c] transition-colors">Sitemap</Link>
              </li>
              <li>
                <a href="/#contact" onClick={goToSection('contact')} className="hover:text-[#ee7b22] transition-colors">Contact</a>
              </li>
            </ul>
          </div>

          <div className="min-w-0">
            <h4 className="font-semibold mb-4 text-[#a06b9c]">Legal</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <Link to="/privacy-policy" className="hover:text-[#a06b9c] transition-colors">Privacy Policy</Link>
              </li>
              <li>
                <Link to="/terms-of-service" className="hover:text-[#a06b9c] transition-colors">Terms of Service</Link>
              </li>
              <li>
                <Link to="/security" className="hover:text-[#a06b9c] transition-colors">Security</Link>
              </li>
              <li>
                <Link to="/compliance" className="hover:text-[#a06b9c] transition-colors">Compliance</Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-400 text-center md:text-left break-words">
            &copy; {new Date().getFullYear()} Trust Seed Microfinance Enterprises. All rights reserved.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center">
            <a
              href="https://www.emonisamuel.co.ke"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[#1ebcb2] hover:text-white transition-colors whitespace-nowrap"
            >
              Developed by Emoni Samuel
            </a>
            <span className="hidden sm:inline text-slate-600">|</span>
            <span className="text-sm text-slate-400 whitespace-nowrap">
              Managed by Sharmai Technologies
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}