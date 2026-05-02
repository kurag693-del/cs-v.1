export type AbVariant = {
  id: 'A' | 'B' | 'C'
  label: string
  content: string
}

export const AB_VARIANT_LABELS: Record<AbVariant['id'], string> = {
  A: 'Вариант A (базовый)',
  B: 'Вариант B (больше пользы)',
  C: 'Вариант C (более эмоциональный)',
}

const LABEL_BY_ID = AB_VARIANT_LABELS

function splitBlocks(text: string): string[] {
  return text
    .trim()
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
}

/** Меняем порядок первых двух абзацев — другая логика чтения без второго запроса к ИИ. */
function reorderFirstTwoBlocks(blocks: string[]): string[] {
  if (blocks.length >= 2) {
    const [first, second, ...rest] = blocks
    return [second, first, ...rest]
  }
  return blocks
}

/** Если один сплошной абзац — переставляем два первых предложения. */
function reorderFirstTwoSentences(text: string): string {
  const parts = text.split(/(?<=[.!?…])\s+/u).filter((p) => p.trim().length > 0)
  if (parts.length >= 2) {
    return [parts[1], parts[0], ...parts.slice(2)].join(' ').trim()
  }
  return text.trim()
}

function withPrefixFirstBlock(content: string, prefix: string): string {
  const parts = content.split('\n\n')
  if (parts.length === 0) return content
  parts[0] = `${prefix} ${parts[0]}`.trim()
  return parts.join('\n\n')
}

function withHeader(id: AbVariant['id'], inner: string): string {
  const title =
    id === 'A' ? 'Вариант A — как в черновике' : id === 'B' ? 'Вариант B — сильнее польза' : 'Вариант C — эмоциональнее'
  return `【${title}】\n\n${inner}`.trim()
}

/** Укорачиваем текст по границе слова — заметно отличается от A/B по объёму. */
function shortenForVariantC(text: string, ratio: number): string {
  const t = text.trim()
  const target = Math.max(120, Math.floor(t.length * ratio))
  if (t.length <= target) return t
  const slice = t.slice(0, target)
  const cut = slice.lastIndexOf(' ')
  const body = (cut > Math.min(80, target * 0.5) ? slice.slice(0, cut) : slice).trimEnd()
  return `${body}…`
}

function buildVariantBBody(base: string): string {
  const blocks = splitBlocks(base)
  const reshaped =
    blocks.length >= 2 ? reorderFirstTwoBlocks(blocks).join('\n\n') : reorderFirstTwoSentences(blocks[0] ?? base)
  return withPrefixFirstBlock(reshaped, 'По делу:')
}

function buildVariantCBody(base: string): string {
  const shortened = shortenForVariantC(base, 0.72)
  const voiced = withPrefixFirstBlock(shortened, 'Эмоционально:')
  return withHeader('C', voiced)
}

/** Одна генерация ИИ; A/B/C — разная структура и объём без второго запроса к модели. */
export function buildAbVariants(baseContent: string, variantsCount: 1 | 2 | 3): AbVariant[] {
  const variantIds: AbVariant['id'][] = variantsCount === 1 ? ['A'] : variantsCount === 2 ? ['A', 'B'] : ['A', 'B', 'C']

  return variantIds.map((id) => {
    if (id === 'A') {
      return { id, label: LABEL_BY_ID[id], content: baseContent }
    }
    if (id === 'B') {
      const body = buildVariantBBody(baseContent)
      return {
        id,
        label: LABEL_BY_ID[id],
        content: [
          'Вариант B — другой порядок абзацев и акцент на пользу (смысл тот же, подача другая).',
          '',
          body,
        ].join('\n'),
      }
    }
    return {
      id,
      label: LABEL_BY_ID[id],
      content: [
        'Вариант C — короче (~70% текста) и с другим тоном во вступлении.',
        '',
        buildVariantCBody(baseContent),
      ].join('\n'),
    }
  })
}
