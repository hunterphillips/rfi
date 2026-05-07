import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-1 items-center justify-center bg-zinc-50 p-6 dark:bg-black">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            RFI
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Sign in with your IPC email to continue.
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
