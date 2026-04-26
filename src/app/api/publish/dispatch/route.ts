import { fail, ok } from '@/lib/api/response'
import { runPendingPublishJobs } from '@/lib/publish/actions'

export async function POST(request: Request) {
  const payload = (await request.json()) as { userId?: string }
  if (!payload.userId) {
    return fail('userId is required', 400, 'MISSING_USER_ID')
  }

  const result = await runPendingPublishJobs(payload.userId)
  return ok(result.data)
}
