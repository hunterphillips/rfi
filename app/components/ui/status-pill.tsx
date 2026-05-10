import { cn } from "@/lib/cn";
import type { TopicStatus, DraftStatus } from "@/lib/types";

type Status = TopicStatus | DraftStatus;

const config: Record<
  Status,
  { color: string; label: string; pulse?: boolean }
> = {
  // topic statuses
  pending: { color: "var(--color-ink-4)", label: "Queued" },
  planning: {
    color: "var(--color-warn)",
    label: "Planning",
    pulse: true,
  },
  researching: {
    color: "var(--color-lime)",
    label: "Researching",
    pulse: true,
  },
  researched: { color: "var(--color-emerald)", label: "Researched" },
  approved: { color: "var(--color-teal)", label: "Approved" },
  drafting: {
    color: "var(--color-emerald)",
    label: "Drafting",
    pulse: true,
  },
  drafted: { color: "var(--color-teal)", label: "Drafted" },
  failed: { color: "var(--color-danger)", label: "Failed" },

  // draft statuses (some overlap)
  parsed: { color: "var(--color-ink-3)", label: "Parsed" },
  ready: { color: "var(--color-teal)", label: "Ready" },
  in_review: { color: "var(--color-warn)", label: "In review" },
};

export function StatusPill({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  const cfg = config[status];
  if (!cfg) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-line bg-elev-2/60 px-2 py-0.5 font-display text-[10px] font-medium uppercase tracking-[0.14em] text-ink-2",
        className,
      )}
    >
      <Dot color={cfg.color} pulse={cfg.pulse} />
      {cfg.label}
    </span>
  );
}

export function Dot({
  color,
  pulse,
  size = 6,
}: {
  color: string;
  pulse?: boolean;
  size?: number;
}) {
  return (
    <span
      className="relative inline-flex shrink-0 rounded-full"
      style={{ width: size, height: size, background: color }}
    >
      {pulse && (
        <span
          className="pulse-dot absolute inset-0 rounded-full"
          style={{ background: color }}
        />
      )}
    </span>
  );
}
