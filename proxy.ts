// proxy.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 1. accessToken 확인 (Path=/ 이므로 어디서든 읽힘)
  const accessToken = request.cookies.get('accessToken')?.value;

  // 2. 보호가 필요한 경로 리스트
  const isProtectedRoute = pathname.startsWith('/dashboard') || 
                           pathname.startsWith('/archive') ||
                           pathname.startsWith('/analysis') ||
                           pathname.startsWith('/export');

  const isAuthPage = pathname.startsWith('/login') ||
                    pathname.startsWith('/signup')

  const isLandingPage = pathname.startsWith('/') ||
                        pathname.startsWith('/landing')
                        
  if(accessToken && (isAuthPage || isLandingPage)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // 3. 로그인이 필요한 페이지에 accessToken이 없는 경우
  if (isProtectedRoute && !accessToken) {
    // 여기서 중요: 리프레시 토큰은 Path 제한 때문에 proxy가 읽을 수 없습니다.
    // 따라서 일단 로그인 페이지로 보내거나, 인증 확인 전용 API로 리다이렉트해야 합니다.
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }
  

  return NextResponse.next();
}

// 적용할 경로 패턴 설정 (기존 matcher와 동일)
export const config = {
  matcher: [
    /*
     * 아래 경로들을 제외한 모든 요청에 proxy 실행:
     * - api (API 라우트)
     * - _next/static (정적 파일)
     * - _next/image (이미지 최적화 파일)
     * - favicon.ico (아이콘 파일)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
