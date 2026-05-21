import { ComponentProps, forwardRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "link";
type Size = "xs" | "sm" | "md" | "lg";

const base =
  "relative inline-flex items-center justify-center gap-1.5 font-medium tracking-tight transition-all duration-150 select-none disabled:cursor-not-allowed disabled:opacity-40";

const sizes: Record<Size, string> = {
  xs: "h-7 px-2.5 text-[11px] rounded-md",
  sm: "h-8 px-3 text-xs rounded-md",
  md: "h-9 px-4 text-sm rounded-md",
  lg: "h-11 px-5 text-sm rounded-lg",
};

const variants: Record<Variant, string> = {
  primary: cn(
    "text-black brand-gradient shadow-[0_1px_0_rgba(15,22,28,0.04),0_4px_14px_-6px_rgba(39,182,129,0.45)]",
    "hover:brightness-105 hover:shadow-[0_0_0_1px_rgba(39,182,129,0.5),0_10px_24px_-10px_rgba(39,182,129,0.55)]",
    "active:brightness-95",
  ),
  secondary: cn(
    "border border-line-2 bg-elev-1 text-ink shadow-[0_1px_0_rgba(15,22,28,0.02)]",
    "hover:bg-elev-2 hover:border-line-3",
  ),
  ghost: cn(
    "text-ink-2 hover:text-ink hover:bg-elev-2",
  ),
  danger: cn(
    "border border-danger/40 text-danger bg-transparent",
    "hover:bg-danger/10 hover:border-danger/60",
  ),
  link: "text-accent underline underline-offset-4 decoration-accent/40 hover:decoration-accent",
};

type Props = ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(base, sizes[size], variants[variant], className)}
      {...props}
    />
  );
});

type LinkButtonProps = ComponentProps<typeof Link> & {
  variant?: Variant;
  size?: Size;
};

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: LinkButtonProps) {
  return (
    <Link
      className={cn(base, sizes[size], variants[variant], className)}
      {...props}
    />
  );
}
