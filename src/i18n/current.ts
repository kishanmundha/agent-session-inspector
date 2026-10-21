import type { Locale } from "./config";

/**
 * The locale the shared formatters in lib/format.ts use for numbers, dates
 * and units. The I18nProvider sets it while rendering, on the server and in
 * the browser alike, so plain helper functions follow the chosen language
 * without each call site passing it. Unset (the CLI), they use the system's.
 *
 * Module state is shared across server requests, which is fine for a
 * single-user app on 127.0.0.1: every request renders with one person's choice.
 */
let current: Locale | undefined;

export function setFormatLocale(locale: Locale) {
  current = locale;
}

export function formatLocale(): Locale | undefined {
  return current;
}
