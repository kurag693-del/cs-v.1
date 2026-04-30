import { fail, ok } from '@/lib/api/response'
import { enqueuePublishJob, listPublishJobs } from '@/lib/publish/actions'
import { validateSession } from '@/lib/auth/lucia'
import { EnqueuePublishJobSchema } from '@/lib/validation/publish'

const publishJobsRateLimit = new Map<string, { count: number; windowStart: number }>()

function isRateLimited(userId: string): boolean {
  const now = Date.now()
  const entry = publishJobsRateLimit.get(userId)
  if (!entry || now - entry.windowStart > 60_000) {
    publishJobsRateLimit.set(userId, { count: 1, windowStart: now })
    return false
  }
  if (entry.count >= 10) {
    return true
  }
  publishJobsRateLimit.set(userId, { ...entry, count: entry.count + 1 })
  return false
}

export async function GET(request: Request) {
  const { user } = await validateSession()
  const userId = user?.id ?? new URL(request.url).searchParams.get('userId')
  if (!userId) {
    return fail('userId is required', 400, 'MISSING_USER_ID')
  }

  const result = await listPublishJobs(userId)
  return ok(result.data)
}

export async function POST(request: Request) {
  const cronSecret = request.headers.get('x-cron-secret')
  const expectedSecret = process.env.CRON_SECRET
  if (!expectedSecret) {
    return fail('CRON_SECRET is not configured', 500, 'CRON_SECRET_MISSING')
  }
  if (!cronSecret) {
    return fail('Missing cron secret', 401, 'CRON_SECRET_REQUIRED')
  }
  if (cronSecret !== expectedSecret) {
    return fail('Invalid cron secret', 403, 'CRON_SECRET_INVALID')
  }

  const { user } = await validateSession()
  if (!user?.id) {
    return fail('Unauthorized', 401, 'UNAUTHORIZED')
  }

  if (isRateLimited(user.id)) {
    return fail('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED')
  }

  const payloadRaw = (await request.json()) as { userId?: string; postId?: string; target?: 'VK' | 'TELEGRAM' | 'DZEN' }
  if (payloadRaw.userId && payloadRaw.userId !== user.id) {
    return fail('Cross-tenant enqueue is forbidden', 403, 'FORBIDDEN_TENANT_MISMATCH')
  }

  const payload = EnqueuePublishJobSchema.safeParse({
    postId: payloadRaw.postId,
    target: payloadRaw.target,
  })
  if (!payload.success) {
    return fail(payload.error.issues[0]?.message ?? 'Invalid publish payload', 400, 'INVALID_PUBLISH_REQUEST')
  }

  const result = await enqueuePublishJob(user.id, payload.data.postId, payload.data.target)
  if (!result.success) {
    return fail(result.error ?? 'Post not found', 404, 'PUBLISH_POST_NOT_FOUND')
  }

  return ok(result.data, 201)
}
