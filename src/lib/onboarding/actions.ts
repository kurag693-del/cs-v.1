'use server'

import { prisma } from '@/lib/db'
import { validateSession } from '@/lib/auth/lucia'

export type OnboardingProgress = {
  steps: Array<{
    id: 'brand' | 'integration' | 'generation'
    title: string
    description: string
    done: boolean
    href: string
  }>
  completedSteps: number
  totalSteps: number
  isCompleted: boolean
}

export async function getOnboardingProgress(userIdParam?: string): Promise<{ success: true; data: OnboardingProgress } | { success: false; error: string }> {
  const { user } = await validateSession()
  const userId = userIdParam ?? user?.id ?? null

  if (!userId) {
    return { success: false, error: 'Пользователь не авторизован' }
  }

  const [brandsCount, credentialsCount, generationsCount] = await Promise.all([
    prisma.brand.count({ where: { userId, deletedAt: null } }),
    prisma.platformCredential.count({ where: { userId, deletedAt: null, isActive: true } }),
    prisma.generation.count({ where: { userId, deletedAt: null, status: 'COMPLETED' } }),
  ])

  const steps: OnboardingProgress['steps'] = [
    {
      id: 'brand',
      title: 'Создайте бренд',
      description: 'Заполните тон, голос и правила словаря, чтобы генерация учитывала стиль.',
      done: brandsCount > 0,
      href: '/dashboard/brands',
    },
    {
      id: 'integration',
      title: 'Подключите платформу',
      description: 'Привяжите Telegram/VK/Dzen, чтобы отправлять посты в реальные каналы.',
      done: credentialsCount > 0,
      href: '/dashboard/integrations',
    },
    {
      id: 'generation',
      title: 'Сделайте первую генерацию',
      description: 'Создайте текст и сохраните черновик для календаря публикаций.',
      done: generationsCount > 0,
      href: '/dashboard/generate',
    },
  ]

  const completedSteps = steps.filter((step) => step.done).length

  return {
    success: true,
    data: {
      steps,
      completedSteps,
      totalSteps: steps.length,
      isCompleted: completedSteps === steps.length,
    },
  }
}
