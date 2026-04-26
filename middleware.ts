import { NextResponse, type NextRequest } from 'next/server'

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}

export async function middleware(request: NextRequest) {
  const publicRoutes = ['/login', '/register']
  const pathname = request.nextUrl.pathname

  const isPublic = publicRoutes.includes(pathname) || pathname.startsWith('/api/')
  
  const accessToken = request.cookies.get('sb-access-token')?.value

  if (!isPublic && !accessToken) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (accessToken) {
    const response = NextResponse.next()
    response.cookies.set('sb-access-token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
      path: '/',
    })
    return response
  }

  return NextResponse.next()
}
