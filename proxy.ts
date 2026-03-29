import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  const { nextUrl } = req;

  // FastAPI가 설정하는 httpOnly 쿠키 이름과 일치해야 함 (백엔드 확인 필요)
  const isLoggedIn = req.cookies.has("access_token") || req.cookies.has("refresh_token");

  const isLoginPage = nextUrl.pathname.startsWith("/login");
  const isSignupStart =
    nextUrl.pathname.startsWith("/signup") && !nextUrl.searchParams.get("step");

  if (isLoggedIn && (isLoginPage || isSignupStart)) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|landing).*)"],
};
