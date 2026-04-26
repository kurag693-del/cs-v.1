import { fail, ok } from '@/lib/api/response'
import { getAnalyticsSummary } from '@/lib/analytics/actions'

export async function GET(request: Request) {
  const userId = new URL(request.url).searchParams.get('userId')
  if (!userId) {
    return fail('userId is required', 400, 'MISSING_USER_ID')
  }

  const summary = await getAnalyticsSummary(userId)
  return ok(summary.data)
}
