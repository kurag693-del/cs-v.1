"use server";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export interface DashboardBestPlatform {
  platform: string;
  count: number;
}

export interface DashboardStats {
  postsLast7Days: number;
  creditsSpent: number;
  bestPlatforms: DashboardBestPlatform[];
}

export type DashboardStatsResult =
  | {
      success: true;
      data: DashboardStats;
    }
  | {
      success: false;
      error: {
        code: string;
        message: string;
      };
    };

export async function getDashboardStats(userId: string): Promise<DashboardStatsResult> {
  if (!userId) {
    return {
      success: false,
      error: {
        code: "INVALID_USER_ID",
        message: "Пользователь не определен",
      },
    };
  }

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - 7);

  try {
    const [postsLast7Days, generationsAggregate, groupedPlatforms] = await Promise.all([
      prisma.post.count({
        where: {
          userId,
          deletedAt: null,
          createdAt: {
            gte: sinceDate,
          },
        },
      }),
      prisma.generation.aggregate({
        where: {
          userId,
          deletedAt: null,
          createdAt: {
            gte: sinceDate,
          },
        },
        _sum: {
          tokens: true,
        },
      }),
      prisma.post.groupBy({
        by: ["platform"],
        where: {
          userId,
          deletedAt: null,
          createdAt: {
            gte: sinceDate,
          },
        },
        _count: {
          _all: true,
        },
        orderBy: {
          _count: {
            platform: "desc",
          },
        },
        take: 3,
      }),
    ]);

    return {
      success: true,
      data: {
        postsLast7Days,
        creditsSpent: generationsAggregate._sum.tokens ?? 0,
        bestPlatforms: groupedPlatforms.map((item) => ({
          platform: item.platform,
          count: item._count._all,
        })),
      },
    };
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: "База данных временно недоступна. Попробуйте снова.",
        },
      };
    }

    return {
      success: false,
      error: {
        code: "DB_UNAVAILABLE",
        message: "База данных временно недоступна. Попробуйте снова.",
      },
    };
  }
}
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
