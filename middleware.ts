import { NextResponse, type NextRequest } from 'next/server'
import { resolveAccessDecision } from '@/lib/auth/middleware-routes'

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

export async function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get('session')?.value ?? request.cookies.get('auth_session')?.value ?? null
  const decision = resolveAccessDecision(request.nextUrl.pathname, Boolean(sessionCookie))

  if (decision === 'redirect_login') {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}
