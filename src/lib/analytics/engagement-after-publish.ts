import type { PublishTarget } from '@/lib/validation/publish'

import { syncPostEngagement } from '@/lib/analytics/engagement-tracker'

/** Неблокирующий вызов после успешной доставки в канал (включается `ENGAGEMENT_SYNC_AFTER_PUBLISH=true`). */
export function scheduleEngagementSyncAfterPublish(postId: string, userId: string, target: PublishTarget): void {
  if (process.env.ENGAGEMENT_SYNC_AFTER_PUBLISH !== 'true') return
  if (target === 'DZEN') return

  queueMicrotask(() => {
    void syncPostEngagement(postId, userId).catch((err: unknown) => {
      console.error('[engagement] post-publish sync failed', postId, err)
    })
  })
}
