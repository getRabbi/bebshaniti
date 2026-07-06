import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function allowed(email: string | null | undefined) {
  const allowlist = (process.env.PLATFORM_ADMIN_EMAILS ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  return Boolean(email && allowlist.includes(email.toLowerCase()));
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values: { name: string; value: string; options: CookieOptions }[]) => {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const publicPath = path === "/login" || path === "/access-denied";
  if (!data.user && !publicPath) return NextResponse.redirect(new URL("/login", request.url));
  if (data.user && !allowed(data.user.email) && path !== "/access-denied") return NextResponse.redirect(new URL("/access-denied", request.url));
  if (data.user && allowed(data.user.email) && publicPath) return NextResponse.redirect(new URL("/", request.url));
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"] };
