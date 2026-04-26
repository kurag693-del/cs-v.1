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
  title: z.string().trim().min(1, 'Название поста обязательно').max(120, 'Название слишком длинное').optional(),
})

const SchedulePostSchema = z.object({
  postId: z.string().min(1, 'Некорректный идентификатор поста'),
  scheduledAt: z.string().datetime({ offset: true, message: 'Некорректная дата планирования' }),
  userId: z.string().min(1, 'Пользователь не определен'),
})

const GenerationOutputSchema = z.object({
  hook: z.string().default(''),
  body: z.string().default(''),
  hashtags: z
    .union([z.array(z.string()), z.string()])
    .transform((value) =>
      Array.isArray(value)
        ? value.map((item) => item.trim()).filter(Boolean)
        : value
            .split(/\s+/)
            .map((item) => item.trim())
            .filter(Boolean)
    )
    .default([]),
  cta: z.string().default(''),
})

type SaveAsDraftResult = { success: true; postId: string } | { success: false; error: string }

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

export async function getCalendarPosts(userId: string, startDate?: Date, endDate?: Date) {
  try {
    if (!userId) {
      return {
        success: false,
        error: 'Пользователь не определен',
      }
    }

    const posts = await prisma.post.findMany({
      where: {
        userId,
        status: {
          in: ['DRAFT', 'SCHEDULED'],
        },
        ...(startDate && endDate
          ? {
              OR: [
                {
                  scheduledAt: {
                    gte: startDate,
                    lte: endDate,
                  },
                },
                { status: 'DRAFT' },
              ],
            }
          : {}),
        deletedAt: null,
      },
      orderBy: {
        updatedAt: 'desc',
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
  } catch (err: unknown) {
    console.error('Get calendar posts error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Ошибка при загрузке постов',
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

export async function saveAsDraft(
  generationId: string,
  userId: string,
  platform: string,
  title?: string
): Promise<SaveAsDraftResult> {
  try {
    const parsed = SaveGenerationAsDraftSchema.safeParse({
      generationId,
      userId,
      platform,
      title,
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

    if (!generation.output) {
      return {
        success: false,
        error: 'В генерации отсутствует JSON-результат для сохранения',
      }
    }

    const parsedOutput = GenerationOutputSchema.safeParse(JSON.parse(generation.output) as unknown)
    if (!parsedOutput.success) {
      return {
        success: false,
        error: 'Формат результата генерации некорректный',
      }
    }

    const safeOutput = parsedOutput.data
    const contentText =
      `${safeOutput.hook}\n\n${safeOutput.body}\n\n${safeOutput.hashtags.join(' ')}\n\n${safeOutput.cta}`.trim()
    const resolvedTitle = parsed.data.title ?? (safeOutput.hook.slice(0, 120) || 'Без заголовка')

    const post = await prisma.post.create({
      data: {
        userId: generation.userId,
        brandId: generation.brandId ?? null,
        generationId: generation.id,
        platform: postPlatform,
        content: contentText,
        mediaUrls: [],
        status: 'DRAFT',
        scheduledAt: null,
        metadata: {
          source: 'generation',
          title: resolvedTitle,
          hashtags: safeOutput.hashtags,
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
    if (error instanceof SyntaxError) {
      return {
        success: false,
        error: 'Не удалось разобрать результат генерации. Ожидается JSON',
      }
    }

    console.error('saveGenerationAsDraft error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка при сохранении черновика',
    }
  }
}

export async function saveGenerationAsDraft(
  generationId: string,
  userId: string,
  platform: string,
  title?: string
): Promise<SaveAsDraftResult> {
  return saveAsDraft(generationId, userId, platform, title)
}

export async function schedulePost(
  postId: string,
  scheduledAt: string,
  userId: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const parsed = SchedulePostSchema.safeParse({ postId, scheduledAt, userId })
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Некорректные входные параметры',
      }
    }

    const post = await prisma.post.findFirst({
      where: {
        id: parsed.data.postId,
        userId: parsed.data.userId,
        deletedAt: null,
      },
      select: {
        id: true,
        status: true,
      },
    })

    if (!post) {
      return { success: false, error: 'Пост не найден или недоступен' }
    }

    if (post.status === 'PUBLISHED') {
      return { success: false, error: 'Опубликованный пост нельзя перепланировать' }
    }

    await prisma.post.update({
      where: { id: post.id },
      data: {
        scheduledAt: new Date(parsed.data.scheduledAt),
        status: 'SCHEDULED',
        updatedAt: new Date(),
      },
    })

    revalidatePath('/dashboard/calendar')

    return { success: true }
  } catch (error: unknown) {
    console.error('schedulePost error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка при планировании поста',
    }
  }
}
