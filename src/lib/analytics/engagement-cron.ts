import { Platform } from '@prisma/client'

import { prisma } from '@/lib/db'

import { syncPostEngagement } from '@/lib/analytics/engagement-tracker'

export type EngagementBatchResult = {
  attempted: number
  succeeded: number
  failed: number
}

/**
 * Пакетная синхронизация для cron (ограничение по числу постов за запуск).
 * Берёт последние опубликованные посты VK / Telegram.
 */
export async function runEngagementSyncBatch(limit: number): Promise<EngagementBatchResult> {
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 50)

  const posts = await prisma.post.findMany({
    where: {
      status: 'PUBLISHED',
      deletedAt: null,
      platform: { in: [Platform.VK, Platform.TELEGRAM] },
    },
    orderBy: { publishedAt: 'desc' },
    take: safeLimit,
    select: { id: true, userId: true },
  })

  let succeeded = 0
  let failed = 0

  for (const p of posts) {
    const r = await syncPostEngagement(p.id, p.userId)
    if (r.success) succeeded += 1
    else failed += 1
  }

  return { attempted: posts.length, succeeded, failed }
}
