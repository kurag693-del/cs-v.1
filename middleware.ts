import { NextResponse, type NextRequest } from 'next/server'
import { lucia, validateSession } from '@/lib/auth/lucia'

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

export async function middleware(request: NextRequest) {
  const publicRoutes = ['/login', '/register']
  const pathname = request.nextUrl.pathname

  const isPublic =
    publicRoutes.includes(pathname) || pathname.startsWith('/api/webhooks/') || pathname.startsWith('/api/auth/')
  if (isPublic) return NextResponse.next()

  const sessionId = request.cookies.get(lucia.sessionCookieName)?.value ?? null
  if (!sessionId) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const { user, session } = await validateSession(sessionId)
  if (!session || !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-user-id', user.id)

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
}
