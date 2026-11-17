import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";

const intl = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const candidate = request.nextUrl.pathname.split("/")[1] ?? "";
  const isLocalePath = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/i.test(candidate);
  const isBuiltIn = (routing.locales as readonly string[]).includes(candidate);
  const requestHeaders = new Headers(request.headers);
  if (isLocalePath && !isBuiltIn) requestHeaders.set("X-NEXT-INTL-LOCALE", candidate.toLowerCase());
  const response = isLocalePath && !isBuiltIn ? NextResponse.next({ request: { headers: requestHeaders } }) : intl(request) ?? NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://telegram.org; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' ws: wss: https:; frame-src https://oauth.telegram.org; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  return response;
}

export const config = { matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"] };
