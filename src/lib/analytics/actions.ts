'use server'

import { prisma } from '@/lib/db'
import { Platform } from '@prisma/client'

export async function getAnalyticsSummary(userId: string) {
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

  const bestHour =
    Object.entries(byHour).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    '09:00'

  const bestPlatform =
    Object.entries(byPlatform).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    'TWITTER'

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
      recommendations: {
        bestHour,
        bestPlatform,
        note: 'Recommendation is based on historical published volume for MVP baseline.',
      },
    },
  }
}

export async function getDashboardStats(userId: string): Promise<
  | { success: true; data: { postsCount: number; creditsUsed: number; topPlatform: string | null } }
  | { success: false; error: { message: string } }
> {
  try {
    const summary = await getAnalyticsSummary(userId)
    if (!summary.success) {
      return { success: false, error: { message: 'Не удалось загрузить аналитику' } }
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

export async function getDashboardData(userId: string): Promise<
  | { success: true; data: DashboardData }
  | { success: false; error: { message: string } }
> {
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
