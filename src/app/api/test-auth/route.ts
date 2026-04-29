import { NextResponse } from 'next/server'
import { lucia } from '@/lib/auth/lucia'
import { prisma } from '@/lib/db/prisma'

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie') ?? ''
    const sessionCookie = cookieHeader
      .split(';')
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${lucia.sessionCookieName}=`))
    const sessionId = sessionCookie?.split('=')[1]
    const session = sessionId
      ? await prisma.session.findUnique({
          where: { id: decodeURIComponent(sessionId) },
          include: { user: { select: { id: true, email: true } } },
        })
      : null

    return NextResponse.json({
      success: true,
      mode: 'lucia',
      user: session?.user ?? null,
      error: null,
      headers: {
        'x-user-id': request.headers.get('x-user-id'),
        'x-user-email': request.headers.get('x-user-email'),
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        mode: 'supabase',
        user: null,
        error: error instanceof Error ? error.message : 'Unexpected auth check error',
        headers: {
          'x-user-id': request.headers.get('x-user-id'),
          'x-user-email': request.headers.get('x-user-email'),
        },
      },
      { status: 500 }
    )
  }
}
