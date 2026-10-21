import { formatLocale } from "@/i18n/current";

/**
 * Formatting helpers shared by the session list, detail view and timeline.
 * Numbers, dates and units follow the interface language (see i18n/current.ts).
 */

/** A whole or decimal number with the locale's separators: 12,345 / 12 345. */
export function formatNumber(n: number) {
  return n.toLocaleString(formatLocale());
}

/** Fixed-decimal number in the active locale: 1.5 / 1,5. */
export function fixed(n: number, digits: number) {
  return n.toLocaleString(formatLocale(), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** A ratio as a percentage: 0.123 → "12.3%" / "12,3 %". */
export function formatPercent(ratio: number, digits = 0) {
  return ratio.toLocaleString(formatLocale(), {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** One unit amount: "3s", "3 秒", "3 с". */
function unit(n: number, name: string, digits = 0) {
  return n.toLocaleString(formatLocale(), {
    style: "unit",
    unit: name,
    unitDisplay: "narrow",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatDateTime(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(formatLocale(), {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatFullDateTime(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(formatLocale());
}

export function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${fixed(b / 1024, 1)} KB`;
  return `${fixed(b / 1024 / 1024, 1)} MB`;
}

/** Compact token counts: 1.2M / 24K / 812. */
export function formatTokens(n?: number | null) {
  if (n == null || n === 0) return null;
  if (n >= 1_000_000) return `${fixed(n / 1_000_000, 1)}M`;
  if (n >= 1_000) return `${fixed(n / 1_000, 1)}K`;
  return String(n);
}

function usd(amount: number, digits: number) {
  return amount.toLocaleString(formatLocale(), {
    style: "currency",
    currency: "USD",
    // "$" rather than "US$": every amount in the app is in dollars.
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Dollar amounts: $412 / $12.40 / $0.37 / <$0.01, written the locale's way. */
export function formatCost(amount: number) {
  if (amount <= 0) return usd(0, 0);
  if (amount < 0.01) return `<${usd(0.01, 2)}`;
  if (amount >= 100) return usd(Math.round(amount), 0);
  return usd(amount, 2);
}

export function formatCount(n: number) {
  if (n >= 1_000_000) return `${fixed(n / 1_000_000, 1)}M`;
  if (n >= 10_000) return `${fixed(n / 1_000, 0)}K`;
  return n.toLocaleString(formatLocale());
}

/** Whole minutes: "42m", "42分". */
export function formatMinutes(ms: number) {
  return unit(Math.round(ms / 60_000), "minute");
}

export function formatDuration(ms: number) {
  if (ms < 1000) return unit(Math.round(ms), "millisecond");
  if (ms < 60_000) return unit(ms / 1000, "second", 1);
  const mins = Math.floor(ms / 60_000);
  const secs = Math.round((ms % 60_000) / 1000);
  if (mins < 60) return secs ? `${unit(mins, "minute")} ${unit(secs, "second")}` : unit(mins, "minute");
  const hrs = Math.floor(mins / 60);
  return `${unit(hrs, "hour")} ${unit(mins % 60, "minute")}`;
}

/** "3m ago", "3 分前", "il y a 3 min". */
export function timeAgo(iso?: string) {
  if (!iso) return "";
  const locale = formatLocale();
  // English narrow reads "3m ago"; other languages' narrow forms are terser
  // than their speakers write ("-3 min"), so they get the short style.
  const style = !locale || locale === "en" ? "narrow" : "short";
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style });
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return rtf.format(0, "second");
  if (mins < 60) return rtf.format(-mins, "minute");
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return rtf.format(-hrs, "hour");
  const days = Math.floor(hrs / 24);
  if (days < 30) return rtf.format(-days, "day");
  return rtf.format(-Math.floor(days / 30), "month");
}

/** First non-empty line of a multi-line session name. */
export function firstLine(text?: string) {
  return text
    ?.split("\n")
    .map((l) => l.trim())
    .find(Boolean);
}
