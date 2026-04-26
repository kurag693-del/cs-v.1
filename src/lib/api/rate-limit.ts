import { NextResponse } from 'next/server'
import { checkCredits } from '@/lib/billing/actions'
import { prisma } from '@/lib/db'

export async function withRateLimit(
  request: Request,
  handler: (req: Request, userId: string) => Promise<Response>,
  cost = 1
): Promise<Response> {
  // Extract userId from headers (set by middleware)
  const userId = request.headers.get('x-user-id')

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check credits
  const credits = await checkCredits(userId)

  if (credits.available < cost) {
    return NextResponse.json(
      {
        error: 'Insufficient credits',
        code: 'INSUFFICIENT_CREDITS',
        available: credits.available,
        required: cost,
      },
      { status: 402 }
    )
  }

  // Rate limit check (max 100 requests per hour per user)
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const recentRequests = await prisma.generation.count({
    where: {
      userId,
      createdAt: { gte: hourAgo },
    },
  })

  if (recentRequests >= 100) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: 3600, // 1 hour
      },
      { status: 429 }
    )
  }

  // Record request
  await prisma.generation.create({
    data: {
      userId,
      type: 'rate_limit_marker',
      prompt: 'Rate limit tracking',
      output: 'Rate limit request marker',
      status: 'COMPLETED',
      model: 'system',
      tokens: 0,
    },
  })

  return handler(request, userId)
}
