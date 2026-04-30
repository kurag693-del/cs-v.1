'use server'

import { z } from 'zod'
import { getAIProvider } from '@/lib/ai/providers/registry'
import type { AIProviderId } from '@/lib/ai/providers/types'

const GenerateCoverPromptSchema = z.object({
  topic: z.string().min(3, 'Тема обложки слишком короткая'),
  platform: z.enum(['INSTAGRAM', 'TELEGRAM', 'VK', 'TIKTOK']).default('INSTAGRAM'),
  brandContext: z.record(z.string(), z.unknown()).optional(),
  provider: z.enum(['gigachat', 'yandexgpt', 'vkai']).default('gigachat'),
})

type GenerateCoverPromptResult =
  | { success: true; data: { imagePrompt: string; provider: AIProviderId; model: string } }
  | { success: false; error: { code: 'VALIDATION_ERROR' | 'PROVIDER_ERROR'; message: string } }

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

  const provider = getAIProvider(validated.data.provider)
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
