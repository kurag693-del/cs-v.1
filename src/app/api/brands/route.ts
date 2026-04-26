import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, ok } from '@/lib/api/response'

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId')

  if (!userId) {
    return fail('userId is required', 400, 'MISSING_USER_ID')
  }

  try {
    const brands = await prisma.brand.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return ok(brands)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return fail(message, 500, 'BRANDS_FETCH_FAILED')
  }
}
