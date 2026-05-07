import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  if (process.env.VERCEL_ENV !== 'preview') {
    return NextResponse.next()
  }

  const user = process.env.DEV_USER
  const pass = process.env.DEV_PASS

  if (!user || !pass) {
    return NextResponse.next()
  }

  const auth = req.headers.get('authorization')
  if (auth) {
    const expected = `Basic ${btoa(`${user}:${pass}`)}`
    if (auth === expected) {
      return NextResponse.next()
    }
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="ARC Dev"' },
  })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/health).*)'],
}
