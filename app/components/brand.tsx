import Link from "next/link";

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
        <filter
          id="ipc-mark-glow"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feGaussianBlur stdDeviation="0.6" />
        </filter>
      </defs>

      {/* Connectors — multi-branch circuit */}
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

      {/* Colored circuit nodes */}
      <g>
        <circle cx="4" cy="8" r="2.4" fill="#8ec841" />
        <circle cx="14" cy="15" r="2.6" fill="#5cc060" />
        <circle cx="26" cy="15" r="2.4" fill="#41bb71" />
        <circle cx="26" cy="22" r="2.4" fill="#27b681" />
      </g>

      {/* Gray decoy nodes from real mark */}
      <g opacity="0.55">
        <circle cx="20" cy="8" r="1.6" fill="#898989" />
        <circle cx="4" cy="22" r="1.6" fill="#898989" />
      </g>
    </svg>
  );
}

export function BrandLockup({
  href = "/",
  productLabel = "R4",
}: {
  href?: string;
  productLabel?: string;
}) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-2.5 rounded-md py-1 transition-opacity hover:opacity-90"
      aria-label="IntegrityPro RFx — home"
    >
      <BrandMark size={28} />
      <div className="flex items-baseline gap-2">
        <span className="font-display text-[14px] font-semibold tracking-[0.18em] text-ink">
          INTEGRITY<span className="brand-text-gradient">PRO</span>
        </span>
        <span className="hidden font-display text-[10px] font-medium uppercase tracking-[0.32em] text-ink-4 sm:inline">
          / {productLabel}
        </span>
      </div>
    </Link>
  );
}

export function BrandHero() {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="relative">
        <div className="absolute inset-0 -z-10 rounded-full bg-[radial-gradient(circle,rgba(65,187,113,0.25),transparent_70%)] blur-2xl" />
        <BrandMark size={64} />
      </div>
      <div className="space-y-1.5">
        <div className="font-display text-2xl font-semibold tracking-[0.18em] text-ink">
          INTEGRITY<span className="brand-text-gradient">PRO</span>
        </div>
        <div className="font-display text-[10px] font-medium uppercase tracking-[0.4em] text-ink-3">
          R4 · Response Console
        </div>
      </div>
    </div>
  );
}
