import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from './pages/Navbar';
import { MobileMenu } from './pages/MobileMenu';
import { WhatsAppButton } from './pages/Whatsappbutton';
import { Hero } from './pages/Hero';
import { Stats } from './pages/Stats';
import { WhoWeAre } from './pages/Whoweare';
import { Features } from './pages/Features';
import { HowItWorks } from './pages/HowItWorks';
import { Benefits } from './pages/Benefits';
import { Pricing } from './pages/Pricing';
import { CTA } from './pages/CTA';
import { Contact } from './pages/Contact';
import { Footer } from './pages/Footer';

export function LandingPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      <Navbar onNavigate={navigate} onOpenMobileMenu={() => setMobileMenuOpen(true)} />
      <MobileMenu open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} onNavigate={navigate} />
      <Hero onNavigate={navigate} />
      <Stats />
      <WhoWeAre />
      <Features />
      <HowItWorks />
      <Benefits />
      <Pricing onNavigate={navigate} />
      <CTA onNavigate={navigate} />
      <Contact />
      <Footer />
      <WhatsAppButton />
    </div>
  );
}