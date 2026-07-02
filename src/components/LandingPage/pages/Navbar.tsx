import { ArrowRight, LogIn, Menu } from 'lucide-react';
import { useLocation } from 'react-router-dom';

interface NavbarProps {
  onNavigate: (path: string) => void;
  onOpenMobileMenu: () => void;
}

export function Navbar({ onNavigate, onOpenMobileMenu }: NavbarProps) {
  const location = useLocation();

  const goToSection = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (location.pathname === '/') {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    } else {
      onNavigate(`/#${id}`);
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    }
  };

  return (
    <nav className="sticky top-0 left-0 right-0 z-50 bg-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 md:h-24">
          <button
            onClick={() => onNavigate('/')}
            className="flex items-center gap-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#641f60] focus-visible:ring-offset-2 shrink-0"
            aria-label="Go to homepage"
          >
            <img src="/logo-bg.png" alt="Trust Seed" className="h-10 sm:h-12 md:h-16 w-auto object-contain" />
          </button>

          <div className="hidden md:flex items-center gap-8">
            <a
              href="/#who-we-are"
              onClick={goToSection('who-we-are')}
              className="text-slate-600 hover:text-[#ee7b22] transition-colors font-medium"
            >
              Who We Are
            </a>
            <a
              href="/#features"
              onClick={goToSection('features')}
              className="text-slate-600 hover:text-[#ee7b22] transition-colors font-medium"
            >
              Features
            </a>
            <a
              href="/#pricing"
              onClick={goToSection('pricing')}
              className="text-slate-600 hover:text-[#ee7b22] transition-colors font-medium"
            >
              Pricing
            </a>
            <a
              href="/#contact"
              onClick={goToSection('contact')}
              className="text-slate-600 hover:text-[#ee7b22] transition-colors font-medium"
            >
              Contact
            </a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => onNavigate('/auth')}
              className="flex items-center gap-2 px-4 py-2.5 text-[#641f60] font-medium border-2 border-slate-200 rounded-lg hover:border-[#641f60] hover:bg-[#641f60]/5 transition-all"
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </button>
            <button
              onClick={() => onNavigate('/auth')}
              className="px-6 py-2.5 bg-[#ee7b22] text-white font-medium rounded-lg shadow-lg hover:bg-[#c46040] transition-all flex items-center gap-2"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={onOpenMobileMenu}
            aria-label="Open menu"
            className="md:hidden p-2 -mr-2 rounded-lg text-slate-600 hover:bg-slate-100 active:bg-slate-200 shrink-0"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </div>
    </nav>
  );
}