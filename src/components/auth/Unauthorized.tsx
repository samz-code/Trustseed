// src/components/auth/Unauthorized.tsx
// Shown when an authenticated user reaches something their role doesn't permit.
// This is a 403 experience (they ARE logged in), not a login prompt.
// Palette: TrustSeed purple #641f60, teal #1ebcb2, rust #c46040.

import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ROLE_LABELS, isRole } from '../../constants/roles';

interface UnauthorizedProps {
  /** Optional: the permission the user was missing, for a precise message. */
  requiredPermission?: string;
  /** Called when the user chooses to go back to their dashboard. */
  onGoBack?: () => void;
}

export function Unauthorized({ requiredPermission, onGoBack }: UnauthorizedProps) {
  const { admin } = useAuth();
  const roleLabel = isRole(admin?.role) ? ROLE_LABELS[admin.role] : 'your role';

  const goBack = () => {
    if (onGoBack) return onGoBack();
    window.dispatchEvent(new CustomEvent('navigate', { detail: 'dashboard' }));
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-[#c46040]/10 flex items-center justify-center mb-6">
          <ShieldAlert className="w-8 h-8 text-[#c46040]" />
        </div>

        <p className="text-xs font-semibold tracking-widest text-[#1ebcb2] uppercase mb-2">
          Access denied
        </p>
        <h1 className="text-2xl font-bold text-[#641f60] mb-3">
          You don't have permission for this
        </h1>
        <p className="text-slate-600 leading-relaxed">
          {roleLabel} can't open this page.
          {requiredPermission ? (
            <>
              {' '}
              It needs the <span className="font-mono text-slate-800">{requiredPermission}</span>{' '}
              permission.
            </>
          ) : null}{' '}
          If you think this is a mistake, ask an administrator to review your role.
        </p>

        <button
          onClick={goBack}
          className="mt-8 inline-flex items-center justify-center px-6 py-3 bg-[#641f60] hover:bg-[#4e1849] text-white font-semibold rounded-xl transition-colors"
        >
          Back to dashboard
        </button>
      </div>
    </div>
  );
}

export default Unauthorized;