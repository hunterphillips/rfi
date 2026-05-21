import { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "brand" | "warn" | "danger" | "info";

const tones: Record<Tone, string> = {
  neutral: "border-line-2 bg-elev-2 text-ink-2",
  brand:
    "border-emerald/30 bg-emerald/10 text-accent",
  warn: "border-warn/30 bg-warn/10 text-warn",
  danger:
    "border-danger/30 bg-danger/10 text-danger",
  info: "border-info/30 bg-info/10 text-info",
};

export function Pill({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-display text-[10px] font-medium uppercase tracking-[0.14em]",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
