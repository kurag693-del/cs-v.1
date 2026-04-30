'use server'

import { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { routeModel, type GenerationTask, type RouteDecision } from '@/lib/ai/router'
import type { GenerationResult } from '@/lib/ai/types'
import { getAIProvider } from '@/lib/ai/providers/registry'
import type { AIProviderId } from '@/lib/ai/providers/types'
import { prisma } from '@/lib/db'
import { buildPrompt, parseGenerationFromText, type PromptBuildInput } from '@/lib/generate/prompt-utils'
import { moderator } from '@/lib/ai/moderation'
import { calculateCost, trackTokenUsage } from '@/lib/ai/utils'
import { generatedJsonSchema, normalizeGeneratedContent, validateGeneratedContent } from '@/lib/validation/generation-output'
import { validateSession } from '@/lib/auth/lucia'
import { createCorrelationId, logAiCost } from '@/lib/observability/cost-log'
import { buildAbVariants } from '@/lib/ai/workflows/ab-variants'
import { generateAutoHashtags } from '@/lib/ai/workflows/hashtags'
import { recycleContentForPlatforms, type RecycleTarget } from '@/lib/ai/workflows/recycle'

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
  enableAbTest: z.boolean().default(false),
  variantsCount: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
  autoHashtags: z.boolean().default(true),
  enableRecycle: z.boolean().default(false),
  recycleTargets: z.array(z.enum(['Instagram', 'Telegram', 'VK', 'TikTok', 'Dzen'])).default([]),
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
      enableAbTest?: boolean
      variantsCount?: 1 | 2 | 3
      autoHashtags?: boolean
      enableRecycle?: boolean
      recycleTargets?: Array<'Instagram' | 'Telegram' | 'VK' | 'TikTok' | 'Dzen'>
      type?: string
      metadata?: Record<string, unknown>
    }

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
      enableAbTest: payload.get('enableAbTest')?.toString() === 'true',
      variantsCount: Number(payload.get('variantsCount') ?? 2),
      autoHashtags: payload.get('autoHashtags')?.toString() !== 'false',
      enableRecycle: payload.get('enableRecycle')?.toString() === 'true',
      recycleTargets: (() => {
        const targets = payload.getAll('recycleTargets').map((value) => String(value))
        if (targets.length > 0) return targets
        const raw = payload.get('recycleTargets')
        if (typeof raw !== 'string' || raw.length === 0) return []
        try {
          const parsed = JSON.parse(raw) as unknown
          return Array.isArray(parsed) ? parsed : []
        } catch {
          return []
        }
      })(),
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
    enableAbTest: payload.enableAbTest ?? false,
    variantsCount: payload.variantsCount ?? 2,
    autoHashtags: payload.autoHashtags ?? true,
    enableRecycle: payload.enableRecycle ?? false,
    recycleTargets: payload.recycleTargets ?? [],
    platformLabel: payload.platform ?? 'Instagram',
    metadata: payload.metadata,
  }
}

function extractJsonObject(raw: string): string | null {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end < 0 || end <= start) return null
  return raw.slice(start, end + 1)
}

function extractBrandMetadataArray(metadata: Prisma.JsonValue | null | undefined, key: string): string[] {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return []
  const value = (metadata as Record<string, unknown>)[key]
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

export async function generateText(payload: GenerateTextPayload): Promise<GenerationResult> {
  try {
    const correlationId = createCorrelationId('gen')
    const { user } = await validateSession()
    const userId = user?.id ?? null
    if (!userId) {
      return { success: false, error: 'Пользователь не авторизован', code: 'AUTH_ERROR' }
    }

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
      enableAbTest: normalizedInput.enableAbTest,
      variantsCount: normalizedInput.variantsCount,
      autoHashtags: normalizedInput.autoHashtags,
      enableRecycle: normalizedInput.enableRecycle,
      recycleTargets: normalizedInput.recycleTargets,
      metadata: normalizedInput.metadata,
    })

    if (!validated.success) {
      return {
        success: false,
        error: validated.error.issues[0]?.message ?? 'Validation error',
        code: 'VALIDATION_ERROR',
      }
    }

    const {
      type,
      prompt,
      platform,
      provider,
      brandId,
      profileId,
      maxLength,
      contentType,
      toneOverride,
      includeEmojis,
      enableAbTest,
      variantsCount,
      autoHashtags,
      enableRecycle,
      recycleTargets,
      metadata,
    } = validated.data

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
      ...(brand?.website ? { brandWebsite: brand.website } : {}),
      ...(brand?.industry ? { brandIndustry: brand.industry } : {}),
      ...(extractBrandMetadataArray(brand?.metadata as Prisma.JsonValue | null | undefined, 'examples').length
        ? { brandExamples: extractBrandMetadataArray(brand?.metadata as Prisma.JsonValue | null | undefined, 'examples') }
        : {}),
      ...(extractBrandMetadataArray(brand?.metadata as Prisma.JsonValue | null | undefined, 'forbiddenWords').length
        ? { forbiddenWords: extractBrandMetadataArray(brand?.metadata as Prisma.JsonValue | null | undefined, 'forbiddenWords') }
        : {}),
      ...(extractBrandMetadataArray(brand?.metadata as Prisma.JsonValue | null | undefined, 'vocabularyRules').length
        ? { preferredWords: extractBrandMetadataArray(brand?.metadata as Prisma.JsonValue | null | undefined, 'vocabularyRules') }
        : {}),
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
    let generated = parseGenerationFromText(providerResult.content)
    if (jsonPayload) {
      try {
        const parsedGeneration = generatedJsonSchema.safeParse(JSON.parse(jsonPayload) as unknown)
        if (parsedGeneration.success) {
          generated = parsedGeneration.data
        }
      } catch {
        // keep fallback parsed output
      }
    }

    const normalizedGenerated = normalizeGeneratedContent(generated)
    const minLength = Math.max(300, Math.floor(maxLength * 0.6))
    const generatedValidation = validateGeneratedContent(normalizedGenerated, minLength)
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

    const generatedContent = `${normalizedGenerated.hook}\n\n${normalizedGenerated.body}\n\n${normalizedGenerated.hashtags.join(' ')}\n\n${normalizedGenerated.cta}`.trim()
    const variants = enableAbTest ? buildAbVariants(generatedContent, variantsCount) : buildAbVariants(generatedContent, 1)
    const hashtags = autoHashtags ? generateAutoHashtags(generatedContent, normalizedInput.platformLabel ?? platform ?? 'instagram') : []
    const recycledPosts = enableRecycle ? recycleContentForPlatforms(generatedContent, recycleTargets as RecycleTarget[]) : []
    const generationOutputJson = JSON.stringify({
      hook: normalizedGenerated.hook,
      body: normalizedGenerated.body,
      hashtags: normalizedGenerated.hashtags,
      cta: normalizedGenerated.cta,
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
    logAiCost({
      userId,
      generationId: generation.id,
      provider: providerResult.provider,
      model: providerResult.model,
      totalTokens: estimatedTokens,
      costUsd: estimatedCost,
      correlationId,
      metadata: {
        task: type,
        platform: platform ?? 'UNKNOWN',
      },
    })

    revalidatePath('/dashboard/generate')

    return {
      success: true,
      data: {
        generationId: generation.id,
        content: generatedContent,
        variants,
        hashtags,
        recycledPosts,
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

