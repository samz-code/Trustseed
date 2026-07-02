import { useEffect } from 'react';

interface LoadingScreenProps {
  /** Optional message shown under the logo. Defaults to "Loading…". */
  message?: string;
  /** Optional logo path. Defaults to the public-folder logo. */
  logoSrc?: string;
}

/**
 * Full-screen branded loading state.
 *
 * Visually identical to the pre-mount splash in index.html (same logo,
 * pulse animation, and adaptive light/dark background), so the handoff
 * from the static HTML splash to React is seamless — the user perceives
 * a single continuous loading screen rather than two different ones.
 */
export default function LoadingScreen({
  message = 'Loading…',
  logoSrc = '/logo.png',
}: LoadingScreenProps) {
  // Inject the keyframes once (kept out of JSX so multiple mounts don't duplicate).
  useEffect(() => {
    const STYLE_ID = 'ts-loading-keyframes';
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      @keyframes ts-loading-fade-in { from { opacity: 0; } to { opacity: 1; } }
      @keyframes ts-loading-pulse {
        0%, 100% { opacity: 0.65; transform: scale(0.98); }
        50%      { opacity: 1;    transform: scale(1.02); }
      }
      @media (prefers-reduced-motion: reduce) {
        .ts-loading-logo { animation-duration: 3s !important; }
      }
    `;
    document.head.appendChild(style);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading Trust Seed"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '18px',
        background:
          'linear-gradient(180deg, var(--ts-bg, #f4f7fb) 0%, var(--ts-bg-2, #e6edf7) 100%)',
        animation: 'ts-loading-fade-in 0.35s ease both',
      }}
    >
      <img
        className="ts-loading-logo"
        src={logoSrc}
        alt="Trust Seed"
        width={150}
        height={150}
        style={{
          width: 'clamp(96px, 28vw, 150px)',
          height: 'auto',
          objectFit: 'contain',
          filter: 'drop-shadow(0 8px 24px rgba(0, 0, 0, 0.12))',
          animation: 'ts-loading-pulse 1.8s ease-in-out infinite',
        }}
      />
      <div
        style={{
          fontSize: '12.5px',
          letterSpacing: '0.02em',
          color: 'var(--ts-muted, #64748b)',
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        {message}
      </div>
    </div>
  );
}