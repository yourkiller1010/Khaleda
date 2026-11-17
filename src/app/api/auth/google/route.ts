import { NextRequest, NextResponse } from "next/server";
import { absoluteUrl, randomToken } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) return NextResponse.json({ error: "Google authentication is not configured" }, { status: 503 });
  const state = randomToken();
  const locale = request.nextUrl.searchParams.get("locale") ?? "en";
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", absoluteUrl("/api/auth/google/callback"));
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  const response = NextResponse.redirect(authUrl);
  const secure = process.env.NODE_ENV === "production" && (process.env.APP_URL ?? "").startsWith("https://");
  response.cookies.set("kb_oauth_state", state, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 600 });
  response.cookies.set("kb_oauth_locale", locale, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 600 });
  return response;
}
