import { describe, expect, it } from 'vitest'
import { buildPrompt, parseGenerationFromText } from '@/lib/generate/actions'
import { validateGeneratedContent } from '@/lib/validation/generation-output'

describe('phase 1 generation hardening', () => {
  it('buildPrompt fully replaces {{variable}} placeholders', () => {
    const prompt = buildPrompt(
      {
        topic: 'Запуск нового образовательного продукта',
        platform: 'Telegram',
        maxLength: 900,
        contentType: 'post',
        toneOverride: 'brand',
        includeEmojis: true,
      },
      {
        brandName: 'Creative Studio',
        brandVoice: 'дружелюбный экспертный',
      }
    )

    expect(prompt).not.toMatch(/\{\{[a-z0-9_]+\}\}/i)
    expect(prompt).toContain('Telegram')
    expect(prompt).toContain('Creative Studio')
  })

  it('fails validation for forbidden template phrases', () => {
    const validation = validateGeneratedContent(
      {
        hook: 'Как выйти в топ?',
        body: 'Это уникальный контент для вашего бизнеса, '.repeat(15),
        hashtags: ['#маркетинг'],
        cta: 'Пишите в комментарии',
      },
      300
    )

    expect(validation.valid).toBe(false)
  })

  it('parses plain text and injects fallback CTA when missing', () => {
    const parsed = parseGenerationFromText(
      `Хук для поста\n\n${'Основной текст '.repeat(40)}\n\n#креатив #маркетинг`
    )

    expect(parsed.hook.length).toBeGreaterThan(0)
    expect(parsed.body.length).toBeGreaterThanOrEqual(300)
    expect(parsed.cta.length).toBeGreaterThan(0)
  })
})
