import { fail, ok } from '@/lib/api/response'
import { listPublishedPostsChannelMetrics } from '@/lib/analytics/actions'
import { validateSession } from '@/lib/auth/lucia'

export async function GET() {
  const { user } = await validateSession()
  if (!user?.id) {
    return fail('Unauthorized', 401, 'UNAUTHORIZED')
  }
  const rows = await listPublishedPostsChannelMetrics(user.id)
  return ok({ posts: rows })
}
