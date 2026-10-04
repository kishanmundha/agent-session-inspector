/**
 * The tab icon: the header's logo tile (the lucide `Bot` glyph on the brand
 * colour). src/app/icon.svg is the same drawing in the default palette, served
 * before any script runs; keep the two in step.
 */
export function faviconSvg(background: string, foreground: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
    `<rect width="32" height="32" rx="7" fill="${background}"/>` +
    `<g transform="translate(5 5) scale(0.9167)" fill="none" stroke="${foreground}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="M12 8V4H8"/>` +
    `<rect width="16" height="12" x="4" y="8" rx="2"/>` +
    `<path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>` +
    `</g></svg>`
  );
}
