'use server'

import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { routeModel, type GenerationTask, type RouteDecision } from '@/lib/ai/router'
import { moderator } from '@/lib/ai/moderation'
import { trackTokenUsage, calculateCost } from '@/lib/ai/utils'
import type { GenerationResult } from '@/lib/ai/types'

const GenerateInputSchema = z.object({
  type: z.enum(['social_post', 'blog_outline', 'ad_copy', 'image_prompt', 'feedback_optimizer', 'brand_voice']),
  prompt: z.string().min(5, 'Prompt must be at least 5 characters').max(5000, 'Prompt must not exceed 5000 characters'),
  platform: z.enum(['TWITTER', 'LINKEDIN', 'FACEBOOK', 'INSTAGRAM', 'TELEGRAM', 'VK', 'TIKTOK', 'YOUTUBE']).optional(),
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
      brandId?: string
      profileId?: string
      maxLength?: number
      contentType?: 'post' | 'story' | 'tips' | 'announcement'
      toneOverride?: 'brand' | 'humor' | 'formal'
      includeEmojis?: boolean
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
      brandId: payload.get('brandId'),
      profileId: payload.get('profileId'),
      maxLength: Number(payload.get('maxLength') ?? 800),
      contentType: (payload.get('contentType')?.toString() as 'post' | 'story' | 'tips' | 'announcement' | undefined) ?? 'post',
      toneOverride: (payload.get('toneOverride')?.toString() as 'brand' | 'humor' | 'formal' | undefined) ?? 'brand',
      includeEmojis: payload.get('includeEmojis')?.toString() !== 'false',
      platformLabel: payload.get('platform')?.toString() ?? 'Instagram',
      metadata:
        typeof metadataRaw === 'string' && metadataRaw.length > 0
          ? (JSON.parse(metadataRaw) as Record<string, unknown>)
          : undefined,
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

const GIGACHAT_BASE_URL = process.env.GIGACHAT_BASE_URL ?? 'https://gigachat.devices.sberbank.ru'
const GIGACHAT_AUTH_URL = process.env.GIGACHAT_AUTH_URL ?? 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth'
const GIGACHAT_SCOPE = process.env.GIGACHAT_SCOPE ?? 'GIGACHAT_API_PERS'
const GIGACHAT_MODEL = process.env.GIGACHAT_MODEL ?? 'GigaChat'
const GIGACHAT_ALLOW_SELF_SIGNED = process.env.GIGACHAT_ALLOW_SELF_SIGNED === 'true'
const FORBIDDEN_TEMPLATE_PHRASES = [
  'в современном мире',
  'уникальный контент',
  'инновационный подход',
  'цифровая эпоха',
] as const

const TEXT_PROMPT_TEMPLATE = (() => {
  try {
    return readFileSync(path.join(process.cwd(), 'prompts', 'v1_text_generator.md'), 'utf-8')
  } catch {
    return ''
  }
})()

const GeneratedJsonSchema = z.object({
  hook: z.string().optional().default(''),
  body: z.string().min(300, 'Generated body is too short'),
  hashtags: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .transform((value) => {
      if (Array.isArray(value)) {
        return value
          .map((item) => item.trim())
          .filter(Boolean)
          .map((item) => (item.startsWith('#') ? item : `#${item}`))
      }
      if (typeof value === 'string' && value.trim().length > 0) {
        return value
          .split(/\s+/)
          .map((item) => item.trim())
          .filter(Boolean)
          .map((item) => (item.startsWith('#') ? item : `#${item}`))
      }
      return []
    }),
  cta: z.string().optional().default(''),
})

type PromptBuildInput = {
  topic: string
  platform: string
  maxLength: number
  contentType: 'post' | 'story' | 'tips' | 'announcement'
  toneOverride: 'brand' | 'humor' | 'formal'
  includeEmojis: boolean
}

function validateGeneratedContent(
  generated: { hook: string; body: string; hashtags: string[]; cta: string },
  input: PromptBuildInput
): { valid: true } | { valid: false; message: string } {
  const minLength = Math.max(300, Math.floor(input.maxLength * 0.6))
  if (generated.body.trim().length < minLength) {
    return { valid: false, message: `Слишком короткий текст: минимум ${minLength} символов в body` }
  }

  const fullText = `${generated.hook}\n${generated.body}\n${generated.cta}`.toLowerCase()
  if (FORBIDDEN_TEMPLATE_PHRASES.some((phrase) => fullText.includes(phrase))) {
    return { valid: false, message: 'Ответ содержит шаблонные фразы из запрещенного списка' }
  }

  const hook = generated.hook.trim()
  const body = generated.body.trim()
  if (!hook || !body) {
    return { valid: false, message: 'Нарушена структура: отсутствует хук или основной текст' }
  }

  return { valid: true }
}

type GigaChatTokenResponse = { access_token: string }
type GigaChatCompletionResponse = {
  model?: string
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

async function withOptionalSelfSignedTls<T>(callback: () => Promise<T>): Promise<T> {
  if (!GIGACHAT_ALLOW_SELF_SIGNED) {
    return callback()
  }

  const previous = process.env.NODE_TLS_REJECT_UNAUTHORIZED
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

  try {
    return await callback()
  } finally {
    if (previous === undefined) {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED
    } else {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = previous
    }
  }
}

function extractJsonObject(raw: string): string | null {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end < 0 || end <= start) return null
  return raw.slice(start, end + 1)
}

function parseGenerationFromText(raw: string): { hook: string; body: string; hashtags: string[]; cta: string } {
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
  const cta =
    ctaCandidate !== hook && /!|\?|подпиш|нажм|коммент|переход|попробуйте|узнайте/i.test(ctaCandidate)
      ? ctaCandidate
      : ''

  const bodyLines = textWithoutHashtags.slice(1, cta ? -1 : undefined)
  const body = bodyLines.join('\n').trim()

  return {
    hook,
    body,
    hashtags: allHashtags,
    cta,
  }
}

async function getGigaChatAccessToken(): Promise<string> {
  const clientId = process.env.GIGACHAT_CLIENT_ID ?? process.env.CLIENT_ID
  const clientSecret = process.env.GIGACHAT_CLIENT_SECRET ?? process.env.CLIENT_SECRET ?? process.env.Client_Secret
  const explicitAuthKey = process.env.GIGACHAT_AUTH_KEY
  const authKey =
    explicitAuthKey ??
    (clientId && clientSecret ? Buffer.from(`${clientId}:${clientSecret}`).toString('base64') : undefined)

  if (!authKey) {
    throw new Error(
      'Не задана авторизация GigaChat. Укажите GIGACHAT_AUTH_KEY или пару GIGACHAT_CLIENT_ID + GIGACHAT_CLIENT_SECRET'
    )
  }

  const response = await withOptionalSelfSignedTls(() =>
    fetch(GIGACHAT_AUTH_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        'User-Agent': 'CreativeStudio/1.0',
        RqUID: randomUUID(),
      },
      body: new URLSearchParams({
        scope: GIGACHAT_SCOPE,
      }),
    })
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Ошибка авторизации GigaChat: ${response.status} ${errorText}`)
  }

  const data = (await response.json()) as GigaChatTokenResponse
  if (!data.access_token) {
    throw new Error('GigaChat не вернул access_token')
  }

  return data.access_token
}

async function generateWithGigaChat(prompt: string, temperature: number, maxTokens: number): Promise<{ content: string; model: string }> {
  const accessToken = await getGigaChatAccessToken()
  const response = await withOptionalSelfSignedTls(() =>
    fetch(`${GIGACHAT_BASE_URL}/api/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'CreativeStudio/1.0',
      },
      body: JSON.stringify({
        model: GIGACHAT_MODEL,
        stream: false,
        temperature,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Ошибка запроса к GigaChat: ${response.status} ${errorText}`)
  }

  const data = (await response.json()) as GigaChatCompletionResponse
  const content = data.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('GigaChat вернул пустой ответ')
  }

  return { content, model: data.model ?? GIGACHAT_MODEL }
}

export async function generateText(
  payload: GenerateTextPayload,
  userId: string
): Promise<GenerationResult> {
  try {
    const normalizedInput = normalizeGenerateInput(payload)

    // 1. Validate input
    const validated = GenerateInputSchema.safeParse({
      type: normalizedInput.type,
      prompt: normalizedInput.prompt,
      platform: normalizedInput.platform,
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

    const { type, prompt, platform, brandId, profileId, maxLength, contentType, toneOverride, includeEmojis, metadata } =
      validated.data

    // 2. Resolve user
    const localUser = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true },
    })

    if (!localUser) {
      return {
        success: false,
        error: 'Пользователь не найден',
        code: 'AUTH_ERROR',
      }
    }

    // Get profile with credits (subscriptions table in Prisma)
    const dbProfile = await prisma.profile.findUnique({
      where: { userId },
      include: {
        user: true,
      },
    })

    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    })

    if (!subscription) {
      // Create default free subscription
      await prisma.subscription.create({
        data: {
          userId,
          tier: 'FREE',
          status: 'ACTIVE',
          generationLimit: 100,
          postLimit: 50,
        },
      })
    }

    const credits = subscription?.generationLimit || 100
    const usedGenerations = await prisma.generation.count({
      where: { userId, status: 'COMPLETED' },
    })

    const remainingCredits = credits - usedGenerations

    // 3. Check credits
    if (remainingCredits <= 0) {
      return {
        success: false,
        error: 'Insufficient credits. Please upgrade your plan.',
        code: 'INSUFFICIENT_CREDITS',
      }
    }

    // 4. Moderation check
    const moderationResult = await moderator.moderateContent(prompt)

    if (!moderationResult.isApproved) {
      // Record the blocked generation
      await prisma.generation.create({
        data: {
          userId,
          profileId: profileId,
          type,
          prompt,
          status: 'FAILED',
          error: `Blocked by moderation: ${moderationResult.reason}`,
          metadata: ({
            moderation: moderationResult,
            ...metadata,
          } as unknown as Prisma.InputJsonValue),
          model: 'moderation_block',
          tokens: 0,
        },
      })

      return {
        success: false,
        error: `Content blocked: ${moderationResult.reason}`,
        code: 'CONTENT_BLOCKED',
      }
    }

    // 5. Route model selection
    const route: RouteDecision = routeModel(type, subscription?.tier || 'FREE')

    // 6. Fetch brand if brandId provided
    let brand = null
    if (brandId) {
      brand = await prisma.brand.findUnique({
        where: { id: brandId, userId, deletedAt: null },
      })
    }

    // 7. Build enhanced prompt using prompt library
    const brandVoiceData: Record<string, unknown> = {
      ...(dbProfile?.brandVoice ? { profileBrandVoice: dbProfile.brandVoice } : {}),
      ...(brand?.name ? { brandName: brand.name } : {}),
      ...(brand?.voice ? { brandVoice: brand.voice } : {}),
      ...(brand?.tone ? { brandTone: brand.tone } : {}),
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

    // 8. Estimate costs
    const estimatedTokens = 1500 // average response
    const estimatedCost = calculateCost(estimatedTokens, route.model)

    // 9. Create generation record (pending)
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
          estimatedCost,
          ...metadata,
        } as unknown as Prisma.InputJsonValue),
      },
    })

    // 10. Real LLM call via GigaChat
    const gigaResult = await generateWithGigaChat(enhancedPrompt, route.temperature, route.maxTokens)
    const jsonPayload = extractJsonObject(gigaResult.content)
    let generated: z.infer<typeof GeneratedJsonSchema>
    if (jsonPayload) {
      try {
        const parsedGeneration = GeneratedJsonSchema.safeParse(JSON.parse(jsonPayload) as unknown)
        if (parsedGeneration.success) {
          generated = parsedGeneration.data
        } else {
          generated = parseGenerationFromText(gigaResult.content)
        }
      } catch {
        generated = parseGenerationFromText(gigaResult.content)
      }
    } else {
      generated = parseGenerationFromText(gigaResult.content)
    }
    const generatedValidation = validateGeneratedContent(generated, {
      topic: prompt,
      platform: normalizedInput.platformLabel ?? platform ?? 'Instagram',
      maxLength,
      contentType,
      toneOverride,
      includeEmojis,
    })
    if (!generatedValidation.valid) {
      await prisma.generation.update({
        where: { id: generation.id },
        data: {
          status: 'FAILED' as const,
          error: generatedValidation.message,
          metadata: ({
            ...(typeof generation.metadata === 'object' && generation.metadata ? generation.metadata : {}),
            failedAt: new Date(),
            validationError: generatedValidation.message,
          } as unknown as Prisma.InputJsonValue),
        },
      })
      return {
        success: false,
        error: generatedValidation.message,
        code: 'VALIDATION_ERROR',
      }
    }
    const generatedContent = `${generated.hook}\n\n${generated.body}\n\n${generated.hashtags.join(' ')}\n\n${generated.cta}`.trim()
    const generationOutputJson = JSON.stringify({
      hook: generated.hook,
      body: generated.body,
      hashtags: generated.hashtags,
      cta: generated.cta,
    })

    // 11. Update generation with result
    await prisma.generation.update({
      where: { id: generation.id },
      data: {
        status: 'COMPLETED' as const,
        output: generationOutputJson,
        tokens: estimatedTokens,
        metadata: ({
          ...(typeof generation.metadata === 'object' && generation.metadata ? generation.metadata : {}),
          completedAt: new Date(),
          actualCost: estimatedCost,
          modelUsed: gigaResult.model,
        } as unknown as Prisma.InputJsonValue),
      },
    })

    // 12. Track token usage
    trackTokenUsage(
      { promptTokens: 500, completionTokens: 1000, totalTokens: estimatedTokens },
      estimatedCost
    )

    // 13. Re-sync subscription credits (count COMPLETED generations)
    revalidatePath('/dashboard/generate')

    return {
      success: true,
      data: {
        generationId: generation.id,
        content: generatedContent,
        model: gigaResult.model,
        tokens: {
          promptTokens: 500,
          completionTokens: 1000,
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

function buildPrompt(input: PromptBuildInput, brandVoice: Record<string, unknown> | null): string {
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
    '{{topic}}': input.topic,
    '{{platform}}': input.platform,
    '{{brand_voice_json}}': JSON.stringify(brandVoice ?? {}, null, 2),
    '{{max_length_chars}}': input.maxLength.toString(),
    '{{min_length_chars}}': Math.max(300, Math.floor(input.maxLength * 0.6)).toString(),
    '{{include_hashtags}}': 'true',
    '{{cta_type}}': 'оставь комментарий',
    '{{avoid_phrases}}': '["в современном мире", "уникальный контент", "инновационный подход", "цифровая эпоха"]',
    '{{content_type}}': contentTypeMap[input.contentType],
    '{{tone_override}}': toneMap[input.toneOverride],
    '{{include_emojis}}': input.includeEmojis ? 'true' : 'false',
  }
  for (const [key, value] of Object.entries(replacements)) {
    prompt = prompt.replaceAll(key, value)
  }

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

