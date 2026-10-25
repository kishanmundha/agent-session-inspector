"use client";

import { useCallback } from "react";
import { RANGES, type RangeValue } from "@/lib/analytics";
import { useQueryParam } from "@/lib/use-tab-param";

/** The range every home tab starts on, as the terminal reports do. */
export const DEFAULT_RANGE: RangeValue = "30";

/**
 * The range, agent and model the home tabs filter by. Like the project, they
 * are shared by every tab and kept in the URL (`?range=`, `?agent=`,
 * `?model=`), the same names the Tool output page reads.
 */
export interface HomeFilters {
  range: RangeValue;
  /** Provider id, or "all". */
  provider: string;
  /** Model name, or "all". */
  model: string;
}

export function useHomeFilters(): [HomeFilters, (patch: Partial<HomeFilters>) => void] {
  const [rawRange, setRange] = useQueryParam("range", DEFAULT_RANGE);
  const [provider, setProvider] = useQueryParam("agent", "all");
  const [model, setModel] = useQueryParam("model", "all");
  const range = (RANGES.some((r) => r.value === rawRange) ? rawRange : DEFAULT_RANGE) as RangeValue;

  const update = useCallback(
    (patch: Partial<HomeFilters>) => {
      if (patch.range !== undefined) setRange(patch.range);
      if (patch.provider !== undefined) setProvider(patch.provider);
      if (patch.model !== undefined) setModel(patch.model);
    },
    [setRange, setProvider, setModel],
  );

  return [{ range, provider, model }, update];
}
