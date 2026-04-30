export type AnalyticsPostLite = {
  platform: string
  status: string
  publishedAt: Date | null
}

export type PlatformPerformance = Array<{
  platform: string
  count: number
  share: number
}>

export function getBestPublishingTime(posts: AnalyticsPostLite[]): string {
  const byHour = posts
    .filter((post) => post.status === 'PUBLISHED' && post.publishedAt)
    .reduce<Record<string, number>>((acc, post) => {
      const hour = new Date(post.publishedAt as Date).getHours()
      const key = `${String(hour).padStart(2, '0')}:00`
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})

  return Object.entries(byHour).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '09:00'
}

export function getPlatformPerformance(posts: AnalyticsPostLite[]): PlatformPerformance {
  const published = posts.filter((post) => post.status === 'PUBLISHED')
  const total = published.length
  if (total === 0) return []

  const byPlatform = published.reduce<Record<string, number>>((acc, post) => {
    acc[post.platform] = (acc[post.platform] ?? 0) + 1
    return acc
  }, {})

  return Object.entries(byPlatform)
    .map(([platform, count]) => ({
      platform,
      count,
      share: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count)
}
