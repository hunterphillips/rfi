import { cn } from "@/lib/cn";

/**
 * Signature gradient progress rail — a thin horizontal bar that fills with the
 * IPC brand gradient as work completes. Used by the agent-pipeline runners.
 */
export function ProgressRail({
  done,
  total,
  label,
  active = true,
  className,
}: {
  done: number;
  total: number;
  label?: string;
  /** When true, the leading edge gets a glowing puck. */
  active?: boolean;
  className?: string;
}) {
  const pct = total === 0 ? 0 : Math.min(100, Math.max(0, (done / total) * 100));

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="flex items-center justify-between font-display text-[10px] font-medium uppercase tracking-[0.18em] text-ink-3">
          <span>{label}</span>
          <span className="font-mono normal-case tracking-normal text-ink-2">
            {done}/{total}
          </span>
        </div>
      )}
      <div className="relative h-px bg-line-2">
        <div
          className="absolute inset-y-0 left-0 brand-gradient transition-[width] duration-700 ease-out"
          style={{
            width: `${pct}%`,
            boxShadow: "0 0 10px rgba(39,182,129,0.55)",
          }}
        />
        {active && pct > 0 && pct < 100 && (
          <div
            className="absolute -top-[3px] h-[7px] w-[7px] rounded-full bg-teal transition-[left] duration-700 ease-out"
            style={{
              left: `calc(${pct}% - 3.5px)`,
              boxShadow:
                "0 0 0 3px rgba(39,182,129,0.18), 0 0 14px var(--color-teal)",
            }}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Vertical pipeline step indicator — used in the research/draft runners as the
 * "stage" rail next to the topic list.
 */
export function PipelineStep({
  state,
  label,
  detail,
  isLast = false,
}: {
  state: "done" | "active" | "pending" | "failed";
  label: string;
  detail?: string;
  isLast?: boolean;
}) {
  const colors: Record<typeof state, string> = {
    done: "var(--color-emerald)",
    active: "var(--color-lime)",
    pending: "var(--color-ink-5)",
    failed: "var(--color-danger)",
  };
  return (
    <div className="relative flex gap-3 pb-3 last:pb-0">
      <div className="flex flex-col items-center">
        <span
          className="relative inline-flex h-2.5 w-2.5 rounded-full"
          style={{ background: colors[state] }}
        >
          {state === "active" && (
            <span
              className="pulse-dot absolute inset-0 rounded-full"
              style={{ background: colors[state] }}
            />
          )}
        </span>
        {!isLast && (
          <span
            className="mt-1 w-px flex-1"
            style={{
              background:
                state === "done"
                  ? "var(--color-emerald)"
                  : "var(--color-line-2)",
            }}
          />
        )}
      </div>
      <div className="-mt-0.5 flex-1 pb-2">
        <div
          className={cn(
            "font-display text-[11px] font-medium uppercase tracking-[0.14em]",
            state === "active"
              ? "text-ink"
              : state === "done"
                ? "text-ink-2"
                : state === "failed"
                  ? "text-danger"
                  : "text-ink-4",
          )}
        >
          {label}
        </div>
        {detail && (
          <div className="mt-0.5 text-xs text-ink-3">{detail}</div>
        )}
      </div>
    </div>
  );
}
