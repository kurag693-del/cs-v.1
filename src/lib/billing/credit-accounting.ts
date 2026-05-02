import { prisma } from '@/lib/db'

/** Не учитываются в лимите «кредитов» подписки. */
export const NON_BILLABLE_GENERATION_TYPES = ['credit_adjustment', 'credit_consumption'] as const

const DEFAULT_CREDIT_WEIGHT = 1

function creditWeightFromMetadata(metadata: unknown): number {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return DEFAULT_CREDIT_WEIGHT
  const raw = (metadata as Record<string, unknown>).creditCost
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw)
    if (Number.isFinite(n) && n > 0) return n
  }
  return DEFAULT_CREDIT_WEIGHT
}

/**
 * Суммарно списанные кредиты за период (текст = 1, картинка = 3 и т.д. через `metadata.creditCost`).
 */
export async function sumBillableCredits(userId: string, periodStart: Date): Promise<number> {
  const rows = await prisma.generation.findMany({
    where: {
      userId,
      status: 'COMPLETED',
      deletedAt: null,
      createdAt: { gte: periodStart },
      type: { notIn: [...NON_BILLABLE_GENERATION_TYPES] },
    },
    select: { metadata: true },
  })
  let sum = 0
  for (const r of rows) {
    sum += creditWeightFromMetadata(r.metadata)
  }
  return sum
}

export async function getCreditsRemaining(
  userId: string
): Promise<{ remaining: number; limit: number; tier: 'FREE' | 'PRO' | 'ENTERPRISE' }> {
  const sub = await prisma.subscription.findUnique({ where: { userId } })
  if (!sub) {
    return { remaining: 100, limit: 100, tier: 'FREE' }
  }
  const used = await sumBillableCredits(userId, new Date(sub.startsAt ?? sub.createdAt))
  const limit = sub.generationLimit
  return {
    remaining: Math.max(0, limit - used),
    limit,
    tier: sub.tier,
  }
}
