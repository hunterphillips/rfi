import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll called from a Server Component — middleware refreshes the
            // session, so this is safe to ignore here.
          }
        },
      },
    },
  );
}

/**
 * Service-role client — BYPASSES RLS. Use only in server-side code that has
 * already authorized the caller. The intended use is non-owner writes that RLS
 * deliberately keeps owner-only (reviewer approve, editor topic/capability-map
 * edits): authorize via `getDraftAccess`, then write with this client. Never
 * import this into a Client Component or expose the key to the browser.
 */
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
