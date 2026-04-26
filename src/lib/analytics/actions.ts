'use server'

import { prisma } from '@/lib/db'

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
