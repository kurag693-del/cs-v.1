import { fail, ok } from '@/lib/api/response'
import { getAnalyticsSummary } from '@/lib/analytics/actions'
import { validateSession } from '@/lib/auth/lucia'

export async function GET(request: Request) {
  const { user } = await validateSession()
  if (!user?.id) {
    return fail('Unauthorized', 401, 'UNAUTHORIZED')
  }

  const summary = await getAnalyticsSummary(user.id)
  if (!summary.success) {
    return fail(summary.error ?? 'Failed to load analytics', 400, 'ANALYTICS_FAILED')
  }
  return ok(summary.data)
}
