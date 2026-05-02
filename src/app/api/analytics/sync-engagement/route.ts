import { z } from 'zod'

import { fail, ok } from '@/lib/api/response'
import { syncPostEngagement } from '@/lib/analytics/engagement-tracker'
import { validateSession } from '@/lib/auth/lucia'

const bodySchema = z.object({
  postId: z.string().min(1),
})

export async function POST(request: Request) {
  const { user } = await validateSession()
  if (!user?.id) {
    return fail('Unauthorized', 401, 'UNAUTHORIZED')
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return fail('Invalid JSON', 400, 'VALIDATION')
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Invalid body', 400, 'VALIDATION')
  }

  const result = await syncPostEngagement(parsed.data.postId, user.id)
  if (!result.success) {
    const status =
      result.code === 'FORBIDDEN'
        ? 403
        : result.code === 'NOT_FOUND'
          ? 404
          : result.code === 'NOT_PUBLISHED'
            ? 409
            : 400
    return fail(result.message, status, result.code)
  }

  return ok({ snapshot: result.snapshot })
}
