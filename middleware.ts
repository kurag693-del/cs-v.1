import { NextResponse, type NextRequest } from 'next/server'

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

export async function middleware(request: NextRequest) {
  return NextResponse.next()
}
