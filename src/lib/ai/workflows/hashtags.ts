const STOP_WORDS = new Set([
  'и',
  'в',
  'на',
  'с',
  'к',
  'по',
  'для',
  'или',
  'как',
  'это',
  'that',
  'with',
  'from',
  'your',
])

function normalizeWord(word: string): string {
  return word.replace(/[^\p{L}\p{N}_]/gu, '').toLowerCase()
}

export function generateAutoHashtags(content: string, platform: string, maxTags = 5): string[] {
  const words = content
    .split(/\s+/)
    .map(normalizeWord)
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word))

  const counts = new Map<string, number>()
  for (const word of words) {
    counts.set(word, (counts.get(word) ?? 0) + 1)
  }

  const ranked = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxTags - 1)
    .map(([word]) => `#${word}`)

  const platformTag = `#${platform.toLowerCase()}`
  return Array.from(new Set([platformTag, ...ranked]))
}
