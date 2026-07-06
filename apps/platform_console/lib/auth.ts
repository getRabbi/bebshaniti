import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { publicEnv } from "@/lib/public-env";
import { isPlatformAdmin } from "@/lib/server-env";

export async function requirePlatformAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values: { name: string; value: string; options: CookieOptions }[]) => {
        try { values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { /* middleware refreshes cookies */ }
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  if (!isPlatformAdmin(data.user.email)) redirect("/access-denied");
  return data.user;
}
