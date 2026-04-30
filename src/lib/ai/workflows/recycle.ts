export type RecycleTarget = 'Instagram' | 'Telegram' | 'VK' | 'TikTok' | 'Dzen'

export type RecycledPost = {
  platform: RecycleTarget
  content: string
}

function trimByLimit(content: string, limit: number): string {
  if (content.length <= limit) return content
  return `${content.slice(0, Math.max(limit - 1, 1)).trimEnd()}…`
}

export function recycleContentForPlatforms(baseContent: string, targets: RecycleTarget[]): RecycledPost[] {
  const uniqueTargets = Array.from(new Set(targets))

  return uniqueTargets.map((target) => {
    if (target === 'Telegram') {
      return {
        platform: target,
        content: trimByLimit(`Telegram-версия:\n\n${baseContent}`, 3500),
      }
    }
    if (target === 'VK') {
      return {
        platform: target,
        content: trimByLimit(`VK-версия:\n\n${baseContent}`, 2800),
      }
    }
    if (target === 'TikTok') {
      return {
        platform: target,
        content: trimByLimit(`TikTok-версия (коротко и емко):\n\n${baseContent}`, 1200),
      }
    }
    if (target === 'Dzen') {
      return {
        platform: target,
        content: trimByLimit(`Dzen-версия (длинный формат):\n\n${baseContent}`, 5000),
      }
    }
    return {
      platform: target,
      content: trimByLimit(`Instagram-версия:\n\n${baseContent}`, 2200),
    }
  })
}
