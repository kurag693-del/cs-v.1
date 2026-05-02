'use server'

import { prisma } from '@/lib/db'
import {
  postEngagementSnapshotSchema,
  type ChannelMetricRow,
} from '@/lib/analytics/engagement-types'
import { Platform } from '@prisma/client'
import { validateSession } from '@/lib/auth/lucia'
import { buildRecommendations } from '@/lib/analytics/recommendations'
import { getBestPublishingTime, getPlatformPerformance } from '@/lib/analytics/metrics'

export async function getAnalyticsSummary(userIdParam?: string) {
  const { user } = await validateSession()
  const userId = userIdParam ?? user?.id
  if (!userId) {
    return { success: false as const, error: 'Unauthorized' }
  }

  const posts = await prisma.post.findMany({
    where: {
      userId,
      deletedAt: null,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 500,
  })

  const published = posts.filter((post) => post.status === 'PUBLISHED')
  const byPlatform = published.reduce<Record<string, number>>((acc, post) => {
    acc[post.platform] = (acc[post.platform] ?? 0) + 1
    return acc
  }, {})

  const byHour = published.reduce<Record<string, number>>((acc, post) => {
    if (!post.publishedAt) return acc
    const hour = new Date(post.publishedAt).getHours()
    const key = `${hour.toString().padStart(2, '0')}:00`
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
  const platformPerformance = getPlatformPerformance(
    posts.map((post) => ({
      platform: post.platform,
      status: post.status,
      publishedAt: post.publishedAt,
    }))
  )
  const bestPublishingTime = getBestPublishingTime(
    posts.map((post) => ({
      platform: post.platform,
      status: post.status,
      publishedAt: post.publishedAt,
    }))
  )

  const recommendations = buildRecommendations({
    byHour: { ...byHour, [bestPublishingTime]: (byHour[bestPublishingTime] ?? 0) + 0 },
    byPlatform,
    totalPublished: published.length,
  })

  return {
    success: true,
    data: {
      totals: {
        posts: posts.length,
        published: published.length,
        drafts: posts.filter((post) => post.status === 'DRAFT').length,
      },
      byPlatform,
      byHour,
      platformPerformance,
      bestPublishingTime,
      recommendations,
    },
  }
}

export async function getDashboardStats(userIdParam?: string): Promise<
  | { success: true; data: { postsCount: number; creditsUsed: number; topPlatform: string | null } }
  | { success: false; error: { message: string } }
> {
  try {
    const summary = await getAnalyticsSummary(userIdParam)
    if (!summary.success) {
      return { success: false, error: { message: summary.error ?? 'Не удалось загрузить аналитику' } }
    }

    return {
      success: true,
      data: {
        postsCount: summary.data.totals.posts,
        creditsUsed: summary.data.totals.published,
        topPlatform: summary.data.recommendations.bestPlatform ?? null,
      },
    }
  } catch (error: unknown) {
    return {
      success: false,
      error: { message: error instanceof Error ? error.message : 'Не удалось загрузить аналитику' },
    }
  }
}

type DashboardData = {
  stats: {
    totalGenerations: number
    creditsLeft: number
    postsScheduled: number
  }
  upcomingPosts: Array<{
    id: string
    platform: string
    content: string
    scheduledAt: Date | null
    status: string
  }>
  recentActivity: Array<{
    id: string
    type: string
    status: string
    createdAt: Date
    model: string
  }>
  connectedAccounts: Array<{
    platform: Platform
    isConnected: boolean
    note?: string
  }>
}

export async function getDashboardData(userIdParam?: string): Promise<
  | { success: true; data: DashboardData }
  | { success: false; error: { message: string } }
> {
  const { user } = await validateSession()
  const userId = userIdParam ?? user?.id
  if (!userId) {
    return {
      success: false,
      error: { message: 'User is required' },
    }
  }

  try {
    const [
      totalGenerations,
      postsScheduled,
      upcomingPosts,
      recentActivity,
      subscription,
      completedGenerations,
      credentials,
    ] = await prisma.$transaction([
      prisma.generation.count({
        where: { userId, deletedAt: null },
      }),
      prisma.post.count({
        where: { userId, status: 'SCHEDULED', deletedAt: null },
      }),
      prisma.post.findMany({
        where: { userId, status: 'SCHEDULED', deletedAt: null },
        orderBy: { scheduledAt: 'asc' },
        take: 3,
        select: {
          id: true,
          platform: true,
          content: true,
          scheduledAt: true,
          status: true,
        },
      }),
      prisma.generation.findMany({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: {
          id: true,
          type: true,
          status: true,
          createdAt: true,
          model: true,
        },
      }),
      prisma.subscription.findUnique({
        where: { userId },
        select: {
          generationLimit: true,
        },
      }),
      prisma.generation.count({
        where: { userId, status: 'COMPLETED', deletedAt: null },
      }),
      prisma.platformCredential.findMany({
        where: { userId, deletedAt: null, isActive: true },
        select: {
          platform: true,
        },
      }),
    ])

    const generationLimit = subscription?.generationLimit ?? 100
    const creditsLeft = Math.max(generationLimit - completedGenerations, 0)
    const connectedPlatformSet = new Set(credentials.map((credential) => credential.platform))
    const allPlatforms: Platform[] = ['TELEGRAM', 'VK', 'DZEN', 'TWITTER', 'LINKEDIN', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'YOUTUBE']

    const connectedAccounts = allPlatforms.map((platform) => ({
      platform,
      isConnected: connectedPlatformSet.has(platform),
      note: connectedPlatformSet.has(platform) ? undefined : 'TODO: API интеграция',
    }))

    return {
      success: true,
      data: {
        stats: {
          totalGenerations,
          creditsLeft,
          postsScheduled,
        },
        upcomingPosts,
        recentActivity,
        connectedAccounts,
      },
    }
  } catch (error: unknown) {
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Не удалось загрузить данные дашборда',
      },
    }
  }
}

export async function getDashboardRecommendations(userIdParam?: string): Promise<
  | { success: true; data: { bestHour: string; bestPlatform: string; suggestions: string[] } }
  | { success: false; error: { message: string } }
> {
  try {
    const summary = await getAnalyticsSummary(userIdParam)
    if (!summary.success) {
      return { success: false, error: { message: summary.error ?? 'Не удалось рассчитать рекомендации' } }
    }
    return {
      success: true,
      data: summary.data.recommendations,
    }
  } catch (error: unknown) {
    return {
      success: false,
      error: { message: error instanceof Error ? error.message : 'Не удалось рассчитать рекомендации' },
    }
  }
}

/** Опубликованные посты с последним снимком метрик канала (фаза 11). */
export async function listPublishedPostsChannelMetrics(userId: string): Promise<ChannelMetricRow[]> {
  const posts = await prisma.post.findMany({
    where: { userId, status: 'PUBLISHED', deletedAt: null },
    orderBy: { publishedAt: 'desc' },
    take: 40,
    select: {
      id: true,
      platform: true,
      publishedAt: true,
      content: true,
      metadata: true,
    },
  })

  return posts.map((p) => {
    const meta =
      p.metadata && typeof p.metadata === 'object' && !Array.isArray(p.metadata)
        ? (p.metadata as Record<string, unknown>)
        : {}
    const engRaw = meta.engagement
    const parsed = postEngagementSnapshotSchema.safeParse(engRaw)
    return {
      postId: p.id,
      platform: p.platform,
      publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
      excerpt: p.content.trim().slice(0, 120) + (p.content.length > 120 ? '…' : ''),
      engagement: parsed.success ? parsed.data : null,
    }
  })
}
