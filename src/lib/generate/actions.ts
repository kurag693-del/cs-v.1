'use server'

import { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { routeModel, type GenerationTask, type RouteDecision } from '@/lib/ai/router'
import type { GenerationResult } from '@/lib/ai/types'
import { getConfiguredAIProviderIds, resolveEffectiveDefaultProvider } from '@/lib/ai/providers/availability'
import { getAIProvider } from '@/lib/ai/providers/registry'
import {
  hasOpenRouterTextCatalog,
  isOpenRouterTextModelAllowed,
  pickOpenRouterTextModel,
} from '@/lib/ai/model-catalog'
import type { AIProviderId } from '@/lib/ai/providers/types'
import { prisma } from '@/lib/db'
import { bodyMinCharsFromMaxPostLength } from '@/lib/generate/content-length-policy'
import { buildPrompt, parseGenerationFromText, type PromptBuildInput } from '@/lib/generate/prompt-utils'
import { moderator } from '@/lib/ai/moderation'
import { calculateCost, trackTokenUsage } from '@/lib/ai/utils'
import { validateSession } from '@/lib/auth/lucia'
import { aiProviderIdSchema } from '@/lib/validation/ai-provider'
import { generatedJsonSchema, normalizeGeneratedContent, validateGeneratedContent } from '@/lib/validation/generation-output'
import { createCorrelationId, logAiCost } from '@/lib/observability/cost-log'
import { AB_VARIANT_LABELS, buildAbVariants } from '@/lib/ai/workflows/ab-variants'
import { generateAutoHashtags } from '@/lib/ai/workflows/hashtags'
import { recycleContentForPlatforms, type RecycleTarget } from '@/lib/ai/workflows/recycle'
import { getBuiltinTemplateById } from '@/lib/templates/builtin-templates'
import { CREDIT_COSTS } from '@/lib/billing/actions'
import { sumBillableCredits } from '@/lib/billing/credit-accounting'

const GenerateInputSchema = z.object({
  type: z.enum(['social_post', 'blog_outline', 'ad_copy', 'image_prompt', 'feedback_optimizer', 'brand_voice']),
  prompt: z.string().min(5, 'Prompt must be at least 5 characters').max(5000, 'Prompt must not exceed 5000 characters'),
  platform: z.enum(['TWITTER', 'LINKEDIN', 'FACEBOOK', 'INSTAGRAM', 'TELEGRAM', 'VK', 'TIKTOK', 'YOUTUBE']).optional(),
  provider: aiProviderIdSchema.default(() => resolveEffectiveDefaultProvider()),
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
  templateId: z.string().min(1).max(80).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  textModel: z.string().min(1).max(200).optional(),
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
      templateId?: string
      type?: string
      metadata?: Record<string, unknown>
      textModel?: string
    }

function coerceVariantsCount(value: unknown): 1 | 2 | 3 {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : Number(value)
  if (n === 1 || n === 2 || n === 3) return n
  return 2
}

function normalizeGenerateInput(payload: GenerateTextPayload) {
  if (payload instanceof FormData) {
    const metadataRaw = payload.get('metadata')
    return {
      type: payload.get('type') ?? 'social_post',
      prompt: payload.get('prompt') ?? payload.get('topic'),
      platform: payload.get('platform'),
      provider: payload.get('provider') ?? resolveEffectiveDefaultProvider(),
      brandId: payload.get('brandId'),
      profileId: payload.get('profileId'),
      maxLength: Number(payload.get('maxLength') ?? 800),
      contentType: (payload.get('contentType')?.toString() as PromptBuildInput['contentType'] | undefined) ?? 'post',
      toneOverride: (payload.get('toneOverride')?.toString() as PromptBuildInput['toneOverride'] | undefined) ?? 'brand',
      includeEmojis: payload.get('includeEmojis')?.toString() !== 'false',
      enableAbTest: payload.get('enableAbTest')?.toString() === 'true',
      variantsCount: coerceVariantsCount(payload.get('variantsCount') ?? 2),
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
      templateId: (() => {
        const raw = payload.get('templateId')
        return typeof raw === 'string' && raw.length > 0 ? raw : undefined
      })(),
      metadata: typeof metadataRaw === 'string' && metadataRaw.length > 0 ? (JSON.parse(metadataRaw) as Record<string, unknown>) : undefined,
      textModel: (() => {
        const raw = payload.get('textModel')
        return typeof raw === 'string' && raw.length > 0 ? raw : undefined
      })(),
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
    provider: payload.provider ?? resolveEffectiveDefaultProvider(),
    brandId: payload.brandId,
    profileId: payload.profileId,
    maxLength: payload.maxLength ?? 800,
    contentType: payload.contentType ?? 'post',
    toneOverride: payload.toneOverride ?? 'brand',
    includeEmojis: payload.includeEmojis ?? true,
    enableAbTest: payload.enableAbTest ?? false,
    variantsCount: coerceVariantsCount(payload.variantsCount ?? 2),
    autoHashtags: payload.autoHashtags ?? true,
    enableRecycle: payload.enableRecycle ?? false,
    recycleTargets: payload.recycleTargets ?? [],
    platformLabel: payload.platform ?? 'Instagram',
    templateId: payload.templateId,
    metadata: payload.metadata,
    textModel: payload.textModel,
  }
}

function extractJsonObject(raw: string): string | null {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end < 0 || end <= start) return null
  return raw.slice(start, end + 1)
}

type NormalizedGeneration = ReturnType<typeof normalizeGeneratedContent>

function formatNormalizedContent(n: NormalizedGeneration): string {
  return `${n.hook}\n\n${n.body}\n\n${n.hashtags.join(' ')}\n\n${n.cta}`.trim()
}

function parseProviderRawToNormalized(
  raw: string,
  minLength: number
): { ok: true; data: NormalizedGeneration } | { ok: false; message: string } {
  const jsonPayload = extractJsonObject(raw)
  let generated = parseGenerationFromText(raw)
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
  const generatedValidation = validateGeneratedContent(normalizedGenerated, minLength)
  if (!generatedValidation.valid) {
    return { ok: false, message: generatedValidation.message }
  }
  return { ok: true, data: normalizedGenerated }
}

function parseAllVariantsFromProviderRaw(
  raw: string,
  variantsCount: 1 | 2 | 3,
  minLength: number
):
  | { ok: true; runs: NormalizedGeneration[]; mode: 'multi_json' | 'single_json' | 'single_plus_local' }
  | { ok: false; message: string } {
  if (variantsCount === 1) {
    const one = parseProviderRawToNormalized(raw, minLength)
    return one.ok ? { ok: true, runs: [one.data], mode: 'single_json' } : one
  }

  const jsonPayload = extractJsonObject(raw)
  if (jsonPayload) {
    try {
      const obj = JSON.parse(jsonPayload) as Record<string, unknown>
      if (Array.isArray(obj.variants) && obj.variants.length > 0) {
        const slice = obj.variants.slice(0, variantsCount)
        if (slice.length === variantsCount) {
          const runs: NormalizedGeneration[] = []
          for (let i = 0; i < variantsCount; i++) {
            const parsed = generatedJsonSchema.safeParse(slice[i])
            if (!parsed.success) {
              return {
                ok: false,
                message: `Вариант ${String.fromCharCode(65 + i)}: ожидались поля hook, body и др. в JSON`,
              }
            }
            const norm = normalizeGeneratedContent(parsed.data)
            const val = validateGeneratedContent(norm, minLength)
            if (!val.valid) {
              return { ok: false, message: `Вариант ${String.fromCharCode(65 + i)}: ${val.message}` }
            }
            runs.push(norm)
          }
          return { ok: true, runs, mode: 'multi_json' }
        }
      }
    } catch {
      // пробуем одиночный JSON или локальные варианты
    }
  }

  const single = parseProviderRawToNormalized(raw, minLength)
  if (!single.ok) {
    return single
  }

  const formatted = formatNormalizedContent(single.data)
  const ab = buildAbVariants(formatted, variantsCount)
  const runs: NormalizedGeneration[] = []
  for (let i = 0; i < ab.length; i++) {
    const loose = parseGenerationFromText(ab[i].content)
    const norm = normalizeGeneratedContent(loose)
    const minL = i === 0 ? minLength : Math.min(minLength, 260)
    const val = validateGeneratedContent(norm, minL)
    runs.push(val.valid ? norm : single.data)
  }
  return { ok: true, runs, mode: 'single_plus_local' }
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
      templateId: normalizedInput.templateId,
      metadata: normalizedInput.metadata,
      textModel: normalizedInput.textModel,
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
      templateId,
      metadata,
      textModel,
    } = validated.data

    const configuredProviders = getConfiguredAIProviderIds()
    if (configuredProviders.length === 0) {
      return {
        success: false,
        error: 'Ни один ИИ-провайдер не настроен. Добавьте ключи в .env.local (см. .env.local.example).',
        code: 'NO_AI_PROVIDER',
      }
    }
    if (!configuredProviders.includes(provider)) {
      return {
        success: false,
        error: 'Этот провайдер не подключён (проверьте переменные окружения).',
        code: 'VALIDATION_ERROR',
      }
    }

    const localUser = await prisma.user.findFirst({ where: { id: userId, deletedAt: null }, select: { id: true } })
    if (!localUser) {
      return { success: false, error: 'Пользователь не найден', code: 'AUTH_ERROR' }
    }

    const dbProfile = await prisma.profile.findUnique({ where: { userId }, include: { user: true } })
    let subscription = await prisma.subscription.findUnique({ where: { userId } })
    if (!subscription) {
      await prisma.subscription.create({
        data: { userId, tier: 'FREE', status: 'ACTIVE', generationLimit: 100, postLimit: 50 },
      })
      subscription = await prisma.subscription.findUnique({ where: { userId } })
    }

    const periodStart = new Date(subscription!.startsAt ?? subscription!.createdAt)
    const usedCredits = await sumBillableCredits(userId, periodStart)
    const creditLimit = subscription!.generationLimit
    if (creditLimit - usedCredits < CREDIT_COSTS.TEXT_GENERATION) {
      return { success: false, error: 'Insufficient credits. Please upgrade your plan.', code: 'INSUFFICIENT_CREDITS' }
    }

    const templateMeta = templateId ? getBuiltinTemplateById(templateId) : null
    if (templateId && !templateMeta) {
      return { success: false, error: 'Неизвестный шаблон ниши', code: 'VALIDATION_ERROR' }
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

    const tier = subscription?.tier ?? 'FREE'
    const route: RouteDecision = routeModel(type as GenerationTask, tier)
    const aiProvider = getAIProvider(provider)

    let textModelForRun: string
    if (provider === 'openrouter') {
      const want = textModel?.trim()
      if (want && hasOpenRouterTextCatalog() && !isOpenRouterTextModelAllowed(want, tier)) {
        return {
          success: false,
          error: 'Выбранная текстовая модель недоступна на вашем тарифе.',
          code: 'VALIDATION_ERROR',
        }
      }
      textModelForRun = pickOpenRouterTextModel(tier, route.model, want)
    } else {
      textModelForRun = route.model
    }

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
      ...(templateMeta
        ? {
            templateId: templateMeta.id,
            templateName: templateMeta.name,
            templateIndustry: templateMeta.industry,
          }
        : {}),
      ...(templateMeta?.nicheToneGuidance
        ? { nicheToneGuidance: templateMeta.nicheToneGuidance }
        : {}),
      ...(templateMeta?.suggestedHashtags?.length
        ? { templateSuggestedHashtags: templateMeta.suggestedHashtags }
        : {}),
      ...(templateMeta?.suggestedCta ? { templateSuggestedCta: templateMeta.suggestedCta } : {}),
      ...(templateMeta?.contentPillars?.length ? { contentPillars: templateMeta.contentPillars } : {}),
    }

    const enhancedPrompt = buildPrompt(
      {
        topic: prompt,
        platform: normalizedInput.platformLabel ?? platform ?? 'Instagram',
        maxLength,
        contentType,
        toneOverride,
        includeEmojis,
        variantsCount,
      },
      brandVoiceData,
      type as GenerationTask
    )

    const maxOutTokens =
      variantsCount > 1
        ? Math.min(Math.floor(route.maxTokens * (variantsCount === 2 ? 2 : 2.5)), 12000)
        : route.maxTokens

    const estimatedTokens = aiProvider.estimateTokens({ prompt: enhancedPrompt, maxTokens: maxOutTokens })
    const estimatedCost = calculateCost(estimatedTokens, textModelForRun)
    const minLength = bodyMinCharsFromMaxPostLength(maxLength)

    const generation = await prisma.generation.create({
      data: {
        userId,
        profileId: profileId || dbProfile?.id || null,
        brandId: brandId || null,
        type,
        prompt: enhancedPrompt,
        status: 'PROCESSING',
        model: textModelForRun,
        tokens: 0,
        metadata: ({
          moderation: moderationResult,
          route,
          platform,
          provider,
          estimatedCost,
          plannedVariants: variantsCount,
          creditCost: CREDIT_COSTS.TEXT_GENERATION,
          ...(templateId ? { templateId } : {}),
          ...metadata,
        } as unknown) as Prisma.InputJsonValue,
      },
    })

    type ProviderGen = Awaited<ReturnType<typeof aiProvider.generate>>
    let lastProviderResult: ProviderGen | null = null

    const firstRaw = await aiProvider.generate({
      prompt: enhancedPrompt,
      temperature: route.temperature,
      maxTokens: maxOutTokens,
      ...(provider === 'openrouter' ? { model: textModelForRun } : {}),
    })
    lastProviderResult = firstRaw

    const parsedRuns = parseAllVariantsFromProviderRaw(firstRaw.content, variantsCount, minLength)
    if (!parsedRuns.ok) {
      await prisma.generation.update({
        where: { id: generation.id },
        data: {
          status: 'FAILED',
          error: parsedRuns.message,
          metadata: {
            ...(typeof generation.metadata === 'object' && generation.metadata ? generation.metadata : {}),
            failedAt: new Date(),
            validationError: parsedRuns.message,
            provider,
          } as Prisma.InputJsonValue,
        },
      })
      return { success: false, error: parsedRuns.message, code: 'VALIDATION_ERROR' }
    }

    const normalizedRuns = parsedRuns.runs
    const variantParseMode = parsedRuns.mode

    const ids = (['A', 'B', 'C'] as const).slice(0, variantsCount)
    const primary = normalizedRuns[0]!
    const generatedContent = formatNormalizedContent(primary)

    const variants = normalizedRuns.map((norm, idx) => ({
      id: ids[idx]!,
      label: AB_VARIANT_LABELS[ids[idx]!],
      content: formatNormalizedContent(norm),
    }))

    const hashtags = autoHashtags
      ? generateAutoHashtags(generatedContent, normalizedInput.platformLabel ?? platform ?? 'instagram')
      : []
    const recycledPosts = enableRecycle ? recycleContentForPlatforms(generatedContent, recycleTargets as RecycleTarget[]) : []

    const generationOutputJson = JSON.stringify({
      hook: primary.hook,
      body: primary.body,
      hashtags: primary.hashtags,
      cta: primary.cta,
      variants: normalizedRuns.map((norm, idx) => ({
        id: ids[idx]!,
        hook: norm.hook,
        body: norm.body,
        hashtags: norm.hashtags,
        cta: norm.cta,
      })),
    })

    const reported = lastProviderResult.usage
    const sumPromptTokenEst = Math.ceil(enhancedPrompt.length / 4)
    const totalTokensUsed = reported?.totalTokens ?? estimatedTokens
    const promptTokensUsed = reported?.promptTokens ?? sumPromptTokenEst
    const completionTokensUsed =
      reported?.completionTokens ?? Math.max(totalTokensUsed - promptTokensUsed, 0)
    const actualCostUsd = calculateCost(totalTokensUsed, textModelForRun)

    await prisma.generation.update({
      where: { id: generation.id },
      data: {
        status: 'COMPLETED',
        output: generationOutputJson,
        tokens: totalTokensUsed,
        metadata: {
          ...(typeof generation.metadata === 'object' && generation.metadata ? generation.metadata : {}),
          completedAt: new Date(),
          estimatedCost,
          actualCost: actualCostUsd,
          tokenUsageReported: Boolean(reported),
          modelUsed: lastProviderResult?.model,
          provider: lastProviderResult?.provider,
          aiCalls: 1,
          variantParseMode,
        } as Prisma.InputJsonValue,
      },
    })

    const resolvedModelLabel = lastProviderResult?.model ?? textModelForRun
    const resolvedProvider = lastProviderResult?.provider ?? provider

    trackTokenUsage(
      {
        promptTokens: promptTokensUsed,
        completionTokens: completionTokensUsed,
        totalTokens: totalTokensUsed,
      },
      actualCostUsd,
      resolvedModelLabel
    )
    logAiCost({
      userId,
      generationId: generation.id,
      provider: resolvedProvider,
      model: resolvedModelLabel,
      totalTokens: totalTokensUsed,
      costUsd: actualCostUsd,
      correlationId,
      metadata: {
        task: type,
        platform: platform ?? 'UNKNOWN',
        aiCalls: 1,
        variantParseMode,
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
        model: resolvedModelLabel,
        provider: resolvedProvider,
        tokens: {
          promptTokens: promptTokensUsed,
          completionTokens: completionTokensUsed,
          totalTokens: totalTokensUsed,
          estimatedCostUSD: actualCostUsd,
        },
        costUSD: actualCostUsd,
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

