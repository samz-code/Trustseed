import { useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from './Navbar';
import { MobileMenu } from './MobileMenu';
import { Footer } from './Footer';
import { WhatsAppButton } from './Whatsappbutton';

interface LegalLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function LegalLayout({ title, subtitle, children }: LegalLayoutProps) {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      <Navbar onNavigate={navigate} onOpenMobileMenu={() => setMobileMenuOpen(true)} />
      <MobileMenu open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} onNavigate={navigate} />

      {/* Vivid brand-color header, replacing the old flat slate-900 band */}
      <div
        className="relative text-white pt-32 pb-20 overflow-hidden"
        style={{
          background: 'linear-gradient(120deg, #641f60 0%, #4a1f6e 32%, #1a3c6e 66%, #1ebcb2 100%)',
        }}
      >
        {/* Warm accent glow to keep it lively rather than a flat gradient */}
        <div className="absolute -top-16 -right-10 w-80 h-80 bg-[#ee7b22]/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-[#1ebcb2]/25 rounded-full blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: 'radial-gradient(white 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{title}</h1>
          <p className="text-white/85 text-lg">{subtitle}</p>
        </div>
      </div>

      <main className="bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12 text-slate-700">
          {children}
        </div>
      </main>

      <Footer />
      <WhatsAppButton />
    </div>
  );
}