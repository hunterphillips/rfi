import { BrandLockup } from "./brand";
import { signOut } from "@/app/actions";

export function AppHeader({
  userEmail,
}: {
  userEmail?: string | null;
}) {
  return (
    <header className="relative z-20 border-b border-line bg-canvas/80 backdrop-blur-xl">
      {/* hairline brand gradient at the very top — subtle thread */}
      <div className="brand-gradient h-[1px] w-full opacity-50" />

      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <BrandLockup />

        <div className="flex items-center gap-5">
          {userEmail && (
            <span className="hidden font-mono text-[11px] text-ink-3 md:inline">
              {userEmail}
            </span>
          )}
          <form action={signOut}>
            <button
              type="submit"
              className="font-display text-[10px] font-medium uppercase tracking-[0.18em] text-ink-3 transition-colors hover:text-ink"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
