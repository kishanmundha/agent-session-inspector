import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Summary metric: small uppercase label, large value, muted sub-line.
 * Laid out by `StatCardGrid`, which auto-fills to the available width.
 * With `onClick` the whole card is a button that opens more detail.
 */
export function StatCard({
  label,
  value,
  sub,
  accent = false,
  onClick,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className="flex items-center justify-between gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        {label}
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
