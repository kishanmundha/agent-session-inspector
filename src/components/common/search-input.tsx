"use client";

import { useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Search field with the conventional "/" focus shortcut and Escape-to-clear.
 * `shortcut` opts into the global hotkey; skip it when two fields share a page.
 * `size="sm"` matches the height of `sm` buttons in a dense toolbar.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  shortcut = false,
  size = "default",
  className,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  shortcut?: boolean;
  size?: "default" | "sm";
  className?: string;
  "aria-label"?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!shortcut) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable) return;
      e.preventDefault();
      ref.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shortcut]);

  return (
    <div className={cn("relative", className)}>
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        ref={ref}
        type="search"
        value={value}
        aria-label={ariaLabel ?? placeholder}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.preventDefault();
            onChange("");
          }
        }}
        className={cn(
          // Only reserve room on the right for what is actually shown there.
          "bg-background pl-8 [&::-webkit-search-cancel-button]:appearance-none",
          value || shortcut ? "pr-8" : "pr-2.5",
          size === "sm" && "h-7 rounded-[min(var(--radius-md),12px)] md:text-xs",
        )}
      />
      <div className="absolute inset-y-0 right-1 flex items-center">
        {value ? (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => onChange("")}
            aria-label="Clear search"
            className="text-muted-foreground"
          >
            <X aria-hidden />
          </Button>
        ) : (
          shortcut && (
            <kbd className="pointer-events-none mr-1 hidden rounded-sm border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:block">
              /
            </kbd>
          )
        )}
      </div>
    </div>
  );
}
