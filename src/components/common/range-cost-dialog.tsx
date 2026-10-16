"use client";

import { useEffect, useState } from "react";
import { CostDialog } from "@/components/session/cost-dialog";
import type { AnalyticsSession, CostSummary, UsageSlice } from "@/lib/providers/types";
import { summarizeCost } from "@/lib/range-cost";

/** What `/api/pricing` adds to a receipt the browser summed itself. */
interface PricingInfo {
  overridePath: string;
  prices: CostSummary["prices"];
}

/**
 * The cost receipt behind a dashboard's "Est. cost" card: the same dialog a
 * session opens, over the usage the dashboard counts. The receipt is only
 * worked out while the dialog is open. The usage carries rates but not the
 * price entries behind them, so those are fetched, letting the dialog offer
 * the same ready-to-edit pricing.json a session's does.
 */
export function RangeCostDialog({
  sessions,
  keep,
  scope,
  open,
  onOpenChange,
}: {
  sessions: AnalyticsSession[];
  /** Whether a usage slice is part of what the dashboard shows. */
  keep: (session: AnalyticsSession, slice: UsageSlice) => boolean;
  scope: { sessions: number; period: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const cost = open ? summarizeCost(sessions, keep) : null;
  const query = cost
    ? cost.byModel
        .filter((m) => m.model !== "unknown")
        .map((m) => `model=${encodeURIComponent(m.model)}`)
        .join("&")
    : "";
  const [pricing, setPricing] = useState<{ query: string; info: PricingInfo } | null>(null);

  useEffect(() => {
    if (!query) return;
    let cancelled = false;
    fetch(`/api/pricing?${query}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((info: PricingInfo | null) => {
        if (!cancelled && info) setPricing({ query, info });
      })
      .catch(() => {
        /* The dialog still shows the receipt, just without the template. */
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  if (!cost) return null;
  const info = pricing?.query === query ? pricing.info : null;
  return (
    <CostDialog
      cost={info ? { ...cost, prices: info.prices, overridePath: info.overridePath } : cost}
      open
      onOpenChange={onOpenChange}
      scope={scope}
    />
  );
}
