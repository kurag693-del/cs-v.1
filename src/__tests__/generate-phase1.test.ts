import { describe, expect, it } from 'vitest'
import { buildPrompt, parseGenerationFromText } from '@/lib/generate/prompt-utils'
import { normalizeGeneratedContent, validateGeneratedContent } from '@/lib/validation/generation-output'
import { AI_PROVIDER_IDS } from '@/lib/ai/providers/registry'

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

  it('keeps provider registry with required ids', () => {
    expect(AI_PROVIDER_IDS).toEqual(expect.arrayContaining(['gigachat', 'yandexgpt', 'vkai']))
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

  it('parses fenced json response and ignores noisy tail', () => {
    const parsed = parseGenerationFromText(`\`\`\`json
{
  "hook": "Новые миры ждут вас в мае 2026 года!",
  "body": "**Тест объявляет:** ${'Новая MMORPG '.repeat(40)}",
  "hashtags": ["", "", "MMORPG", "геймерыРоссия"],
  "cta": "Узнайте больше в нашем профиле!"
}
\`\`\`
#MMORPG #компьютерныеигры
Напишите в комментариях ваше мнение.`)

    expect(parsed.hook).toContain('Новые миры')
    expect(parsed.cta).toBe('Узнайте больше в нашем профиле!')
    expect(parsed.hashtags).toEqual(expect.arrayContaining(['#MMORPG', '#геймерыРоссия']))
    expect(parsed.hashtags).not.toContain('#')
  })

  it('parses json-like payload when body string breaks strict JSON', () => {
    const parsed = parseGenerationFromText(`{
  "hook": "Готовься к стилю будущего: тренды одежды 2026 уже здесь!",
  "body": "
🔥 В 2026 году одежда станет не просто аксессуаром, а полноценным персонажем твоего образа!
✨ Тренды: яркие неоновые цвета и AR-одежда.
",
  "hashtags": ["", "тренды2026", "", "экомода"],
  "cta": "Перейди в профиль, чтобы узнать больше секретов стиля будущего!",
  "platform_specific_notes": "Для Telegram используй абзацы через пустую строку."
}

#тренды2026 #модасбудущего
Напишите в комментариях ваше мнение`)

    expect(parsed.hook).toContain('тренды одежды 2026')
    expect(parsed.body).toContain('AR-одежда')
    expect(parsed.cta).toContain('Перейди в профиль')
    expect(parsed.hashtags).toEqual(expect.arrayContaining(['#тренды2026', '#экомода']))
  })

  it('cleans service markers before validation', () => {
    const normalized = normalizeGeneratedContent({
      hook: 'Трендсеттеры уже знают!',
      body: `${'Насыщенный текст '.repeat(30)} [проверить]`,
      hashtags: ['#стиль', '#мода'],
      cta: 'Оставь комментарий!',
    })

    expect(normalized.body).not.toContain('[проверить]')
    const validation = validateGeneratedContent(normalized, 300)
    expect(validation.valid).toBe(true)
  })
})
