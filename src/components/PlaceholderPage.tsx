import React from 'react';
import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  description: string;
  icon: ReactNode;
}

export function PlaceholderPage({ title, description, icon }: PlaceholderPageProps) {
  const goToDashboard = () => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: 'dashboard' }));
  };

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-20 h-20 rounded-2xl bg-[#641f60]/10 flex items-center justify-center text-[#641f60] mb-6">
        {icon}
      </div>
      <h1 className="text-2xl font-bold text-[#641f60] mb-2">{title}</h1>
      <p className="text-slate-600 max-w-md mb-8">{description}</p>
      <button
        onClick={goToDashboard}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg transition-all"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </button>
    </div>
  );
}
