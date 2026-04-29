import { z } from 'zod'

const FORBIDDEN_TEMPLATE_PHRASES = ['в современном мире', 'уникальный контент', 'инновационный подход', 'цифровая эпоха'] as const

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
  cta: z.string().trim().min(1, 'CTA обязателен'),
})

export type GeneratedContent = z.infer<typeof generatedJsonSchema>

type GeneratedValidationInput = {
  hook: string
  body: string
  hashtags: string[]
  cta: string
}

export function validateGeneratedContent(generated: GeneratedValidationInput, minLength: number): { valid: true } | { valid: false; message: string } {
  if (!generated.hook.trim() || !generated.cta.trim()) {
    return { valid: false, message: 'Нарушена структура: нужен хук и CTA' }
  }

  if (generated.body.trim().length < minLength) {
    return { valid: false, message: `Слишком короткий текст: минимум ${minLength} символов в body` }
  }

  const fullText = `${generated.hook}\n${generated.body}\n${generated.cta}`.toLowerCase()
  if (FORBIDDEN_TEMPLATE_PHRASES.some((phrase) => fullText.includes(phrase))) {
    return { valid: false, message: 'Ответ содержит шаблонные фразы из запрещенного списка' }
  }

  return { valid: true }
}
