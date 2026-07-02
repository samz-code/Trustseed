import { LogIn, X } from 'lucide-react';

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
}

export function MobileMenu({ open, onClose, onNavigate }: MobileMenuProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white">
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Trust Seed" className="w-10 h-10 rounded-xl object-contain" />
          <h1 className="text-xl font-bold text-[#641f60]">Trust Seed</h1>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg text-slate-600 hover:bg-slate-100">
          <X className="w-6 h-6" />
        </button>
      </div>
      <div className="p-4 space-y-4">
        <a href="#who-we-are" className="block text-lg text-slate-800 py-2" onClick={onClose}>
          Who We Are
        </a>
        <a href="#features" className="block text-lg text-slate-800 py-2" onClick={onClose}>
          Features
        </a>
        <a href="#pricing" className="block text-lg text-slate-800 py-2" onClick={onClose}>
          Pricing
        </a>
        <a href="#contact" className="block text-lg text-slate-800 py-2" onClick={onClose}>
          Contact
        </a>
        <hr className="my-4" />
        <button
          onClick={() => onNavigate('/auth')}
          className="w-full py-3 flex items-center justify-center gap-2 text-[#641f60] font-medium border-2 border-slate-300 rounded-lg"
        >
          <LogIn className="w-4 h-4" />
          Sign In
        </button>
        <button
          onClick={() => onNavigate('/auth')}
          className="w-full py-3 text-center bg-[#ee7b22] text-white font-medium rounded-lg shadow-lg"
        >
          Get Started
        </button>
      </div>
    </div>
  );
}