import { z } from 'zod'
import { Platform, ContentStatus } from '@prisma/client'

export const CreatePostSchema = z.object({
  title: z.string().min(1, 'Заголовок обязателен').max(200, 'Не более 200 символов'),
  content: z.string().min(1, 'Контент обязателен').max(5000, 'Не более 5000 символов'),
  platform: z.nativeEnum(Platform),
  scheduledAt: z.date().optional(),
  mediaUrls: z.array(z.string().url()).max(10, 'Максимум 10 медиафайлов').optional(),
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

export type CreatePostInput = z.infer<typeof CreatePostSchema>
export type UpdatePostStatusInput = z.infer<typeof UpdatePostStatusSchema>

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
  const now = new Date()
  const minScheduleDelay = new Date(now.getTime() + 5 * 60 * 1000) // now + 5min

  const transitions: Record<ContentStatus, ContentStatus[]> = {
    DRAFT: ['SCHEDULED', 'PUBLISHED'],
    SCHEDULED: ['PUBLISHED', 'DRAFT'],
    PUBLISHED: [],
    ARCHIVED: [],
  }

  if (!transitions[currentStatus]?.includes(newStatus)) {
    return {
      valid: false,
      reason: `Нельзя перейти из "${currentStatus}" в "${newStatus}"`,
    }
  }

  if (newStatus === 'SCHEDULED' && scheduledAt) {
    if (scheduledAt < minScheduleDelay) {
      return {
        valid: false,
        reason: 'Дата публикации должна быть не ранее 5 минут от текущего времени',
      }
    }
    if (scheduledAt < now) {
      return {
        valid: false,
        reason: 'Дата публикации не может быть в прошлом',
      }
    }
  }

  if (newStatus === 'PUBLISHED' && currentStatus === 'SCHEDULED' && scheduledAt && scheduledAt > now) {
    return {
      valid: false,
      reason: 'Запланированный пост нельзя опубликовать до даты публикации',
    }
  }

  return { valid: true }
}
