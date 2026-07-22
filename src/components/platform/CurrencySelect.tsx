import { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Currency picker with real national flags, drawn as inline SVG.
 *
 * Same approach as the tenant TransfersPage: crisp at any DPI, no external
 * asset requests, and no emoji-flag rendering problems on Windows/Android
 * where regional-indicator pairs often fall back to letter boxes.
 *
 * Scoped to the currencies Trust Seed actually collects subscription
 * payments in — East Africa plus USD. Adding one means adding its flag
 * below, deliberately, rather than silently rendering a grey placeholder.
 */

export const PAYMENT_CURRENCIES = ['KES', 'USD', 'SSP', 'UGX', 'TZS', 'RWF'] as const;
export type PaymentCurrency = (typeof PAYMENT_CURRENCIES)[number];

export const CURRENCY_NAMES: Record<string, string> = {
  KES: 'Kenyan Shilling',
  USD: 'US Dollar',
  SSP: 'South Sudanese Pound',
  UGX: 'Ugandan Shilling',
  TZS: 'Tanzanian Shilling',
  RWF: 'Rwandan Franc',
};

export const CURRENCY_COUNTRIES: Record<string, string> = {
  KES: 'Kenya',
  USD: 'United States',
  SSP: 'South Sudan',
  UGX: 'Uganda',
  TZS: 'Tanzania',
  RWF: 'Rwanda',
};

function FlagGraphic({ code }: { code: string }) {
  switch (code) {
    case 'KES': // Kenya
      return (
        <>
          <rect width="40" height="10" fill="#000" />
          <rect y="10" width="40" height="4" fill="#fff" />
          <rect y="14" width="40" height="12" fill="#bb0000" />
          <rect y="26" width="40" height="4" fill="#fff" />
          <rect y="30" width="40" height="10" fill="#006600" />
          <ellipse cx="20" cy="20" rx="4.5" ry="8" fill="#fff" />
          <ellipse cx="20" cy="20" rx="3" ry="6.5" fill="#bb0000" />
          <path d="M20 11 L21.5 20 L20 29 L18.5 20 Z" fill="#000" />
        </>
      );
    case 'USD': // United States
      return (
        <>
          <rect width="40" height="40" fill="#b22234" />
          <rect y="3.08" width="40" height="3.08" fill="#fff" />
          <rect y="9.23" width="40" height="3.08" fill="#fff" />
          <rect y="15.38" width="40" height="3.08" fill="#fff" />
          <rect y="21.54" width="40" height="3.08" fill="#fff" />
          <rect y="27.69" width="40" height="3.08" fill="#fff" />
          <rect y="33.85" width="40" height="3.08" fill="#fff" />
          <rect width="18" height="21.54" fill="#3c3b6e" />
          <g fill="#fff">
            {[4, 10, 16].map((cy) =>
              [3, 7, 11, 15].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1" />)
            )}
          </g>
        </>
      );
    case 'SSP': // South Sudan
      return (
        <>
          <rect width="40" height="12" fill="#000" />
          <rect y="12" width="40" height="2" fill="#fff" />
          <rect y="14" width="40" height="12" fill="#bb0000" />
          <rect y="26" width="40" height="2" fill="#fff" />
          <rect y="28" width="40" height="12" fill="#009543" />
          <path d="M0 0 L20 20 L0 40 Z" fill="#0f47af" />
          <path d="M4 20 l5.5 -1.8 -3.4 4.7 0 -5.8 3.4 4.7 z" fill="#fcdd09" />
        </>
      );
    case 'UGX': // Uganda
      return (
        <>
          <rect width="40" height="6.67" fill="#000" />
          <rect y="6.67" width="40" height="6.67" fill="#fcdc04" />
          <rect y="13.33" width="40" height="6.67" fill="#d90000" />
          <rect y="20" width="40" height="6.67" fill="#000" />
          <rect y="26.67" width="40" height="6.67" fill="#fcdc04" />
          <rect y="33.33" width="40" height="6.67" fill="#d90000" />
          <circle cx="20" cy="20" r="6" fill="#fff" />
          <circle cx="20" cy="20" r="5.4" fill="none" stroke="#000" strokeWidth="0.4" />
        </>
      );
    case 'TZS': // Tanzania
      return (
        <>
          <path d="M0 0 H40 V40 H0 Z" fill="#1eb53a" />
          <path d="M40 0 V40 H0 Z" fill="#00a3dd" />
          <path d="M0 40 L40 0 v6 L6 40 Z" fill="#fcd116" />
          <path d="M0 40 L40 0 h-6 L0 34 Z" fill="#fcd116" />
          <path d="M0 34 L34 0 h-34 Z M40 6 L6 40 h34 Z" fill="#000" />
        </>
      );
    case 'RWF': // Rwanda
      return (
        <>
          <rect width="40" height="40" fill="#20603d" />
          <rect width="40" height="26.67" fill="#00a1de" />
          <rect y="20" width="40" height="6.67" fill="#fad201" />
          <circle cx="31" cy="9" r="5" fill="#fad201" />
          {Array.from({ length: 24 }).map((_, i) => {
            const angle = (i * 15 * Math.PI) / 180;
            return (
              <line
                key={i}
                x1={31 + 4 * Math.sin(angle)}
                y1={9 - 4 * Math.cos(angle)}
                x2={31 + 5 * Math.sin(angle)}
                y2={9 - 5 * Math.cos(angle)}
                stroke="#e5be01"
                strokeWidth="0.6"
              />
            );
          })}
        </>
      );
    default:
      return (
        <>
          <rect width="40" height="40" fill="#64748b" />
          <text
            x="20"
            y="21"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="14"
            fontWeight="700"
            fill="#fff"
            fontFamily="system-ui, sans-serif"
          >
            {code.slice(0, 2)}
          </text>
        </>
      );
  }
}

export function CurrencyFlag({ code, size = 20 }: { code: string; size?: number }) {
  const clipId = `pay-flag-${code}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      role="img"
      aria-label={`${code} flag`}
      className="flex-shrink-0"
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx="20" cy="20" r="20" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <FlagGraphic code={code} />
      </g>
      <circle cx="20" cy="20" r="19" fill="none" stroke="#00000022" strokeWidth="2" />
    </svg>
  );
}

export function CurrencySelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-2 px-2.5 py-2 border border-slate-300 rounded-md bg-white text-left hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ee7b22]/40 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <CurrencyFlag code={value} />
        <span className="flex-1 min-w-0 truncate text-sm font-medium text-slate-900">{value}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute z-40 mt-1 w-full min-w-[210px] bg-white border border-slate-200 rounded-lg shadow-xl max-h-64 overflow-y-auto py-1">
          {PAYMENT_CURRENCIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50 transition-colors ${
                c === value ? 'bg-[#ee7b22]/[0.07]' : ''
              }`}
            >
              <CurrencyFlag code={c} size={22} />
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-sm font-semibold ${
                    c === value ? 'text-[#641f60]' : 'text-slate-900'
                  }`}
                >
                  {c}
                </span>
                <span className="block text-[11px] text-slate-500 truncate">
                  {CURRENCY_COUNTRIES[c]} &middot; {CURRENCY_NAMES[c]}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}