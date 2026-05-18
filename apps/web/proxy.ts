import { type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";
import type { Database } from "@/lib/supabase/database.types";

const intlMiddleware = createIntlMiddleware(routing);

// Combined proxy (Next.js 16 convention, replaces middleware.ts):
//   - /api/* routes get Supabase session refresh only (no i18n routing)
//   - All other routes get next-intl locale routing first, then Supabase
//     cookies are written to the intl-routed response (so session stays fresh
//     even when the response is a locale redirect/rewrite)
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api")) {
    return updateSession(request);
  }

  const intlResponse = intlMiddleware(request);

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            intlResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh session so server components see the latest auth state.
  await supabase.auth.getUser();

  return intlResponse;
}

export const config = {
  matcher: [
    // Skip Next.js internals, favicon, and static files
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
