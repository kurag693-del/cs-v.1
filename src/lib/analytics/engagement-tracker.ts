import { Platform, Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'
import { postEngagementSnapshotSchema, type PostEngagementSnapshot } from '@/lib/analytics/engagement-types'
import { getActiveCredentialForPublishing } from '@/lib/platform-credentials/actions'

type PublishMeta = {
  provider?: string
  externalId?: string
  publishedAt?: string
}

function getPublishBlock(metadata: unknown): PublishMeta | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const m = metadata as Record<string, unknown>
  const publish = m.publish
  if (!publish || typeof publish !== 'object' || Array.isArray(publish)) return null
  const p = publish as Record<string, unknown>
  const provider = typeof p.provider === 'string' ? p.provider : undefined
  const externalId = typeof p.externalId === 'string' ? p.externalId : undefined
  const publishedAt = typeof p.publishedAt === 'string' ? p.publishedAt : undefined
  if (!provider || !externalId) return null
  return { provider, externalId, publishedAt }
}

/** VK: externalId часто `ownerId_postId`. Экспорт для тестов. */
export function parseVkCompositePostId(externalId: string): { ownerId: string; postId: string } | null {
  const trimmed = externalId.trim()
  const combined = trimmed.match(/^(-?\d+)_(\d+)$/)
  if (combined) {
    return { ownerId: combined[1]!, postId: combined[2]! }
  }
  return null
}

async function fetchVkEngagement(accessToken: string, externalId: string): Promise<PostEngagementSnapshot> {
  const parsed = parseVkCompositePostId(externalId)
  if (!parsed) {
    return {
      source: 'unavailable',
      fetchedAt: new Date().toISOString(),
      error: 'Не удалось разобрать externalId для VK (ожидается ownerId_postId)',
    }
  }
  const postsParam = `${parsed.ownerId}_${parsed.postId}`
  const url = new URL('https://api.vk.com/method/wall.getById')
  url.searchParams.set('access_token', accessToken)
  url.searchParams.set('v', '5.199')
  url.searchParams.set('posts', postsParam)

  const res = await fetch(url.toString(), { method: 'GET', next: { revalidate: 0 } })
  const json = (await res.json()) as {
    response?: Array<{
      views?: { count?: number }
      likes?: { count?: number }
      reposts?: { count?: number }
      comments?: { count?: number }
    }>
    error?: { error_msg?: string }
  }

  const post = json.response?.[0]
  if (!post) {
    return {
      source: 'vk',
      fetchedAt: new Date().toISOString(),
      error: json.error?.error_msg ?? 'VK: пустой ответ',
    }
  }

  const views = post.views?.count
  const likes = post.likes?.count
  const reposts = post.reposts?.count
  const comments = post.comments?.count

  return {
    source: 'vk',
    fetchedAt: new Date().toISOString(),
    ...(typeof views === 'number' ? { views } : {}),
    ...(typeof likes === 'number' ? { likes } : {}),
    ...(typeof reposts === 'number' ? { reposts } : {}),
    ...(typeof comments === 'number' ? { comments } : {}),
  }
}

function telegramPlaceholder(): PostEngagementSnapshot {
  const mock = process.env.TELEGRAM_ENGAGEMENT_MOCK === 'true'
  if (mock) {
    return {
      source: 'mock',
      fetchedAt: new Date().toISOString(),
      views: 42,
      likes: 3,
      comments: 1,
    }
  }
  return {
    source: 'telegram',
    fetchedAt: new Date().toISOString(),
    error:
      'Bot API не возвращает просмотры поста в канале. Укажите TELEGRAM_ENGAGEMENT_MOCK=true для демо или используйте внешнюю аналитику.',
  }
}

export async function syncPostEngagement(postId: string, actorUserId: string): Promise<
  | { success: true; snapshot: PostEngagementSnapshot }
  | { success: false; code: 'NOT_FOUND' | 'FORBIDDEN' | 'NOT_PUBLISHED' | 'SYNC_ERROR'; message: string }
> {
  const post = await prisma.post.findFirst({
    where: { id: postId, deletedAt: null },
    select: {
      id: true,
      userId: true,
      brandId: true,
      platform: true,
      status: true,
      metadata: true,
    },
  })

  if (!post) return { success: false, code: 'NOT_FOUND', message: 'Пост не найден' }
  if (post.userId !== actorUserId) return { success: false, code: 'FORBIDDEN', message: 'Нет доступа' }
  if (post.status !== 'PUBLISHED') return { success: false, code: 'NOT_PUBLISHED', message: 'Пост ещё не опубликован' }

  const publish = getPublishBlock(post.metadata)
  if (!publish) {
    const snap: PostEngagementSnapshot = {
      source: 'unavailable',
      fetchedAt: new Date().toISOString(),
      error: 'Нет данных публикации в metadata.publish',
    }
    await mergeEngagement(post.id, post.metadata, snap)
    return { success: true, snapshot: snap }
  }

  let snapshot: PostEngagementSnapshot

  try {
    if (publish.provider === 'VK') {
      const credential = await getActiveCredentialForPublishing({
        userId: actorUserId,
        brandId: post.brandId,
        platform: Platform.VK,
      })
      if (!credential?.accessToken) {
        snapshot = {
          source: 'unavailable',
          fetchedAt: new Date().toISOString(),
          error: 'Нет активного подключения VK для бренда',
        }
      } else {
        const extId = publish.externalId
        if (!extId) {
          snapshot = {
            source: 'unavailable',
            fetchedAt: new Date().toISOString(),
            error: 'Пустой externalId публикации',
          }
        } else {
          snapshot = await fetchVkEngagement(credential.accessToken, extId)
        }
      }
    } else if (publish.provider === 'TELEGRAM') {
      snapshot = telegramPlaceholder()
    } else {
      snapshot = {
        source: 'unavailable',
        fetchedAt: new Date().toISOString(),
        error: `Провайдер ${publish.provider} пока без синхронизации метрик`,
      }
    }
  } catch (e) {
    snapshot = {
      source: 'unavailable',
      fetchedAt: new Date().toISOString(),
      error: e instanceof Error ? e.message : 'Ошибка синхронизации',
    }
  }

  await mergeEngagement(post.id, post.metadata, snapshot)
  return { success: true, snapshot }
}

async function mergeEngagement(postId: string, prevMeta: unknown, snapshot: PostEngagementSnapshot): Promise<void> {
  const parsed = postEngagementSnapshotSchema.safeParse(snapshot)
  const snap = parsed.success ? parsed.data : snapshot

  const base =
    prevMeta && typeof prevMeta === 'object' && !Array.isArray(prevMeta)
      ? { ...(prevMeta as Record<string, unknown>) }
      : {}

  const historyRaw = base.engagementHistory
  const history: PostEngagementSnapshot[] = Array.isArray(historyRaw)
    ? historyRaw
        .filter((x) => postEngagementSnapshotSchema.safeParse(x).success)
        .map((x) => postEngagementSnapshotSchema.parse(x))
        .slice(-29)
    : []

  history.push(snap)

  await prisma.post.update({
    where: { id: postId },
    data: {
      metadata: {
        ...base,
        engagement: snap,
        engagementHistory: history,
      } as Prisma.InputJsonValue,
    },
  })
}
