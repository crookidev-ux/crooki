import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { NextResponse, type NextRequest } from "next/server";

const handleI18nRouting = createMiddleware(routing);

export function proxy(request: NextRequest) {
  // The admin panel is Spanish only (decision 2026-11-24): /en/admin* → /admin*.
  const { pathname } = request.nextUrl;
  if (pathname === "/en/admin" || pathname.startsWith("/en/admin/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(3);
    return NextResponse.redirect(url);
  }
  return handleI18nRouting(request);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
