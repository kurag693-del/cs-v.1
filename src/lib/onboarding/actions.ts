'use server'

import { prisma } from '@/lib/db'
import { validateSession } from '@/lib/auth/lucia'

export type OnboardingStepId = 'brand' | 'generation' | 'integration' | 'schedule'

export type OnboardingProgress = {
  steps: Array<{
    id: OnboardingStepId
    title: string
    description: string
    done: boolean
    href: string
  }>
  completedSteps: number
  totalSteps: number
  isCompleted: boolean
}

export async function getOnboardingProgress(
  userIdParam?: string
): Promise<{ success: true; data: OnboardingProgress } | { success: false; error: string }> {
  const { user } = await validateSession()
  const userId = userIdParam ?? user?.id ?? null

  if (!userId) {
    return { success: false, error: 'Пользователь не авторизован' }
  }

  const [brandsCount, credentialsCount, generationsCount, scheduledOrPublishedCount] = await Promise.all([
    prisma.brand.count({ where: { userId, deletedAt: null } }),
    prisma.platformCredential.count({ where: { userId, deletedAt: null, isActive: true } }),
    prisma.generation.count({ where: { userId, deletedAt: null, status: 'COMPLETED' } }),
    prisma.post.count({
      where: {
        userId,
        deletedAt: null,
        OR: [
          { status: 'SCHEDULED' },
          { status: 'PUBLISHED' },
          { scheduledAt: { not: null } },
        ],
      },
    }),
  ])

  const steps: OnboardingProgress['steps'] = [
    {
      id: 'brand',
      title: 'Создайте бренд в пространстве',
      description:
        'Бренд задаёт голос и правила для генерации. Он привязан к вашему рабочему пространству — коллеги увидят его по ролям из раздела «Команда».',
      done: brandsCount > 0,
      href: '/dashboard/brands',
    },
    {
      id: 'generation',
      title: 'Сделайте первую генерацию',
      description:
        'В генераторе выберите шаблон ниши из библиотеки (кофейня, IT, красота…) или напишите тему с нуля. Сохраните черновик в календарь.',
      done: generationsCount > 0,
      href: '/dashboard/generate',
    },
    {
      id: 'integration',
      title: 'Подключите канал публикации',
      description:
        'Привяжите Telegram, VK или Дзен, чтобы публиковать из приложения. Без интеграции можно работать с черновиками и календарём локально.',
      done: credentialsCount > 0,
      href: '/dashboard/integrations',
    },
    {
      id: 'schedule',
      title: 'Запланируйте или опубликуйте пост',
      description:
        'Поставьте слот в календаре или доведите пост до статуса «Опубликовано», чтобы замкнуть цикл от идеи до выхода в канал.',
      done: scheduledOrPublishedCount > 0,
      href: '/dashboard/calendar',
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
