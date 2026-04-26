import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import type { SubscriptionTier } from '@prisma/client'

// Credit costs per action (in credits)
export const CREDIT_COSTS = {
  TEXT_GENERATION: 1,
  IMAGE_GENERATION: 3,
  BRAND_ANALYSIS: 2,
  CONTENT_OPTIMIZATION: 2,
} as const

// Tier configurations
export const TIER_CONFIGS: Record<SubscriptionTier, { monthlyCredits: number; priceUSD: number; features: string[] }> = {
  FREE: {
    monthlyCredits: 100,
    priceUSD: 0,
    features: ['100 генераций/мес', 'Базовые модели', '1 бренд', 'Email поддержка'],
  },
  PRO: {
    monthlyCredits: 1000,
    priceUSD: 19,
    features: ['1000 генераций/мес', 'Продвинутые модели', '5 брендов', 'Приоритетная поддержка'],
  },
  ENTERPRISE: {
    monthlyCredits: 10000,
    priceUSD: 99,
    features: ['10000 генераций/мес', 'Все модели', 'Неограничено брендов', 'VIP поддержка'],
  },
}

export async function checkCredits(userId: string): Promise<{
  available: number
  tier: SubscriptionTier
  monthlyLimit: number
  used: number
  resetDate: Date | null
}> {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    })

    if (!subscription) {
      return {
        available: 100, // Default free tier
        tier: 'FREE',
        monthlyLimit: 100,
        used: 0,
        resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      }
    }

    const used = await prisma.generation.count({
      where: {
        userId,
        status: 'COMPLETED',
        createdAt: {
          gte: new Date(subscription.startsAt || subscription.createdAt),
        },
      },
    })

    const available = Math.max(0, subscription.generationLimit - used)

    return {
      available,
      tier: subscription.tier,
      monthlyLimit: subscription.generationLimit,
      used,
      resetDate: subscription.endsAt || null,
    }
  } catch (err: any) {
    console.error('Check credits error:', err)
    return {
      available: 0,
      tier: 'FREE',
      monthlyLimit: 0,
      used: 0,
      resetDate: null,
    }
  }
}

export async function addCredits(userId: string, amount: number, source: 'purchase' | 'admin' | 'refund'): Promise<boolean> {
  try {
    await prisma.$transaction(async (tx) => {
      const subscription = await tx.subscription.findUnique({
        where: { userId },
      })

      if (!subscription) {
        await tx.subscription.create({
          data: {
            userId,
            tier: 'FREE',
            status: 'ACTIVE',
            generationLimit: amount,
          },
        })
      } else {
        await tx.subscription.update({
          where: { userId },
          data: {
            generationLimit: { increment: amount },
          },
        })
      }

      await tx.generation.create({
        data: {
          userId,
          type: 'credit_adjustment',
          prompt: `Credit top-up (${source})`,
          output: `Added ${amount} credits`,
          status: 'COMPLETED',
          model: 'system',
          tokens: 0,
          metadata: { source, amount, operation: 'credit' },
        },
      })
    })

    revalidatePath('/dashboard')
    return true
  } catch (err: any) {
    console.error('Add credits error:', err)
    return false
  }
}

export async function getSubscriptionStatus(userId: string): Promise<{
  tier: SubscriptionTier
  status: 'ACTIVE' | 'CANCELED' | 'EXPIRED' | 'TRIALING'
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
}> {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    })

    if (!subscription) {
      return {
        tier: 'FREE',
        status: 'EXPIRED',
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
      }
    }

    return {
      tier: subscription.tier,
      status: subscription.status,
      currentPeriodStart: subscription.startsAt || null,
      currentPeriodEnd: subscription.endsAt || null,
      cancelAtPeriodEnd: Boolean(subscription.canceledAt),
      stripeCustomerId: subscription.stripeCustomerId,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
    }
  } catch (err: any) {
    console.error('Get subscription status error:', err)
    return {
      tier: 'FREE',
      status: 'EXPIRED',
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    }
  }
}

export async function consumeCredits(userId: string, amount: number, type: string): Promise<{ success: boolean; remaining: number }> {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    })

    if (!subscription) {
      return { success: false, remaining: 0 }
    }

    const used = await prisma.generation.count({
      where: {
        userId,
        status: 'COMPLETED',
        createdAt: {
          gte: new Date(subscription.startsAt || subscription.createdAt),
        },
      },
    })

    if (used + amount > subscription.generationLimit) {
      return { success: false, remaining: subscription.generationLimit - used }
    }

    await prisma.generation.create({
      data: {
        userId,
        type: 'credit_consumption',
        prompt: `Credit usage for ${type}`,
        output: `Consumed ${amount} credits`,
        status: 'COMPLETED',
        model: 'system',
        tokens: 0,
        metadata: { type, amount, operation: 'debit' },
      },
    })

    const remaining = subscription.generationLimit - used - amount

    return { success: true, remaining }
  } catch (err: any) {
    console.error('Consume credits error:', err)
    return { success: false, remaining: 0 }
  }
}
