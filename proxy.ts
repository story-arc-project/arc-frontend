import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const isLoggedIn = !!session;

  const isLoginPage = nextUrl.pathname.startsWith("/login");
  // /signup은 온보딩 중인 유저(step=profile 등)도 접근해야 하므로 온보딩 스텝이 없을 때만 차단
  const isSignupStart = nextUrl.pathname.startsWith("/signup") && !nextUrl.searchParams.get("step");

  if (isLoggedIn && (isLoginPage || isSignupStart)) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|landing).*)"],
};
