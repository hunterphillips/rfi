import { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "brand" | "warn" | "danger" | "info";

const tones: Record<Tone, string> = {
  neutral: "border-line-2 bg-elev-2 text-ink-2",
  brand:
    "border-[rgba(39,182,129,0.3)] bg-[rgba(39,182,129,0.08)] text-teal",
  warn: "border-[rgba(214,163,88,0.3)] bg-[rgba(214,163,88,0.08)] text-warn",
  danger:
    "border-[rgba(224,123,123,0.3)] bg-[rgba(224,123,123,0.08)] text-danger",
  info: "border-[rgba(107,162,196,0.3)] bg-[rgba(107,162,196,0.08)] text-info",
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
