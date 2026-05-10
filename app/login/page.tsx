import { BrandHero } from "@/app/components/brand";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="relative isolate flex min-h-dvh flex-1 items-center justify-center overflow-hidden p-6">
      {/* Decorative connector graphics — circuit motif drifting off-canvas */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute -left-20 top-1/4 hidden h-[420px] w-[420px] opacity-[0.09] md:block"
        viewBox="0 0 200 200"
        fill="none"
      >
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="200" y2="200">
            <stop offset="0%" stopColor="#8ec841" />
            <stop offset="100%" stopColor="#27b681" />
          </linearGradient>
        </defs>
        <g stroke="url(#lg)" strokeWidth="1.5" fill="none">
          <path d="M10 40 Q60 40 60 80 L60 120 Q60 160 100 160 L180 160" />
          <path d="M10 80 L40 80 Q60 80 60 100" />
        </g>
        <g fill="url(#lg)">
          <circle cx="10" cy="40" r="4" />
          <circle cx="60" cy="80" r="4" />
          <circle cx="60" cy="120" r="4" />
          <circle cx="100" cy="160" r="4" />
          <circle cx="180" cy="160" r="5" />
        </g>
      </svg>

      <svg
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 bottom-1/4 hidden h-[480px] w-[480px] rotate-180 opacity-[0.09] md:block"
        viewBox="0 0 200 200"
        fill="none"
      >
        <defs>
          <linearGradient id="lg2" x1="0" y1="0" x2="200" y2="200">
            <stop offset="0%" stopColor="#8ec841" />
            <stop offset="100%" stopColor="#27b681" />
          </linearGradient>
        </defs>
        <g stroke="url(#lg2)" strokeWidth="1.5" fill="none">
          <path d="M10 40 Q60 40 60 80 L60 140 Q60 180 100 180 L180 180" />
          <path d="M40 100 L100 100" />
        </g>
        <g fill="url(#lg2)">
          <circle cx="10" cy="40" r="4" />
          <circle cx="60" cy="80" r="4" />
          <circle cx="100" cy="180" r="4" />
          <circle cx="180" cy="180" r="5" />
          <circle cx="40" cy="100" r="3" />
        </g>
      </svg>

      <div className="relative w-full max-w-sm space-y-8">
        <div className="rise rise-1">
          <BrandHero />
        </div>

        <div className="rise rise-2">
          <LoginForm />
        </div>

        <p className="rise rise-3 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-ink-5">
          internal · @integritypro.com only
        </p>
      </div>
    </div>
  );
}
