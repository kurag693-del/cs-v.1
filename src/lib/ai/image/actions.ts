'use server'

import { z } from 'zod'
import type { SubscriptionTier } from '@prisma/client'
import {
  hasOpenRouterImageCatalog,
  hasOpenRouterTextCatalog,
  isOpenRouterImageModelAllowed,
  isOpenRouterTextModelAllowed,
  pickOpenRouterImageModel,
  pickOpenRouterTextModel,
} from '@/lib/ai/model-catalog'
import { generateRasterImage } from '@/lib/ai/image/image-gen/router'
import { CREDIT_COSTS } from '@/lib/billing/actions'
import { sumBillableCredits } from '@/lib/billing/credit-accounting'
import { getConfiguredAIProviderIds, resolveEffectiveDefaultProvider } from '@/lib/ai/providers/availability'
import { routeModel } from '@/lib/ai/router'
import { getAIProvider } from '@/lib/ai/providers/registry'
import { resolveOpenRouterTextModel } from '@/lib/ai/providers/openrouter-config'
import type { AIProviderId } from '@/lib/ai/providers/types'
import { validateSession } from '@/lib/auth/lucia'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { generateRasterImageInputSchema } from '@/lib/validation/image-gen'
import { aiProviderIdSchema } from '@/lib/validation/ai-provider'

const GenerateCoverPromptSchema = z.object({
  topic: z.string().min(3, 'Тема обложки слишком короткая'),
  platform: z.enum(['INSTAGRAM', 'TELEGRAM', 'VK', 'TIKTOK']).default('INSTAGRAM'),
  brandContext: z.record(z.string(), z.unknown()).optional(),
  provider: aiProviderIdSchema.default(() => resolveEffectiveDefaultProvider()),
  textModel: z.string().min(1).max(200).optional(),
})

type GenerateCoverPromptResult =
  | { success: true; data: { imagePrompt: string; provider: AIProviderId; model: string } }
  | { success: false; error: { code: 'VALIDATION_ERROR' | 'PROVIDER_ERROR'; message: string } }

export async function generatePostRasterImage(input: unknown): Promise<
  | { success: true; data: { imageUrl: string; backend: string; providerLabel: string } }
  | {
      success: false
      error: {
        code: 'VALIDATION_ERROR' | 'IMAGE_GEN_ERROR' | 'AUTH_ERROR' | 'INSUFFICIENT_CREDITS'
        message: string
      }
    }
> {
  const validated = generateRasterImageInputSchema.safeParse(input)
  if (!validated.success) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: validated.error.issues[0]?.message ?? 'Некорректные параметры',
      },
    }
  }

  const { user } = await validateSession()
  const userId = user?.id ?? null
  if (!userId) {
    return {
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Войдите в аккаунт, чтобы генерировать изображения и списывать кредиты.',
      },
    }
  }

  let subscription = await prisma.subscription.findUnique({ where: { userId } })
  if (!subscription) {
    await prisma.subscription.create({
      data: { userId, tier: 'FREE', status: 'ACTIVE', generationLimit: 100, postLimit: 50 },
    })
    subscription = await prisma.subscription.findUnique({ where: { userId } })
  }

  const tier = subscription!.tier
  const periodStart = new Date(subscription!.startsAt ?? subscription!.createdAt)
  const usedCredits = await sumBillableCredits(userId, periodStart)
  if (subscription!.generationLimit - usedCredits < CREDIT_COSTS.IMAGE_GENERATION) {
    return {
      success: false,
      error: {
        code: 'INSUFFICIENT_CREDITS',
        message: 'Недостаточно кредитов для генерации изображения.',
      },
    }
  }

  const backend = process.env.IMAGE_GEN_BACKEND?.trim().toLowerCase()
  let resolvedImageModel: string | undefined
  if (backend === 'openrouter') {
    const want = validated.data.imageModel?.trim()
    if (want && hasOpenRouterImageCatalog() && !isOpenRouterImageModelAllowed(want, tier)) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Выбранная модель изображения недоступна на вашем тарифе.',
        },
      }
    }
    resolvedImageModel = pickOpenRouterImageModel(tier, want)
  }

  try {
    const out = await generateRasterImage({
      prompt: validated.data.prompt,
      width: validated.data.width,
      height: validated.data.height,
      imageModel: resolvedImageModel,
    })

    const outputStored =
      out.imageUrl.length > 4000 ? `${out.imageUrl.slice(0, 120)}… (${out.imageUrl.length} chars)` : out.imageUrl

    await prisma.generation.create({
      data: {
        userId,
        type: 'image_raster',
        prompt: validated.data.prompt.slice(0, 4000),
        output: outputStored,
        status: 'COMPLETED',
        model: out.providerLabel.slice(0, 120),
        tokens: 0,
        metadata: {
          creditCost: CREDIT_COSTS.IMAGE_GENERATION,
          backend: out.backend,
          providerLabel: out.providerLabel,
        } satisfies Record<string, unknown> as Prisma.InputJsonValue,
      },
    })

    return {
      success: true,
      data: {
        imageUrl: out.imageUrl,
        backend: out.backend,
        providerLabel: out.providerLabel,
      },
    }
  } catch (e: unknown) {
    return {
      success: false,
      error: {
        code: 'IMAGE_GEN_ERROR',
        message: e instanceof Error ? e.message : 'Не удалось сгенерировать изображение',
      },
    }
  }
}

export async function generateCoverPrompt(input: unknown): Promise<GenerateCoverPromptResult> {
  const validated = GenerateCoverPromptSchema.safeParse(input)
  if (!validated.success) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: validated.error.issues[0]?.message ?? 'Некорректные входные параметры',
      },
    }
  }

  const { user } = await validateSession()
  const userId = user?.id ?? null
  let tier: SubscriptionTier = 'FREE'
  if (userId) {
    const sub = await prisma.subscription.findUnique({ where: { userId }, select: { tier: true } })
    tier = sub?.tier ?? 'FREE'
  }

  const configured = getConfiguredAIProviderIds()
  if (configured.length === 0) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Ни один ИИ-провайдер не настроен. Добавьте ключи в .env.local.',
      },
    }
  }
  if (!configured.includes(validated.data.provider)) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Выбранный провайдер не подключён.',
      },
    }
  }

  const provider = getAIProvider(validated.data.provider)
  const route = routeModel('image_prompt', tier)
  const wantModel = validated.data.textModel?.trim()
  if (
    validated.data.provider === 'openrouter' &&
    wantModel &&
    hasOpenRouterTextCatalog() &&
    !isOpenRouterTextModelAllowed(wantModel, tier)
  ) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Выбранная текстовая модель недоступна на вашем тарифе.',
      },
    }
  }

  const openRouterModel =
    validated.data.provider === 'openrouter'
      ? pickOpenRouterTextModel(tier, route.model, wantModel)
      : undefined

  const prompt = [
    'Сформируй краткий image-prompt для генерации обложки к посту.',
    `Тема: ${validated.data.topic}`,
    `Платформа: ${validated.data.platform}`,
    `Контекст бренда (JSON): ${JSON.stringify(validated.data.brandContext ?? {})}`,
    'Верни только одну строку image-prompt без пояснений.',
  ].join('\n')

  try {
    const result = await provider.generate({
      prompt,
      temperature: 0.6,
      maxTokens: 240,
      ...(validated.data.provider === 'openrouter'
        ? { model: openRouterModel ?? resolveOpenRouterTextModel(route.model) }
        : {}),
    })

    return {
      success: true,
      data: {
        imagePrompt: result.content.trim(),
        provider: result.provider,
        model: result.model,
      },
    }
  } catch (error: unknown) {
    return {
      success: false,
      error: {
        code: 'PROVIDER_ERROR',
        message: error instanceof Error ? error.message : 'Не удалось сгенерировать image-prompt',
      },
    }
  }
}
