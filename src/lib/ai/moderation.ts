import type { ModerationResult } from './types'
import { routeModel } from '@/lib/ai/router'
import { pickOpenRouterTextModel } from '@/lib/ai/model-catalog'
import { getConfiguredAIProviderIds } from '@/lib/ai/providers/availability'
import { getAIProvider } from '@/lib/ai/providers/registry'
import { resolveEffectiveDefaultProvider } from '@/lib/ai/providers/availability'
import type { AIProviderId } from '@/lib/ai/providers/types'

function extractJsonObject(raw: string): string | null {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end < 0 || end <= start) return null
  return raw.slice(start, end + 1)
}

/**
 * LLM-модерация (отдельный короткий запрос). При ошибке возвращает null — снаружи fallback.
 */
async function moderateWithLlm(userPrompt: string): Promise<ModerationResult | null> {
  if (process.env.MODERATION_USE_LLM === 'false') return null

  const ids = getConfiguredAIProviderIds()
  if (ids.length === 0) return null

  const preferredRaw = process.env.MODERATION_AI_PROVIDER?.trim().toLowerCase()
  const preferred =
    preferredRaw && (ids as readonly string[]).includes(preferredRaw) ? (preferredRaw as AIProviderId) : null
  const providerId = preferred ?? resolveEffectiveDefaultProvider()
  if (!(ids as readonly string[]).includes(providerId)) return null

  const route = routeModel('text', 'FREE')
  const provider = getAIProvider(providerId)

  const instruction = `Ты модератор. Проанализируй пользовательский запрос на генерацию контента.
Верни ТОЛЬКО JSON без markdown:
{"isApproved": boolean, "categories": string[], "severity": "low"|"medium"|"high"|"critical", "reason": string, "flags": string[]}
Отклоняй: разжигание ненависти, насилие, сексуальный контент с несовершеннолетними, инструкции к преступлениям, персональные данные чужих людей, фишинг.

Запрос пользователя:
---
${userPrompt.slice(0, 8000)}
---`

  try {
    const res = await provider.generate({
      prompt: instruction,
      temperature: 0,
      maxTokens: 400,
      ...(providerId === 'openrouter'
        ? { model: pickOpenRouterTextModel('FREE', route.model, undefined) }
        : {}),
    })

    const jsonRaw = extractJsonObject(res.content)
    if (!jsonRaw) return null
    const parsed = JSON.parse(jsonRaw) as Record<string, unknown>
    const isApproved = Boolean(parsed.isApproved)
    const categories = Array.isArray(parsed.categories)
      ? parsed.categories.filter((c): c is string => typeof c === 'string')
      : []
    const severity = ['low', 'medium', 'high', 'critical'].includes(String(parsed.severity))
      ? (parsed.severity as ModerationResult['severity'])
      : 'low'
    const reason = typeof parsed.reason === 'string' ? parsed.reason : 'Moderation'
    const flags = Array.isArray(parsed.flags)
      ? parsed.flags.filter((c): c is string => typeof c === 'string')
      : []

    return {
      isApproved,
      categories,
      severity,
      reason,
      flags,
    }
  } catch {
    return null
  }
}

export class ContentModerator {
  async moderateContent(prompt: string): Promise<ModerationResult> {
    const blockedKeywords = [
      'hate',
      'kill',
      'die',
      'suicide',
      'bomb',
      'terror',
      'racist',
      'nazi',
      'slur',
      'rape',
      'pedophile',
      'ssn',
      'social security',
      'credit card',
      'password',
    ]

    const lowerPrompt = prompt.toLowerCase()
    const foundKeywords = blockedKeywords.filter((kw) => lowerPrompt.includes(kw))

    if (foundKeywords.length > 0) {
      return {
        isApproved: false,
        categories: ['violence', 'hate_speech'],
        severity: 'high',
        reason: `Blocked keywords detected: ${foundKeywords.join(', ')}`,
        flags: foundKeywords,
      }
    }

    const llm = await moderateWithLlm(prompt)
    if (llm) return llm

    return this.simulateModeration(prompt)
  }

  private async simulateModeration(prompt: string): Promise<ModerationResult> {
    const toxicIndicators = ['fuck', 'shit', 'asshole', 'bitch', 'damn']
    const toxicCount = toxicIndicators.filter((word) => prompt.toLowerCase().includes(word)).length

    if (toxicCount >= 3) {
      return {
        isApproved: false,
        categories: ['toxicity'],
        severity: 'medium',
        reason: 'High toxicity detected in prompt',
        flags: ['toxicity'],
      }
    }

    if (prompt.length < 5) {
      return {
        isApproved: false,
        categories: ['quality'],
        severity: 'low',
        reason: 'Prompt too short',
        flags: ['too_short'],
      }
    }

    if (prompt.length > 5000) {
      return {
        isApproved: false,
        categories: ['quality'],
        severity: 'low',
        reason: 'Prompt exceeds maximum length',
        flags: ['too_long'],
      }
    }

    return {
      isApproved: true,
      categories: [],
      severity: 'low',
      reason: 'Content approved',
      flags: [],
    }
  }
}

export const moderator = new ContentModerator()
