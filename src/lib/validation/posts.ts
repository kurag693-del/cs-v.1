import { z } from 'zod'
import { Platform, ContentStatus } from '@prisma/client'
import { MediaUrlsSchema } from '@/lib/validation/media'
import { canTransitionPostStatus } from '@/lib/publish/state-machine'

export const CreatePostSchema = z.object({
  title: z.string().min(1, 'Заголовок обязателен').max(200, 'Не более 200 символов').optional(),
  content: z.string().min(1, 'Контент обязателен').max(5000, 'Не более 5000 символов'),
  platform: z.nativeEnum(Platform),
  scheduledAt: z.date().optional(),
  mediaUrls: MediaUrlsSchema.optional(),
  brandId: z.string().optional(),
  generationId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const UpdatePostStatusSchema = z.object({
  postId: z.string(),
  status: z.nativeEnum(ContentStatus),
  scheduledAt: z.date().optional(),
  publishedAt: z.date().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const CalendarPostFiltersSchema = z.object({
  platform: z.nativeEnum(Platform).optional(),
  status: z.nativeEnum(ContentStatus).optional(),
  brandId: z.string().min(1).optional(),
})

export const SchedulePostInputSchema = z.object({
  postId: z.string().min(1, 'Некорректный идентификатор поста'),
  userId: z.string().min(1, 'Пользователь не определен'),
  scheduledAt: z.coerce.date(),
})

export type CreatePostInput = z.infer<typeof CreatePostSchema>
export type UpdatePostStatusInput = z.infer<typeof UpdatePostStatusSchema>
export type CalendarPostFiltersInput = z.infer<typeof CalendarPostFiltersSchema>
export type SchedulePostInput = z.infer<typeof SchedulePostInputSchema>

export type Result<T, E = Error> = {
  success: true
  data: T
} | {
  success: false
  error: string
  details?: unknown
  code?: string
}

// Status flow validation
export function validateStatusTransition(currentStatus: ContentStatus, newStatus: ContentStatus, scheduledAt?: Date): { valid: true } | { valid: false; reason: string } {
  const result = canTransitionPostStatus(currentStatus, newStatus, { scheduledAt })
  if (!result.valid) {
    return { valid: false, reason: result.message }
  }
  return { valid: true }
}
