/**
 * Joins class names, skipping anything falsy.
 *
 * It lives here rather than inside the component library because that library
 * is a client module. A server component that imported this from there would
 * be holding a client reference and would fail the moment it tried to call it
 * while rendering.
 */
export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

/**
 * The organization's colour for the `.brand-scope` wrapper. Every "copper"
 * utility in the app reads the accent variables derived from it in
 * globals.css, so one hex re-themes buttons, highlights and the active
 * navigation in both themes. A colour too light to carry white text is
 * darkened first.
 */
export function brandStyle(hex: string): Record<string, string> {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return {};
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // White text needs about 4.5:1; above this luminance the base is pulled towards black.
  const base = luminance > 0.18 ? `color-mix(in srgb, ${hex} ${Math.round((0.18 / luminance) * 100)}%, black)` : hex;
  return { '--brand': hex, '--brand-base': base };
}
