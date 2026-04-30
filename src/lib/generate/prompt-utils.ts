import { readFileSync } from 'node:fs'
import path from 'node:path'

export type PromptBuildInput = {
  topic: string
  platform: string
  maxLength: number
  contentType: 'post' | 'story' | 'tips' | 'announcement'
  toneOverride: 'brand' | 'humor' | 'formal'
  includeEmojis: boolean
}

type ParsedGenerated = { hook: string; body: string; hashtags: string[]; cta: string }

function sanitizeHashtags(value: unknown): string[] {
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
  const cta = stripMarkdown(decodeJsonLikeString(ctaMatch[1] ?? '')).trim()
  const hashtags = sanitizeHashtags(hashtagMatches)

  if (!hook || !body || !cta) {
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
      const hashtags = sanitizeHashtags(parsed.hashtags)
      if (hook && body && cta) {
        return { hook, body, cta, hashtags }
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

  prompt = prompt.replace(/\{\{([a-z0-9_]+)\}\}/gi, (match, variableName: string) => {
    const replacement = replacements[variableName]
    if (replacement === undefined) {
      throw new Error(`Неизвестная переменная промпта: ${match}`)
    }
    return replacement
  })

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
