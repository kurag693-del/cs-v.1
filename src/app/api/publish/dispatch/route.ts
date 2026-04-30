import { fail, ok } from '@/lib/api/response'
import { runPendingPublishJobs } from '@/lib/publish/actions'
import { validateSession } from '@/lib/auth/lucia'
import { DispatchPublishSchema } from '@/lib/validation/publish'

export async function POST(request: Request) {
  const { user } = await validateSession()
  if (!user?.id) {
    return fail('Unauthorized', 401, 'UNAUTHORIZED')
  }

  const payloadRaw = (await request.json()) as { userId?: string; limit?: number }
  if (payloadRaw.userId && payloadRaw.userId !== user.id) {
    return fail('Cross-tenant dispatch is forbidden', 403, 'FORBIDDEN_TENANT_MISMATCH')
  }

  const payload = DispatchPublishSchema.safeParse({ limit: payloadRaw.limit })
  if (!payload.success) {
    return fail(payload.error.issues[0]?.message ?? 'Invalid dispatch payload', 400, 'INVALID_DISPATCH_REQUEST')
  }

  const result = await runPendingPublishJobs(user.id, payload.data.limit ?? 20)
  return ok({
    ...result.data,
    mode: process.env.PUBLISH_MODE ?? 'sandbox',
  })
}
