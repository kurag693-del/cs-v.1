import { z } from 'zod'

import { fail, ok } from '@/lib/api/response'
import { runEngagementSyncBatch } from '@/lib/analytics/engagement-cron'

const bodySchema = z.object({
  limit: z.number().int().min(1).max(50).optional(),
})

/**
 * Пакетное обновление метрик каналов. Только с секретом cron (как фоновые задачи).
 * Заголовок: x-cron-secret: ${CRON_SECRET}
 * Тело (опционально): { "limit": 15 }
 */
export async function POST(request: Request) {
  const cronSecret = request.headers.get('x-cron-secret')
  const expectedSecret = process.env.CRON_SECRET
  if (!expectedSecret) {
    return fail('CRON_SECRET is not configured', 500, 'CRON_SECRET_MISSING')
  }
  if (!cronSecret || cronSecret !== expectedSecret) {
    return fail('Invalid cron secret', 403, 'CRON_SECRET_INVALID')
  }

  let json: unknown = {}
  try {
    const text = await request.text()
    if (text.trim()) json = JSON.parse(text) as unknown
  } catch {
    return fail('Invalid JSON body', 400, 'INVALID_JSON')
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Invalid body', 400, 'VALIDATION')
  }

  const defaultLimit = Number(process.env.ENGAGEMENT_CRON_BATCH_LIMIT ?? '15') || 15
  const limit = parsed.data.limit ?? defaultLimit

  const result = await runEngagementSyncBatch(limit)
  return ok(result)
}
