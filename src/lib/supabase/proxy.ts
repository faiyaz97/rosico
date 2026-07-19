import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { publicEnv } from "@/lib/env";

export async function refreshSession(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-rosica-pathname", request.nextUrl.pathname);
  let response = NextResponse.next({
    request: { headers: requestHeaders }
  });
  const env = publicEnv();
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request: { headers: requestHeaders }
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        }
      }
    }
  );

  const {
    data: { user }
  } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isProtected = path === "/app" || path.startsWith("/app/");
  const isGroupPath = /^\/app\/groups\/[0-9a-f-]{36}(?:\/|$)/i.test(path);
  const isMutationScreen =
    /\/(?:new|edit|settings|share|catalog|custom)(?:\/|$)/i.test(path);
  const isPotentialPublicGroup = isGroupPath && !isMutationScreen;
  const isAuthPage = ["/login", "/register"].includes(path);

  if (isProtected && !user && !isPotentialPublicGroup) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (isAuthPage && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
