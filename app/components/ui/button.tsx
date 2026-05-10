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
    "text-black brand-gradient",
    "hover:brightness-110 hover:shadow-[0_0_0_1px_rgba(39,182,129,0.45),0_10px_28px_-12px_rgba(39,182,129,0.6)]",
    "active:brightness-95",
  ),
  secondary: cn(
    "border border-line-3 bg-elev-1 text-ink",
    "hover:bg-elev-2 hover:border-line-3",
  ),
  ghost: cn(
    "text-ink-2 hover:text-ink hover:bg-elev-1",
  ),
  danger: cn(
    "border border-[rgba(224,123,123,0.3)] text-danger bg-transparent",
    "hover:bg-[rgba(224,123,123,0.08)] hover:border-[rgba(224,123,123,0.5)]",
  ),
  link: "text-teal hover:text-emerald underline underline-offset-4 decoration-teal/40 hover:decoration-teal",
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
