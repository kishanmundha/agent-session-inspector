import { CircleHelp, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Summary metric: small uppercase label, large value, muted sub-line.
 * Laid out by `StatCardGrid`, which auto-fills to the available width.
 * With `onClick` the whole card is a button that opens more detail; with
 * `hint` the label carries a tooltip saying what the number counts.
 */
export function StatCard({
  label,
  value,
  sub,
  accent = false,
  hint,
  onClick,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  /** What the number counts, for labels that are easy to mix up. */
  hint?: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className="flex items-center justify-between gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        {label}
        {hint && !onClick && (
          <Tooltip>
            <TooltipTrigger
              render={
                <span
                  tabIndex={0}
                  aria-label={hint}
                  className="rounded-sm opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <CircleHelp className="size-3.5" aria-hidden />
                </span>
              }
            />
            <TooltipContent className="normal-case tracking-normal">{hint}</TooltipContent>
          </Tooltip>
        )}
        {onClick && (
          <Info
            className="size-3.5 shrink-0 opacity-60 transition-opacity group-hover:opacity-100"
            aria-hidden
          />
        )}
      </span>
      <span
        className={cn(
          "mt-1.5 block text-2xl font-bold leading-none tabular-nums",
          accent ? "text-brand" : "text-foreground",
        )}
      >
        {value}
      </span>
      {sub && (
        <span
          className="mt-1 block truncate text-xs normal-case text-muted-foreground"
          title={sub}
        >
          {sub}
        </span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-haspopup="dialog"
        className="group block rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-brand/40 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {body}
      </button>
    );
  }
  return <div className="rounded-xl border border-border bg-card p-4">{body}</div>;
}

export function StatCardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
      {children}
    </div>
  );
}
