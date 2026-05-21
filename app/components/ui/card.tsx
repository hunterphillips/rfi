import { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function Card({
  className,
  interactive = false,
  ...props
}: ComponentProps<"div"> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-line bg-elev-1 backdrop-blur-sm",
        interactive &&
          "transition-colors hover:border-line-2 hover:bg-elev-1",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "border-b border-line px-5 py-3.5",
        className,
      )}
      {...props}
    />
  );
}

export function CardBody({
  className,
  ...props
}: ComponentProps<"div">) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "border-t border-line px-5 py-3 flex items-center gap-3",
        className,
      )}
      {...props}
    />
  );
}

/** Tonal label tag — small, uppercase, for section headers within cards. */
export function Eyebrow({
  className,
  ...props
}: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-block font-display text-[10px] font-medium uppercase tracking-[0.18em] text-ink-3",
        className,
      )}
      {...props}
    />
  );
}
