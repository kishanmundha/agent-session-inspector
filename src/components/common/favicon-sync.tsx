"use client";

import { useEffect } from "react";
import { faviconSvg } from "@/lib/favicon";

/**
 * Repaints the tab icon in the current brand colour, so it matches the header
 * logo in every palette and in light and dark. The colours are read off <html>
 * rather than from the stores, so whatever sets the theme is followed.
 */
function paint() {
  const style = getComputedStyle(document.documentElement);
  const background = style.getPropertyValue("--cv-brand").trim();
  const foreground = style.getPropertyValue("--cv-brand-fg").trim();
  if (!background || !foreground) return;
  const href = `data:image/svg+xml,${encodeURIComponent(faviconSvg(background, foreground))}`;
  // Only the SVG icon is swapped; favicon.ico stays for browsers that need it.
  for (const link of document.querySelectorAll<HTMLLinkElement>(
    'link[rel="icon"][type="image/svg+xml"]',
  )) {
    if (link.href !== href) link.href = href;
  }
}

export function FaviconSync() {
  useEffect(() => {
    paint();
    // Theme and palette live on <html> as the `dark` class and `data-palette`.
    const theme = new MutationObserver(paint);
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-palette"],
    });
    // A navigation can re-insert the icon link with its original href.
    const head = new MutationObserver(paint);
    head.observe(document.head, { childList: true });
    return () => {
      theme.disconnect();
      head.disconnect();
    };
  }, []);
  return null;
}
