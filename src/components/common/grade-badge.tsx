import { GRADE_STYLES } from "@/lib/health";
import type { HealthGrade } from "@/lib/providers/types";
import { cn } from "@/lib/utils";

/** The health grade as a letter in its grade colour. */
export function GradeBadge({
  grade,
  score,
  className,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & {
  grade: HealthGrade;
  /** Shown beside the letter when given. */
  score?: number;
}) {
  return (
    <span
      {...props}
      className={cn(
        "inline-flex h-5 min-w-5 shrink-0 items-center justify-center gap-1 rounded-sm border px-1 font-mono text-xs font-bold leading-none",
        GRADE_STYLES[grade].badge,
        className,
      )}
    >
      {grade}
      {score !== undefined && <span className="font-medium tabular-nums">{score}</span>}
    </span>
  );
}
