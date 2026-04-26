'use server'

import { prisma } from '@/lib/db'
import { CreatePostSchema, UpdatePostStatusSchema, type Result, validateStatusTransition } from '@/lib/validation/posts'
import { revalidatePath } from 'next/cache'
import { Prisma, type ContentStatus, type Platform } from '@prisma/client'
import { z } from 'zod'

const SaveGenerationAsDraftSchema = z.object({
  generationId: z.string().min(1, 'generationId обязателен'),
  userId: z.string().min(1, 'userId обязателен'),
  platform: z.string().min(1, 'platform обязателен'),
})

function mapGenerationPlatformToPostPlatform(platform: string): Platform | null {
  const normalized = platform.trim()

  if (normalized === 'TikTok') return 'TIKTOK'
  if (normalized === 'Instagram') return 'INSTAGRAM'
  if (normalized === 'Telegram') return 'INSTAGRAM'
  if (normalized === 'VK') return 'INSTAGRAM'

  if (normalized === 'TIKTOK') return 'TIKTOK'
  if (normalized === 'INSTAGRAM') return 'INSTAGRAM'
  if (normalized === 'TWITTER') return 'TWITTER'
  if (normalized === 'LINKEDIN') return 'LINKEDIN'
  if (normalized === 'FACEBOOK') return 'FACEBOOK'
  if (normalized === 'YOUTUBE') return 'YOUTUBE'

  return null
}

export async function createPost(data: FormData, userId: string): Promise<Result<unknown>> {
  try {
    const rawData = {
      title: data.get('title') as string,
      content: data.get('content') as string,
      platform: data.get('platform') as Platform,
      scheduledAt: data.get('scheduledAt') ? new Date(data.get('scheduledAt') as string) : undefined,
      mediaUrls: JSON.parse((data.get('mediaUrls') as string) || '[]'),
      brandId: (data.get('brandId') as string) || undefined,
      generationId: (data.get('generationId') as string) || undefined,
      metadata: JSON.parse((data.get('metadata') as string) || '{}') as Record<string, unknown>,
    }

    const validated = CreatePostSchema.safeParse(rawData)

    if (!validated.success) {
      return {
        success: false,
        error: 'Ошибка валидации',
        details: validated.error.flatten().fieldErrors,
      }
    }

    const post = await prisma.post.create({
      data: {
        ...validated.data,
        metadata: (validated.data.metadata ?? {}) as Prisma.InputJsonValue,
        userId,
        status: 'DRAFT' as const,
      },
    })

    revalidatePath('/dashboard/calendar')

    return {
      success: true,
      data: post,
    }
  } catch (err: any) {
    console.error('Create post error:', err)
    return {
      success: false,
      error: err.message || 'Ошибка при создании поста',
    }
  }
}

export async function updatePostStatus(data: FormData, userId: string): Promise<Result<any>> {
  try {
    const validated = UpdatePostStatusSchema.safeParse({
      postId: data.get('postId') as string,
      status: data.get('status') as ContentStatus,
      scheduledAt: data.get('scheduledAt') ? new Date(data.get('scheduledAt') as string) : undefined,
      publishedAt: data.get('publishedAt') ? new Date(data.get('publishedAt') as string) : undefined,
      metadata: JSON.parse((data.get('metadata') as string) || '{}'),
    })

    if (!validated.success) {
      return {
        success: false,
        error: 'Ошибка валидации',
        details: validated.error.flatten().fieldErrors,
      }
    }

    const { postId, status, scheduledAt, publishedAt } = validated.data

    // Fetch current post
    const currentPost = await prisma.post.findFirst({
      where: { id: postId, userId },
    })

    if (!currentPost) {
      return {
        success: false,
        error: 'Пост не найден',
        code: 'NOT_FOUND',
      }
    }

    // Validate status transition
    const transition = validateStatusTransition(currentPost.status, status, scheduledAt || currentPost.scheduledAt || undefined)

    if (!transition.valid) {
      return {
        success: false,
        error: transition.reason,
        code: 'INVALID_TRANSITION',
      }
    }

    const updateData = {
      status,
      scheduledAt,
      publishedAt: status === 'PUBLISHED' && !publishedAt ? new Date() : publishedAt,
      metadata: (validated.data.metadata ?? {}) as Prisma.InputJsonValue,
      updatedAt: new Date(),
    }

    const post = await prisma.post.update({
      where: {
        id: postId,
        userId,
      },
      data: updateData,
    })

    revalidatePath('/dashboard/calendar')

    return {
      success: true,
      data: post,
    }
  } catch (err: any) {
    console.error('Update post status error:', err)
    return {
      success: false,
      error: err.message || 'Ошибка при обновлении статуса',
    }
  }
}

export async function updatePostSchedule(data: FormData, userId: string): Promise<Result<unknown>> {
  try {
    const postId = data.get('postId') as string
    const scheduledAt = new Date(data.get('scheduledAt') as string)
    const platform = data.get('platform') as Platform

    const currentPost = await prisma.post.findFirst({
      where: { id: postId, userId },
    })

    if (!currentPost) {
      return {
        success: false,
        error: 'Пост не найден',
        code: 'NOT_FOUND',
      }
    }

    const minScheduleDelay = new Date(Date.now() + 5 * 60 * 1000)

    if (scheduledAt < minScheduleDelay) {
      return {
        success: false,
        error: 'Дата публикации должна быть не ранее 5 минут от текущего времени',
        code: 'INVALID_SCHEDULE',
      }
    }

    const newStatus = scheduledAt <= new Date() ? 'PUBLISHED' : 'SCHEDULED'

    const post = await prisma.post.update({
      where: {
        id: postId,
        userId,
      },
      data: {
        status: newStatus,
        scheduledAt,
        platform,
        updatedAt: new Date(),
      },
    })

    revalidatePath('/dashboard/calendar')

    return {
      success: true,
      data: post,
    }
  } catch (err: any) {
    console.error('Update post schedule error:', err)
    return {
      success: false,
      error: err.message || 'Ошибка при обновлении расписания',
    }
  }
}

export async function getCalendarPosts(userId: string, startDate: Date, endDate: Date) {
  try {
    const posts = await prisma.post.findMany({
      where: {
        userId,
        scheduledAt: {
          gte: startDate,
          lte: endDate,
        },
        deletedAt: null,
      },
      orderBy: {
        scheduledAt: 'asc',
      },
      include: {
        brand: true,
        generation: true,
      },
    })

    return {
      success: true,
      data: posts,
    }
  } catch (err: any) {
    console.error('Get calendar posts error:', err)
    return {
      success: false,
      error: err.message || 'Ошибка при загрузке постов',
    }
  }
}

export async function getDrafts(userId: string) {
  try {
    const posts = await prisma.post.findMany({
      where: {
        userId,
        status: 'DRAFT',
        deletedAt: null,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      include: {
        brand: true,
      },
    })

    return {
      success: true,
      data: posts,
    }
  } catch (err: any) {
    console.error('Get drafts error:', err)
    return {
      success: false,
      error: err.message || 'Ошибка при загрузке черновиков',
    }
  }
}

export async function saveGenerationAsDraft(
  generationId: string,
  userId: string,
  platform: string
): Promise<{ success: true; postId: string } | { success: false; error: string }> {
  try {
    const parsed = SaveGenerationAsDraftSchema.safeParse({
      generationId,
      userId,
      platform,
    })

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Некорректные входные параметры',
      }
    }

    const postPlatform = mapGenerationPlatformToPostPlatform(parsed.data.platform)
    if (!postPlatform) {
      return {
        success: false,
        error: 'Неподдерживаемая платформа',
      }
    }

    const generation = await prisma.generation.findFirst({
      where: {
        id: parsed.data.generationId,
        userId: parsed.data.userId,
        status: 'COMPLETED',
        deletedAt: null,
      },
      select: {
        id: true,
        userId: true,
        brandId: true,
        output: true,
      },
    })

    if (!generation) {
      return {
        success: false,
        error: 'Генерация не найдена или недоступна',
      }
    }

    if (!generation.output || !generation.output.trim()) {
      return {
        success: false,
        error: 'В генерации отсутствует текст для сохранения',
      }
    }

    const title = generation.output.split('\n').find((line) => line.trim().length > 0)?.trim().slice(0, 80) || 'Черновик'

    const post = await prisma.post.create({
      data: {
        userId: generation.userId,
        brandId: generation.brandId ?? null,
        generationId: generation.id,
        platform: postPlatform,
        content: generation.output,
        mediaUrls: [],
        status: 'DRAFT',
        scheduledAt: null,
        metadata: {
          source: 'generation',
          title,
        } as Prisma.InputJsonValue,
      },
      select: {
        id: true,
      },
    })

    revalidatePath('/dashboard/calendar')

    return {
      success: true,
      postId: post.id,
    }
  } catch (error: unknown) {
    console.error('saveGenerationAsDraft error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка при сохранении черновика',
    }
  }
}
