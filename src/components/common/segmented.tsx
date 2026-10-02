"use client";

import type { LucideIcon } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const TRACK_CLS: Record<"sm" | "default", string> = {
  sm: "h-7",
  default: "h-8",
};

// Same look as the active tab in `TabsList`, so every "pick one" control matches.
const ITEM_CLS =
  "h-full min-w-0 rounded-md border border-transparent px-2 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-sm dark:aria-pressed:border-input dark:aria-pressed:bg-input/30";

/**
 * Pick-one control. Options with an `icon` render icon-only, with the label
 * as the accessible name and tooltip.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "sm",
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon?: LucideIcon }[];
  label: string;
  size?: "sm" | "default";
  className?: string;
}) {
  return (
    <ToggleGroup
      aria-label={label}
      value={[value]}
      // Clicking the active option would clear a toggle group; one stays chosen.
      onValueChange={(next) => {
        if (next.length > 0) onChange(next[0] as T);
      }}
      spacing={0.5}
      className={cn("rounded-lg bg-muted p-[3px]", TRACK_CLS[size], className)}
    >
      {options.map(({ value: v, label: text, icon: Icon }) =>
        Icon ? (
          <Tooltip key={v}>
            <TooltipTrigger
              render={
                <ToggleGroupItem
                  value={v}
                  aria-label={text}
                  className={cn(ITEM_CLS, "aspect-square px-0")}
                >
                  <Icon className="size-3.5" aria-hidden />
                </ToggleGroupItem>
              }
            />
            <TooltipContent>{text}</TooltipContent>
          </Tooltip>
        ) : (
          <ToggleGroupItem key={v} value={v} className={ITEM_CLS}>
            {text}
          </ToggleGroupItem>
        ),
      )}
    </ToggleGroup>
  );
}
