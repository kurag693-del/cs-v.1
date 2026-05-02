import { z } from 'zod'

const FORBIDDEN_TEMPLATE_PHRASES = ['в современном мире', 'уникальный контент', 'инновационный подход', 'цифровая эпоха'] as const

const DEFAULT_CTA_IF_EMPTY = 'Напишите в комментариях — обсудим вместе!'

export const generatedJsonSchema = z.object({
  hook: z.string().trim().min(1, 'Хук обязателен'),
  body: z.string().trim().min(300, 'Generated body is too short'),
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
  cta: z
    .string()
    .trim()
    .transform((value) => (value.length > 0 ? value : DEFAULT_CTA_IF_EMPTY)),
})

export type GeneratedContent = z.infer<typeof generatedJsonSchema>

type GeneratedValidationInput = {
  hook: string
  body: string
  hashtags: string[]
  cta: string
}

const META_MARKERS_REGEX = /\[(проверить|check|todo|to-do|draft|черновик|заполнить|уточнить)\]/gi

function cleanupText(value: string): string {
  return value
    .replace(META_MARKERS_REGEX, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function normalizeGeneratedContent(generated: GeneratedValidationInput): GeneratedValidationInput {
  return {
    hook: cleanupText(generated.hook),
    body: cleanupText(generated.body),
    hashtags: generated.hashtags.map((tag) => tag.trim()).filter(Boolean),
    cta: cleanupText(generated.cta),
  }
}

export function validateGeneratedContent(generated: GeneratedValidationInput, minLength: number): { valid: true } | { valid: false; message: string } {
  if (!generated.hook.trim() || !generated.cta.trim()) {
    return { valid: false, message: 'Нарушена структура: нужен хук и CTA' }
  }

  if (generated.body.trim().length < minLength) {
    return { valid: false, message: `Слишком короткий текст: минимум ${minLength} символов в body` }
  }

  const fullText = `${generated.hook}\n${generated.body}\n${generated.cta}`.toLowerCase()
  const matchedForbiddenPhrase = FORBIDDEN_TEMPLATE_PHRASES.find((phrase) => fullText.includes(phrase))
  if (matchedForbiddenPhrase) {
    return { valid: false, message: `Ответ содержит шаблонную фразу: "${matchedForbiddenPhrase}"` }
  }

  return { valid: true }
}
