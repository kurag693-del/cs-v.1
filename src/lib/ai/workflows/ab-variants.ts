export type AbVariant = {
  id: 'A' | 'B' | 'C'
  label: string
  content: string
}

const LABEL_BY_ID: Record<AbVariant['id'], string> = {
  A: 'Вариант A (базовый)',
  B: 'Вариант B (больше пользы)',
  C: 'Вариант C (более эмоциональный)',
}

function withPrefix(content: string, prefix: string): string {
  const parts = content.split('\n\n')
  if (parts.length === 0) return content
  parts[0] = `${prefix} ${parts[0]}`.trim()
  return parts.join('\n\n')
}

export function buildAbVariants(baseContent: string, variantsCount: 1 | 2 | 3): AbVariant[] {
  const variantIds: AbVariant['id'][] = variantsCount === 1 ? ['A'] : variantsCount === 2 ? ['A', 'B'] : ['A', 'B', 'C']

  return variantIds.map((id) => {
    if (id === 'A') {
      return { id, label: LABEL_BY_ID[id], content: baseContent }
    }
    if (id === 'B') {
      return {
        id,
        label: LABEL_BY_ID[id],
        content: withPrefix(baseContent, 'Практически:'),
      }
    }
    return {
      id,
      label: LABEL_BY_ID[id],
      content: withPrefix(baseContent, 'Вдохновляюще:'),
    }
  })
}
