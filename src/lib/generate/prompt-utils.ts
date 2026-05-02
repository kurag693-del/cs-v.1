import { readFileSync } from 'node:fs'
import path from 'node:path'

export type PromptBuildInput = {
  topic: string
  platform: string
  maxLength: number
  contentType: 'post' | 'story' | 'tips' | 'announcement'
  toneOverride: 'brand' | 'humor' | 'formal'
  includeEmojis: boolean
  /** 2–3 = один запрос к модели, в ответе массив variants */
  variantsCount?: 1 | 2 | 3
}

type ParsedGenerated = { hook: string; body: string; hashtags: string[]; cta: string }
const REQUIRED_PLACEHOLDERS = [
  'topic',
  'platform',
  'brand_voice_json',
  'max_length_chars',
  'min_length_chars',
  'include_hashtags',
  'cta_type',
  'avoid_phrases',
  'content_type',
  'tone_override',
  'include_emojis',
] as const

export function sanitizeHashtags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => (item.startsWith('#') ? item : `#${item}`))
        .filter((item) => /^#[\p{L}\p{N}_]{2,50}$/u.test(item))
    )
  )
}

function stripMarkdown(text: string): string {
  return text
    .replace(/```json|```/gi, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '')
    .trim()
}

function decodeJsonLikeString(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
}

const DEFAULT_CTA_FALLBACK = 'Напишите в комментариях — обсудим вместе!'

function textAfterJsonBlock(raw: string): string {
  const end = raw.lastIndexOf('}')
  if (end < 0) return raw
  return raw.slice(end + 1)
}

function extractHashtagsFromTail(raw: string): string[] {
  const tail = textAfterJsonBlock(raw)
  const tags = tail.match(/#[\p{L}\p{N}_]+/gu) ?? []
  return sanitizeHashtags(tags)
}

function extractCtaFromTail(raw: string): string {
  const tail = textAfterJsonBlock(raw).trim()
  if (!tail) return DEFAULT_CTA_FALLBACK
  const lines = tail
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const nonTagLine = lines.find((line) => !line.startsWith('#'))
  if (nonTagLine && nonTagLine.length >= 8) {
    return nonTagLine
  }
  return DEFAULT_CTA_FALLBACK
}

function parseJsonLikeResponse(raw: string): ParsedGenerated | null {
  const hookMatch = raw.match(/"hook"\s*:\s*"([\s\S]*?)"\s*,\s*"body"/i)
  const bodyMatch = raw.match(/"body"\s*:\s*"([\s\S]*?)"\s*,\s*"hashtags"/i)
  const ctaMatch = raw.match(/"cta"\s*:\s*"([\s\S]*?)"\s*,\s*"(platform_specific_notes|word_count|matches_brand_tone)"/i)
  const hashtagsBlockMatch = raw.match(/"hashtags"\s*:\s*\[([\s\S]*?)\]/i)

  if (!hookMatch || !bodyMatch || !ctaMatch) {
    return null
  }

  const hashtagsRaw = hashtagsBlockMatch?.[1] ?? ''
  const hashtagMatches = Array.from(hashtagsRaw.matchAll(/"([^"]*)"/g)).map((item) => item[1] ?? '')

  const hook = stripMarkdown(decodeJsonLikeString(hookMatch[1] ?? '')).trim()
  const body = stripMarkdown(decodeJsonLikeString(bodyMatch[1] ?? '')).trim()
  let cta = stripMarkdown(decodeJsonLikeString(ctaMatch[1] ?? '')).trim()
  let hashtags = sanitizeHashtags(hashtagMatches)
  if (!cta) {
    cta = extractCtaFromTail(raw)
  }
  if (hashtags.length === 0) {
    hashtags = extractHashtagsFromTail(raw)
  }
  if (!cta) {
    cta = DEFAULT_CTA_FALLBACK
  }

  if (!hook || !body) {
    return null
  }

  return { hook, body, cta, hashtags }
}

const TEXT_PROMPT_TEMPLATE = (() => {
  try {
    return readFileSync(path.join(process.cwd(), 'prompts', 'v1_text_generator.md'), 'utf-8')
  } catch {
    return ''
  }
})()

export function parseGenerationFromText(raw: string): ParsedGenerated {
  const normalizedRaw = stripMarkdown(raw)
  const jsonCandidate = (() => {
    const start = normalizedRaw.indexOf('{')
    const end = normalizedRaw.lastIndexOf('}')
    if (start < 0 || end < 0 || end <= start) return null
    return normalizedRaw.slice(start, end + 1)
  })()

  if (jsonCandidate) {
    try {
      const parsed = JSON.parse(jsonCandidate) as Record<string, unknown>
      const hook = typeof parsed.hook === 'string' ? stripMarkdown(parsed.hook) : ''
      const body = typeof parsed.body === 'string' ? stripMarkdown(parsed.body) : ''
      const cta = typeof parsed.cta === 'string' ? stripMarkdown(parsed.cta) : ''
      let hashtags = sanitizeHashtags(parsed.hashtags)
      let effectiveCta = cta.trim()
      if (!effectiveCta) {
        effectiveCta = extractCtaFromTail(normalizedRaw)
      }
      if (!effectiveCta) {
        effectiveCta = DEFAULT_CTA_FALLBACK
      }
      if (hashtags.length === 0) {
        hashtags = extractHashtagsFromTail(normalizedRaw)
      }
      if (hook && body) {
        return { hook, body, cta: effectiveCta, hashtags }
      }
    } catch {
      // fallback to plain-text parser
    }
  }

  const jsonLikeParsed = parseJsonLikeResponse(raw)
  if (jsonLikeParsed) {
    return jsonLikeParsed
  }

  const lines = raw
    .split('\n')
    .map((line) => stripMarkdown(line))
    .filter(Boolean)

  const allHashtags = Array.from(
    new Set(
      normalizedRaw
        .match(/#[\p{L}\p{N}_]+/gu)
        ?.map((tag) => tag.trim())
        .filter(Boolean) ?? []
    )
  )

  const textWithoutHashtags = normalizedRaw
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

  for (const placeholder of REQUIRED_PLACEHOLDERS) {
    if (!prompt.includes(`{{${placeholder}}}`)) {
      throw new Error(`В шаблоне отсутствует обязательный плейсхолдер: {{${placeholder}}}`)
    }
  }

  prompt = prompt.replace(/\{\{([a-z0-9_]+)\}\}/gi, (match, variableName: string) => {
    const replacement = replacements[variableName]
    if (replacement === undefined) {
      throw new Error(`Неизвестная переменная промпта: ${match}`)
    }
    return replacement
  })

  if (/\{\{[a-z0-9_]+\}\}/i.test(prompt)) {
    throw new Error('Шаблон содержит незамененные плейсхолдеры')
  }

  const multi =
    input.variantsCount === 2 || input.variantsCount === 3
      ? `

## Multi-variant (ОБЯЗАТЕЛЬНО для этого запроса)
Верни **один** JSON-объект с корневым полем \`variants\`: массив из **ровно ${input.variantsCount}** объектов-постов.
Порядок в массиве: [0] = вариант A, [1] = вариант B${input.variantsCount === 3 ? ', [2] = вариант C' : ''}.
Каждый элемент содержит те же поля, что и обычный пост: hook, body, hashtags, cta; при необходимости platform_specific_notes, word_count, matches_brand_tone.

Требования к различию:
- У каждого варианта **другой hook** и **другое начало body**; не повторяй целые предложения между вариантами.
- Одинаковая тема и платформа, разная подача и аргументация.

Структура ответа (пример):
\`\`\`json
{
  "variants": [
    { "hook": "...", "body": "...", "hashtags": ["#a"], "cta": "...", "platform_specific_notes": "", "word_count": 0, "matches_brand_tone": true },
    { "hook": "...", "body": "...", "hashtags": ["#b"], "cta": "..." }
  ]
}
\`\`\`
`
      : ''

  return `## Critical Runtime Directives
- Строго используй тип контента: ${contentTypeMap[input.contentType]}.
- Строго используй тон: ${toneMap[input.toneOverride]}.
- Эмодзи: ${input.includeEmojis ? 'можно умеренно' : 'запрещены полностью'}.

${prompt}
${multi}

## Runtime Overrides
- Тип контента: ${contentTypeMap[input.contentType]}
- Тон: ${toneMap[input.toneOverride]}
- Эмодзи: ${input.includeEmojis ? 'разрешены, но умеренно' : 'не использовать'}
`
}

/**
 * Второй/третий независимый вызов модели: тот же базовый шаблон + жёсткие анти-дубликаты
 * с фрагментами уже сгенерированных вариантов.
 */
export function buildAlternativeSocialPostPrompt(
  basePrompt: string,
  input: { variantLetter: 'B' | 'C'; peerExcerpts: string[] }
): string {
  const blocks = input.peerExcerpts
    .map((excerpt, i) => {
      const label = String.fromCharCode(65 + i)
      const clipped = excerpt.trim().slice(0, 520)
      return `Черновик ${label} (фрагмент — не копируй целиком и не повторяй дословно):\n${clipped}`
    })
    .join('\n\n')

  return `${basePrompt}

---
ОТДЕЛЬНЫЙ ЗАПРОС — ВАРИАНТ ${input.variantLetter}:
Это новый ответ модели на ту же тему и платформу. Формат выхода — как в инструкции выше (JSON с hook, body, hashtags, cta и др., если требовалось).

Обязательно:
- Другой hook и иное начало body по смыслу и формулировкам (не перефраз черновика A).
- Другая структура абзацев и другие примеры там, где уместно.
- Не повторяй целые предложения из фрагментов ниже.

${blocks}

Верни только ответ в том же формате (JSON), без пояснений до и после.`
}
