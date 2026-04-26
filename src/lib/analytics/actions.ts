"use server";

import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/db/prisma";

const DashboardStatsSchema = z.object({
  postsCount: z.number().int().min(0),
  creditsUsed: z.number().int().min(0),
  topPlatform: z.string().nullable(),
});

export type DashboardStats = z.infer<typeof DashboardStatsSchema>;

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

  const now = new Date();
  const last7Days = new Date(now);
  last7Days.setDate(last7Days.getDate() - 7);

  const last30Days = new Date(now);
  last30Days.setDate(last30Days.getDate() - 30);

  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const defaultGenerationLimit = 100;

  try {
    const [postsCount, subscriptions, platformGroups] = await Promise.all([
      prisma.post.count({
        where: {
          userId,
          deletedAt: null,
          status: {
            in: ["SCHEDULED", "DRAFT"],
          },
          updatedAt: {
            gte: last7Days,
          },
        },
      }),
      prisma.subscription.findMany({
        where: {
          userId,
          updatedAt: {
            gte: currentMonthStart,
          },
        },
        select: {
          generationLimit: true,
        },
      }),
      prisma.post.groupBy({
        by: ["platform"],
        where: {
          userId,
          deletedAt: null,
          createdAt: {
            gte: last30Days,
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
        take: 1,
      }),
    ]);

    const creditsUsed = subscriptions.reduce((sum, item) => {
      const spent = Math.max(0, defaultGenerationLimit - item.generationLimit);
      return sum + spent;
    }, 0);

    const rawStats: DashboardStats = {
      postsCount,
      creditsUsed,
      topPlatform: platformGroups[0]?.platform ?? null,
    };
    const parsedStats = DashboardStatsSchema.parse(rawStats);

    return {
      success: true,
      data: parsedStats,
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
