'use server'

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { routeModel, type GenerationTask, type RouteDecision } from '@/lib/ai/router'
import type { GenerationResult } from '@/lib/ai/types'
import { getAIProvider } from '@/lib/ai/providers/registry'
import type { AIProviderId } from '@/lib/ai/providers/types'
import { prisma } from '@/lib/db'
import { moderator } from '@/lib/ai/moderation'
import { calculateCost, trackTokenUsage } from '@/lib/ai/utils'
import { generatedJsonSchema, validateGeneratedContent } from '@/lib/validation/generation-output'

const GenerateInputSchema = z.object({
  type: z.enum(['social_post', 'blog_outline', 'ad_copy', 'image_prompt', 'feedback_optimizer', 'brand_voice']),
  prompt: z.string().min(5, 'Prompt must be at least 5 characters').max(5000, 'Prompt must not exceed 5000 characters'),
  platform: z.enum(['TWITTER', 'LINKEDIN', 'FACEBOOK', 'INSTAGRAM', 'TELEGRAM', 'VK', 'TIKTOK', 'YOUTUBE']).optional(),
  provider: z.enum(['gigachat', 'yandexgpt', 'vkai']).default('gigachat'),
  brandId: z.string().optional(),
  profileId: z.string().optional(),
  maxLength: z.number().int().min(80).max(5000).default(800),
  contentType: z.enum(['post', 'story', 'tips', 'announcement']).default('post'),
  toneOverride: z.enum(['brand', 'humor', 'formal']).default('brand'),
  includeEmojis: z.boolean().default(true),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

type GenerateTextPayload =
  | FormData
  | {
      topic?: string
      prompt?: string
      platform?: string
      provider?: AIProviderId
      brandId?: string
      profileId?: string
      maxLength?: number
      contentType?: 'post' | 'story' | 'tips' | 'announcement'
      toneOverride?: 'brand' | 'humor' | 'formal'
      includeEmojis?: boolean
      type?: string
      metadata?: Record<string, unknown>
    }

export type PromptBuildInput = {
  topic: string
  platform: string
  maxLength: number
  contentType: 'post' | 'story' | 'tips' | 'announcement'
  toneOverride: 'brand' | 'humor' | 'formal'
  includeEmojis: boolean
}

const TEXT_PROMPT_TEMPLATE = (() => {
  try {
    return readFileSync(path.join(process.cwd(), 'prompts', 'v1_text_generator.md'), 'utf-8')
  } catch {
    return ''
  }
})()

function normalizeGenerateInput(payload: GenerateTextPayload) {
  if (payload instanceof FormData) {
    const metadataRaw = payload.get('metadata')
    return {
      type: payload.get('type') ?? 'social_post',
      prompt: payload.get('prompt') ?? payload.get('topic'),
      platform: payload.get('platform'),
      provider: payload.get('provider') ?? 'gigachat',
      brandId: payload.get('brandId'),
      profileId: payload.get('profileId'),
      maxLength: Number(payload.get('maxLength') ?? 800),
      contentType: (payload.get('contentType')?.toString() as PromptBuildInput['contentType'] | undefined) ?? 'post',
      toneOverride: (payload.get('toneOverride')?.toString() as PromptBuildInput['toneOverride'] | undefined) ?? 'brand',
      includeEmojis: payload.get('includeEmojis')?.toString() !== 'false',
      platformLabel: payload.get('platform')?.toString() ?? 'Instagram',
      metadata: typeof metadataRaw === 'string' && metadataRaw.length > 0 ? (JSON.parse(metadataRaw) as Record<string, unknown>) : undefined,
    }
  }

  const normalizedPlatform =
    payload.platform === 'Instagram'
      ? 'INSTAGRAM'
      : payload.platform === 'TikTok'
        ? 'TIKTOK'
        : payload.platform === 'VK'
          ? 'VK'
          : payload.platform === 'Telegram'
            ? 'TELEGRAM'
            : payload.platform

  return {
    type: payload.type ?? 'social_post',
    prompt: payload.prompt ?? payload.topic,
    platform: normalizedPlatform,
    provider: payload.provider ?? 'gigachat',
    brandId: payload.brandId,
    profileId: payload.profileId,
    maxLength: payload.maxLength ?? 800,
    contentType: payload.contentType ?? 'post',
    toneOverride: payload.toneOverride ?? 'brand',
    includeEmojis: payload.includeEmojis ?? true,
    platformLabel: payload.platform ?? 'Instagram',
    metadata: payload.metadata,
  }
}

export function extractJsonObject(raw: string): string | null {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end < 0 || end <= start) return null
  return raw.slice(start, end + 1)
}

type ParsedGenerated = { hook: string; body: string; hashtags: string[]; cta: string }

export function parseGenerationFromText(raw: string): ParsedGenerated {
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const allHashtags = Array.from(
    new Set(
      raw
        .match(/#[\p{L}\p{N}_]+/gu)
        ?.map((tag) => tag.trim())
        .filter(Boolean) ?? []
    )
  )

  const textWithoutHashtags = raw
    .replace(/#[\p{L}\p{N}_]+/gu, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const hook = textWithoutHashtags[0] ?? lines[0] ?? ''
  const ctaCandidate = textWithoutHashtags[textWithoutHashtags.length - 1] ?? ''
  const inferredCta =
    ctaCandidate !== hook && /!|\?|подпиш|нажм|коммент|переход|попробуйте|узнайте/i.test(ctaCandidate)
      ? ctaCandidate
      : 'Напишите в комментариях ваше мнение.'

  const bodyLines = textWithoutHashtags.slice(1, ctaCandidate === inferredCta ? -1 : undefined)
  const body = bodyLines.join('\n').trim()

  return {
    hook,
    body,
    hashtags: allHashtags,
    cta: inferredCta,
  }
}

export function buildPrompt(input: PromptBuildInput, brandVoice: Record<string, unknown> | null): string {
  let prompt = TEXT_PROMPT_TEMPLATE
  const toneMap: Record<PromptBuildInput['toneOverride'], string> = {
    brand: 'по голосу бренда',
    humor: 'юмористичный (🎭), но без кринжа и штампов',
    formal: 'формальный и деловой (💼), без фамильярности',
  }
  const contentTypeMap: Record<PromptBuildInput['contentType'], string> = {
    post: 'классический пост',
    story: 'сторителлинг-пост',
    tips: 'пост-советы (список и практические пункты)',
    announcement: 'анонс/объявление',
  }

  const replacements: Record<string, string> = {
    topic: input.topic,
    platform: input.platform,
    brand_voice_json: JSON.stringify(brandVoice ?? {}, null, 2),
    max_length_chars: input.maxLength.toString(),
    min_length_chars: Math.max(300, Math.floor(input.maxLength * 0.6)).toString(),
    include_hashtags: 'true',
    cta_type: 'оставь комментарий',
    avoid_phrases: '["в современном мире", "уникальный контент", "инновационный подход", "цифровая эпоха"]',
    content_type: contentTypeMap[input.contentType],
    tone_override: toneMap[input.toneOverride],
    include_emojis: input.includeEmojis ? 'true' : 'false',
  }

  prompt = prompt.replace(/\{\{([a-z0-9_]+)\}\}/gi, (match, variableName: string) => {
    const replacement = replacements[variableName]
    if (replacement === undefined) {
      throw new Error(`Неизвестная переменная промпта: ${match}`)
    }
    return replacement
  })

  return `## Critical Runtime Directives
- Строго используй тип контента: ${contentTypeMap[input.contentType]}.
- Строго используй тон: ${toneMap[input.toneOverride]}.
- Эмодзи: ${input.includeEmojis ? 'можно умеренно' : 'запрещены полностью'}.

${prompt}

## Runtime Overrides
- Тип контента: ${contentTypeMap[input.contentType]}
- Тон: ${toneMap[input.toneOverride]}
- Эмодзи: ${input.includeEmojis ? 'разрешены, но умеренно' : 'не использовать'}
`
}

export async function generateText(payload: GenerateTextPayload, userId: string): Promise<GenerationResult> {
  try {
    const normalizedInput = normalizeGenerateInput(payload)
    const validated = GenerateInputSchema.safeParse({
      type: normalizedInput.type,
      prompt: normalizedInput.prompt,
      platform: normalizedInput.platform,
      provider: normalizedInput.provider,
      brandId: normalizedInput.brandId,
      profileId: normalizedInput.profileId,
      maxLength: normalizedInput.maxLength,
      contentType: normalizedInput.contentType,
      toneOverride: normalizedInput.toneOverride,
      includeEmojis: normalizedInput.includeEmojis,
      metadata: normalizedInput.metadata,
    })

    if (!validated.success) {
      return {
        success: false,
        error: validated.error.issues[0]?.message ?? 'Validation error',
        code: 'VALIDATION_ERROR',
      }
    }

    const { type, prompt, platform, provider, brandId, profileId, maxLength, contentType, toneOverride, includeEmojis, metadata } = validated.data

    const localUser = await prisma.user.findFirst({ where: { id: userId, deletedAt: null }, select: { id: true } })
    if (!localUser) {
      return { success: false, error: 'Пользователь не найден', code: 'AUTH_ERROR' }
    }

    const dbProfile = await prisma.profile.findUnique({ where: { userId }, include: { user: true } })
    const subscription = await prisma.subscription.findUnique({ where: { userId } })
    if (!subscription) {
      await prisma.subscription.create({
        data: { userId, tier: 'FREE', status: 'ACTIVE', generationLimit: 100, postLimit: 50 },
      })
    }

    const credits = subscription?.generationLimit ?? 100
    const usedGenerations = await prisma.generation.count({ where: { userId, status: 'COMPLETED' } })
    if (credits - usedGenerations <= 0) {
      return { success: false, error: 'Insufficient credits. Please upgrade your plan.', code: 'INSUFFICIENT_CREDITS' }
    }

    const moderationResult = await moderator.moderateContent(prompt)
    if (!moderationResult.isApproved) {
      await prisma.generation.create({
        data: {
          userId,
          profileId,
          type,
          prompt,
          status: 'FAILED',
          error: `Blocked by moderation: ${moderationResult.reason}`,
          metadata: ({ moderation: moderationResult, provider, ...metadata } as unknown) as Prisma.InputJsonValue,
          model: 'moderation_block',
          tokens: 0,
        },
      })

      return { success: false, error: `Content blocked: ${moderationResult.reason}`, code: 'CONTENT_BLOCKED' }
    }

    const route: RouteDecision = routeModel(type as GenerationTask, subscription?.tier ?? 'FREE')
    const aiProvider = getAIProvider(provider)

    let brand = null
    if (brandId) {
      brand = await prisma.brand.findUnique({ where: { id: brandId, userId, deletedAt: null } })
    }

    const brandVoiceData: Record<string, unknown> = {
      ...(dbProfile?.brandVoice ? { profileBrandVoice: dbProfile.brandVoice } : {}),
      ...(brand?.name ? { brandName: brand.name } : {}),
      ...(brand?.voice ? { brandVoice: brand.voice } : {}),
      ...(brand?.tone ? { brandTone: brand.tone } : {}),
      ...(brand?.colors?.length ? { brandColors: brand.colors } : {}),
      ...(brand?.description ? { brandDescription: brand.description } : {}),
    }

    const enhancedPrompt = buildPrompt(
      {
        topic: prompt,
        platform: normalizedInput.platformLabel ?? platform ?? 'Instagram',
        maxLength,
        contentType,
        toneOverride,
        includeEmojis,
      },
      brandVoiceData
    )

    const estimatedTokens = aiProvider.estimateTokens({ prompt: enhancedPrompt, maxTokens: route.maxTokens })
    const estimatedCost = calculateCost(estimatedTokens, route.model)

    const generation = await prisma.generation.create({
      data: {
        userId,
        profileId: profileId || dbProfile?.id || null,
        brandId: brandId || null,
        type,
        prompt: enhancedPrompt,
        status: 'PROCESSING',
        model: route.model,
        tokens: 0,
        metadata: ({
          moderation: moderationResult,
          route,
          platform,
          provider,
          estimatedCost,
          ...metadata,
        } as unknown) as Prisma.InputJsonValue,
      },
    })

    const providerResult = await aiProvider.generate({
      prompt: enhancedPrompt,
      temperature: route.temperature,
      maxTokens: route.maxTokens,
    })

    const jsonPayload = extractJsonObject(providerResult.content)
    let generated: ParsedGenerated
    if (jsonPayload) {
      try {
        const parsedGeneration = generatedJsonSchema.safeParse(JSON.parse(jsonPayload) as unknown)
        generated = parsedGeneration.success ? parsedGeneration.data : parseGenerationFromText(providerResult.content)
      } catch {
        generated = parseGenerationFromText(providerResult.content)
      }
    } else {
      generated = parseGenerationFromText(providerResult.content)
    }

    const minLength = Math.max(300, Math.floor(maxLength * 0.6))
    const generatedValidation = validateGeneratedContent(generated, minLength)
    if (!generatedValidation.valid) {
      await prisma.generation.update({
        where: { id: generation.id },
        data: {
          status: 'FAILED',
          error: generatedValidation.message,
          metadata: {
            ...(typeof generation.metadata === 'object' && generation.metadata ? generation.metadata : {}),
            failedAt: new Date(),
            validationError: generatedValidation.message,
            provider,
          } as Prisma.InputJsonValue,
        },
      })
      return { success: false, error: generatedValidation.message, code: 'VALIDATION_ERROR' }
    }

    const generatedContent = `${generated.hook}\n\n${generated.body}\n\n${generated.hashtags.join(' ')}\n\n${generated.cta}`.trim()
    const generationOutputJson = JSON.stringify({
      hook: generated.hook,
      body: generated.body,
      hashtags: generated.hashtags,
      cta: generated.cta,
    })

    await prisma.generation.update({
      where: { id: generation.id },
      data: {
        status: 'COMPLETED',
        output: generationOutputJson,
        tokens: estimatedTokens,
        metadata: {
          ...(typeof generation.metadata === 'object' && generation.metadata ? generation.metadata : {}),
          completedAt: new Date(),
          actualCost: estimatedCost,
          modelUsed: providerResult.model,
          provider: providerResult.provider,
        } as Prisma.InputJsonValue,
      },
    })

    trackTokenUsage(
      {
        promptTokens: Math.ceil(enhancedPrompt.length / 4),
        completionTokens: Math.max(estimatedTokens - Math.ceil(enhancedPrompt.length / 4), 0),
        totalTokens: estimatedTokens,
      },
      estimatedCost
    )

    revalidatePath('/dashboard/generate')

    return {
      success: true,
      data: {
        generationId: generation.id,
        content: generatedContent,
        model: providerResult.model,
        provider: providerResult.provider,
        tokens: {
          promptTokens: Math.ceil(enhancedPrompt.length / 4),
          completionTokens: Math.max(estimatedTokens - Math.ceil(enhancedPrompt.length / 4), 0),
          totalTokens: estimatedTokens,
          estimatedCostUSD: estimatedCost,
        },
        costUSD: estimatedCost,
      },
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Generation failed'
    console.error('Generation error:', err)
    return {
      success: false,
      error: message,
      code: 'INTERNAL_ERROR',
    }
  }
}

