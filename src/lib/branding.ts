/**
 * Branding application: maps a tenant's saved brand colors onto CSS variables
 * so the UI can restyle at runtime. Without this, colors saved in Settings are
 * never reflected anywhere (the UI would only ever show the hardcoded palette).
 *
 * Call applyBranding() whenever tenant settings load or change.
 */

export interface BrandColors {
  primary?: string | null;
  secondary?: string | null;
  accent?: string | null;
}

// Fallbacks match the original Trust Seed palette so nothing looks broken
// before a tenant customizes anything.
const DEFAULTS = {
  primary: '#641f60',
  secondary: '#1ebcb2',
  accent: '#ee7b22',
};

function isHex(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

// Expand #abc -> #aabbcc for consistent math.
function normalizeHex(hex: string): string {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  return `#${h.toLowerCase()}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = normalizeHex(hex).replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

// Mix a color toward black (amount<0) or white (amount>0), amount in -1..1.
function shade(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const target = amount < 0 ? 0 : 255;
  const p = Math.abs(amount);
  return rgbToHex(r + (target - r) * p, g + (target - g) * p, b + (target - b) * p);
}

/** Relative luminance for choosing readable foreground text. */
function readableText(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const [rl, gl, bl] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
  return luminance > 0.55 ? '#1a1a1a' : '#ffffff';
}

/**
 * Writes brand CSS variables onto :root. Safe to call repeatedly.
 * Invalid/missing colors fall back to the default palette.
 */
export function applyBranding(colors: BrandColors | null | undefined): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  const primary = isHex(colors?.primary) ? normalizeHex(colors!.primary!) : DEFAULTS.primary;
  const secondary = isHex(colors?.secondary) ? normalizeHex(colors!.secondary!) : DEFAULTS.secondary;
  const accent = isHex(colors?.accent) ? normalizeHex(colors!.accent!) : DEFAULTS.accent;

  const vars: Record<string, string> = {
    '--brand-primary': primary,
    '--brand-primary-dark': shade(primary, -0.25),
    '--brand-primary-light': shade(primary, 0.85),
    '--brand-primary-text': readableText(primary),
    '--brand-secondary': secondary,
    '--brand-secondary-dark': shade(secondary, -0.2),
    '--brand-secondary-light': shade(secondary, 0.85),
    '--brand-secondary-text': readableText(secondary),
    '--brand-accent': accent,
    '--brand-accent-dark': shade(accent, -0.2),
    '--brand-accent-light': shade(accent, 0.85),
    '--brand-accent-text': readableText(accent),
  };

  for (const [key, val] of Object.entries(vars)) {
    root.style.setProperty(key, val);
  }
}

/** Reset variables back to the default palette (e.g. on sign-out). */
export function resetBranding(): void {
  applyBranding(null);
}