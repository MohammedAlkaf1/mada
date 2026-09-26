/**
 * The product name in one place. Mail subjects, PDF footers and the server
 * side of the app read it from here; the interface reads the same words from
 * the dictionary. Override with PRODUCT_NAME_AR / PRODUCT_NAME_EN without a
 * code change when the commercial name is settled.
 */
export const PRODUCT={
 ar:process.env.PRODUCT_NAME_AR??'مدى',
 en:process.env.PRODUCT_NAME_EN??'Mada',
};
export const appUrl=()=>process.env.APP_URL??'http://127.0.0.1:3100';

/**
 * The Mada mark: two arcs rising from one point, a horizon widening outwards,
 * which is what the word means. Ink tile, teal outer arc, sand inner arc.
 */
export const MARK_PATHS={
 tile:'#16323B',outer:'#19A095',inner:'#ECE8DC',
 outerArc:'M13 43.5C13 33 21.5 24.5 32 24.5S51 33 51 43.5',
 innerArc:'M22.5 43.5C22.5 38.3 26.8 34 32 34S41.5 38.3 41.5 43.5',
};
export function markSvg(size=42){
 const m=MARK_PATHS;
 return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true"><rect width="64" height="64" rx="16" fill="${m.tile}"/><path d="${m.outerArc}" fill="none" stroke="${m.outer}" stroke-width="5.5" stroke-linecap="round"/><path d="${m.innerArc}" fill="none" stroke="${m.inner}" stroke-width="5" stroke-linecap="round"/><circle cx="32" cy="43.5" r="3.4" fill="${m.outer}"/></svg>`;
}
