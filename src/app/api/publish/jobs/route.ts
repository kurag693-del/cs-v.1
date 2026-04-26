import { fail, ok } from '@/lib/api/response'
import { enqueuePublishJob, listPublishJobs } from '@/lib/publish/actions'

export async function GET(request: Request) {
  const userId = new URL(request.url).searchParams.get('userId')
  if (!userId) {
    return fail('userId is required', 400, 'MISSING_USER_ID')
  }

  const result = await listPublishJobs(userId)
  return ok(result.data)
}

export async function POST(request: Request) {
  const payload = (await request.json()) as { userId?: string; postId?: string; target?: 'VK' | 'TELEGRAM' }
  if (!payload.userId || !payload.postId || !payload.target) {
    return fail('userId, postId and target are required', 400, 'INVALID_PUBLISH_REQUEST')
  }

  const result = await enqueuePublishJob(payload.userId, payload.postId, payload.target)
  if (!result.success) {
    return fail(result.error ?? 'Post not found', 404, 'PUBLISH_POST_NOT_FOUND')
  }

  return ok(result.data, 201)
}
