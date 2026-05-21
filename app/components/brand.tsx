import Image from "next/image";
import Link from "next/link";
import logoBanner from "@/public/logo-banner.png";
import logoFull from "@/public/logo-full.png";

/**
 * The IPC "circuit-node" mark, drawn as inline SVG. Used in places where
 * the wordmark would be redundant (empty states, decorative chrome).
 */
export function BrandMark({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient
          id="ipc-mark-gradient"
          x1="2"
          y1="6"
          x2="30"
          y2="26"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#8ec841" />
          <stop offset="50%" stopColor="#41bb71" />
          <stop offset="100%" stopColor="#27b681" />
        </linearGradient>
      </defs>

      <g
        stroke="url(#ipc-mark-gradient)"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      >
        <path d="M4 8 L11 8 Q14 8 14 12 L14 15" />
        <path d="M14 15 L26 15" />
        <path d="M14 15 Q14 22 18 22 L26 22" />
      </g>

      <g>
        <circle cx="4" cy="8" r="2.4" fill="#8ec841" />
        <circle cx="14" cy="15" r="2.6" fill="#5cc060" />
        <circle cx="26" cy="15" r="2.4" fill="#41bb71" />
        <circle cx="26" cy="22" r="2.4" fill="#27b681" />
      </g>

      <g opacity="0.55">
        <circle cx="20" cy="8" r="1.6" fill="#898989" />
        <circle cx="4" cy="22" r="1.6" fill="#898989" />
      </g>
    </svg>
  );
}

/**
 * Header brand lockup — uses the official transparent banner PNG (the
 * INTEGRITYPRO wordmark + circuit mark together) paired with a small
 * product-name sublabel.
 */
export function BrandLockup({
  href = "/",
  productLabel = "RFX",
}: {
  href?: string;
  productLabel?: string;
}) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-3 rounded-md py-1 transition-opacity hover:opacity-90"
      aria-label={`IntegrityPro ${productLabel} — home`}
    >
      <Image
        src={logoBanner}
        alt="IntegrityPro"
        priority
        placeholder="empty"
        className="h-7 w-auto"
      />
      <span
        aria-hidden="true"
        className="hidden h-5 w-px bg-line-2 sm:inline-block"
      />
      <span className="hidden font-display text-[11px] font-medium uppercase tracking-[0.32em] text-ink-3 sm:inline">
        {productLabel}
      </span>
    </Link>
  );
}

/**
 * Login-screen hero — uses the full square corporate logo (with the
 * "CONSULTING LLC™" mark) for maximum brand presence.
 */
export function BrandHero({ tagline = "RFX · Response Console" }: { tagline?: string }) {
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <div className="relative">
        <div className="absolute inset-0 -z-10 rounded-full bg-[radial-gradient(circle,rgba(65,187,113,0.18),transparent_65%)] blur-2xl" />
        <Image
          src={logoFull}
          alt="IntegrityPro Consulting"
          priority
          placeholder="empty"
          className="h-32 w-32"
        />
      </div>
      <div className="font-display text-[10px] font-medium uppercase tracking-[0.4em] text-ink-3">
        {tagline}
      </div>
    </div>
  );
}
