import { z } from 'zod'

export const PublishTargetSchema = z.enum(['VK', 'TELEGRAM', 'DZEN'])

export const EnqueuePublishJobSchema = z.object({
  postId: z.string().min(1, 'postId is required'),
  target: PublishTargetSchema,
})

export const DispatchPublishSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20).optional(),
})

export type PublishTarget = z.infer<typeof PublishTargetSchema>
