export type RecycleTarget = 'Instagram' | 'Telegram' | 'VK' | 'TikTok' | 'Dzen'

export type RecycledPost = {
  platform: RecycleTarget
  content: string
}

function trimByLimit(content: string, limit: number): string {
  if (content.length <= limit) return content
  return `${content.slice(0, Math.max(limit - 1, 1)).trimEnd()}…`
}

/** Без ИИ: одна и та же суть, но разная подача под формат канала. */
export function recycleContentForPlatforms(baseContent: string, targets: RecycleTarget[]): RecycledPost[] {
  const uniqueTargets = Array.from(new Set(targets))
  const core = baseContent.trim()

  return uniqueTargets.map((target) => {
    if (target === 'Telegram') {
      const text = `📌 Для канала в Telegram\n\n${core}\n\n💬 Напишите в комментариях, что думаете.`
      return { platform: target, content: trimByLimit(text, 3500) }
    }
    if (target === 'VK') {
      const text = `Друзья, коротко по теме 👇\n\n${core}\n\nПолезно — жмите 👍 и делитесь записью.`
      return { platform: target, content: trimByLimit(text, 2800) }
    }
    if (target === 'TikTok') {
      const cap = core.length > 900 ? `${core.slice(0, 897).trimEnd()}…` : core
      const text = `Описание к ролику:\n\n${cap}\n\n(Текст для экрана — короче, под вертикальное видео.)`
      return { platform: target, content: trimByLimit(text, 1200) }
    }
    if (target === 'Dzen') {
      const text = `Заголовок-мысль: раскрываем тему спокойно и развёрнуто.\n\n${core}\n\nЕсли материал зашёл — подпишитесь на канал, будет продолжение.`
      return { platform: target, content: trimByLimit(text, 5000) }
    }
    const text = `✨ Для ленты Instagram\n\n${core}\n\nСохраняйте пост в закладки и отмечайте друзей в сторис.`
    return { platform: target, content: trimByLimit(text, 2200) }
  })
}
