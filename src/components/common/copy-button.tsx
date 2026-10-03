"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, type LucideIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Status = "idle" | "copied" | "failed";

export function CopyButton({
  value,
  label = "Copy",
  size = "xs",
  icon: IdleIcon = Copy,
  className,
  children,
}: {
  /** A function is called at click time, for values only known in the browser. */
  value: string | (() => string);
  label?: string;
  /** Match the neighbouring controls: `sm` beside `sm` buttons and inputs. */
  size?: "xs" | "sm";
  /** Shown at rest, when the button copies something more specific than "this". */
  icon?: LucideIcon;
  className?: string;
  children?: React.ReactNode;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(typeof value === "function" ? value() : value);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setStatus("idle"), 1600);
  }

  const Icon = status === "copied" ? Check : status === "failed" ? X : IdleIcon;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size={children ? size : `icon-${size}`}
            onClick={copy}
            aria-label={label}
            className={cn(
              "text-muted-foreground",
              status === "copied" && "text-emerald-600 dark:text-emerald-400",
              status === "failed" && "text-destructive",
              className,
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {children}
          </Button>
        }
      />
      <TooltipContent>
        {status === "copied" ? "Copied" : status === "failed" ? "Copy failed" : label}
      </TooltipContent>
    </Tooltip>
  );
}
