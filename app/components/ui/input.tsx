import { ComponentProps, forwardRef } from "react";
import { cn } from "@/lib/cn";

const inputBase =
  "block w-full rounded-md border border-line-2 bg-elev-2 px-3 py-2 text-sm text-ink placeholder:text-ink-4 transition-colors hover:border-line-3 focus:border-teal focus:outline-none focus:ring-2 focus:ring-[rgba(39,182,129,0.18)] disabled:opacity-50";

export const Input = forwardRef<HTMLInputElement, ComponentProps<"input">>(
  function Input({ className, ...props }, ref) {
    return (
      <input ref={ref} className={cn(inputBase, className)} {...props} />
    );
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  ComponentProps<"textarea">
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(inputBase, "resize-y leading-relaxed", className)}
      {...props}
    />
  );
});

export function Label({
  className,
  ...props
}: ComponentProps<"label">) {
  return (
    <label
      className={cn(
        "block text-[11px] font-medium uppercase tracking-[0.12em] text-ink-3",
        className,
      )}
      {...props}
    />
  );
}
