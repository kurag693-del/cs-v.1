import { z } from 'zod'

/** Снимок метрик канала (фаза 11). Хранится в `Post.metadata.engagement`. */
export const postEngagementSnapshotSchema = z.object({
  views: z.number().int().nonnegative().optional(),
  likes: z.number().int().nonnegative().optional(),
  comments: z.number().int().nonnegative().optional(),
  reposts: z.number().int().nonnegative().optional(),
  source: z.enum(['vk', 'telegram', 'manual', 'mock', 'unavailable']),
  fetchedAt: z.string(),
  error: z.string().optional(),
})

export type PostEngagementSnapshot = z.infer<typeof postEngagementSnapshotSchema>

export type ChannelMetricRow = {
  postId: string
  platform: string
  publishedAt: string | null
  excerpt: string
  engagement: PostEngagementSnapshot | null
}
