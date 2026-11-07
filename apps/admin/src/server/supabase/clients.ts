import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { requireServerEnv } from "../env";

/**
 * Cookie-bound client for the signed-in admin (Server Components, Server Actions,
 * Route Handlers). Uses the public anon key; RLS applies.
 */
export async function createSessionClient(): Promise<SupabaseClient> {
  const env = requireServerEnv();
  const cookieStore = await cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component: cookies are read-only there. The proxy
          // refreshes the session cookies on the next request instead.
        }
      },
    },
  });
}

/**
 * Stateless client with the anon key for password sign-in / refresh on behalf of the
 * desktop app. It never persists sessions on the server.
 */
export function createStatelessAuthClient(): SupabaseClient {
  const env = requireServerEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

let adminClient: SupabaseClient | undefined;

/**
 * SERVICE ROLE client. Bypasses RLS: use only in trusted server code after an explicit
 * authorization check. Never return it, or anything derived from its key, to a client.
 */
export function getServiceRoleClient(): SupabaseClient {
  if (adminClient) return adminClient;
  const env = requireServerEnv();
  adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return adminClient;
}
