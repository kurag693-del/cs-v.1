'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/lib/auth/hooks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import type { ChannelMetricRow } from '@/lib/analytics/engagement-types'

import { ArrowRight, Loader2, RefreshCw, Sparkles, TrendingUp } from 'lucide-react'
import { ContextualAiSuggestion } from '@/components/ui/contextual-ai-suggestion'

type AnalyticsData = {
  totals: {
    posts: number
    published: number
    drafts: number
  }
  byPlatform: Record<string, number>
  byHour: Record<string, number>
  recommendations: {
    bestHour: string
    bestPlatform: string
    suggestions: string[]
  }
}

function sortedEntries(record: Record<string, number>): Array<[string, number]> {
  return Object.entries(record).sort((a, b) => b[1] - a[1])
}

export default function AnalyticsPage() {
  const { user, loading } = useSession()
  const router = useRouter()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [channelPosts, setChannelPosts] = useState<ChannelMetricRow[]>([])
  const [channelLoading, setChannelLoading] = useState(true)
  const [syncingId, setSyncingId] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
      queueMicrotask(() => {
        setLoadingData(false)
        setChannelLoading(false)
      })
      return
    }
    if (user) {
      fetch('/api/analytics')
        .then((res) => res.json())
        .then((result) => {
          if (result?.success) {
            setData(result.data)
          } else {
            setData(null)
          }
        })
        .finally(() => setLoadingData(false))

      fetch('/api/analytics/channel-metrics')
        .then((res) => res.json())
        .then((result) => {
          if (result?.success && Array.isArray(result.data?.posts)) {
            setChannelPosts(result.data.posts as ChannelMetricRow[])
          }
        })
        .finally(() => setChannelLoading(false))
    }
  }, [loading, user, router])

  const handleSyncEngagement = async (postId: string) => {
    setSyncingId(postId)
    try {
      const res = await fetch('/api/analytics/sync-engagement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      })
      const json = (await res.json()) as { success?: boolean; data?: { snapshot?: unknown } }
      if (!json.success) {
        return
      }
      const refreshed = await fetch('/api/analytics/channel-metrics').then((r) => r.json())
      if (refreshed?.success && Array.isArray(refreshed.data?.posts)) {
        setChannelPosts(refreshed.data.posts as ChannelMetricRow[])
      }
    } finally {
      setSyncingId(null)
    }
  }

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    )
  }

  if (!user) return null
  if (!data) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Аналитика пока недоступна</CardTitle>
            <CardDescription>Проверьте подключение и попробуйте обновить страницу.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/dashboard">Вернуться на дашборд</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const publishedRatio = data.totals.posts > 0 ? Math.round((data.totals.published / data.totals.posts) * 100) : 0
  const draftRatio = data.totals.posts > 0 ? Math.round((data.totals.drafts / data.totals.posts) * 100) : 0

  const topPlatforms = sortedEntries(data.byPlatform).slice(0, 3)
  const topHours = sortedEntries(data.byHour).slice(0, 3)

  const reachScore = topPlatforms.reduce((acc, [, value]) => acc + value, 0)
  const engagementScore = topHours.reduce((acc, [, value]) => acc + value, 0)

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard">Назад</Link>
          </Button>
          <Badge variant="secondary">Спокойная аналитика</Badge>
        </div>

        <Card>
          <CardHeader className="space-y-3">
            <CardTitle>Минималистичная панель аналитики</CardTitle>
            <CardDescription>Сначала ключевые инсайты, затем действия. Без BI-перегруза.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-[0.75rem] uppercase tracking-[0.08em] text-muted-foreground">Рост</p>
              <p className="mt-2 text-[1.75rem] font-semibold tracking-[-0.02em]">{publishedRatio}%</p>
              <p className="text-[0.8125rem] text-muted-foreground">Доля опубликованного контента</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-[0.75rem] uppercase tracking-[0.08em] text-muted-foreground">Охват</p>
              <p className="mt-2 text-[1.75rem] font-semibold tracking-[-0.02em]">{reachScore}</p>
              <p className="text-[0.8125rem] text-muted-foreground">Суммарный вклад топ-платформ</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-[0.75rem] uppercase tracking-[0.08em] text-muted-foreground">Вовлеченность</p>
              <p className="mt-2 text-[1.75rem] font-semibold tracking-[-0.02em]">{engagementScore}</p>
              <p className="text-[0.8125rem] text-muted-foreground">Активность в лучших временных слотах</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Охват по платформам</CardTitle>
            <CardDescription>Чистый обзор каналов с максимальным охватом.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {topPlatforms.length === 0 ? (
              <p className="text-[0.9375rem] text-muted-foreground">Недостаточно данных по платформам.</p>
            ) : (
              topPlatforms.map(([platform, value]) => (
                <div key={platform} className="rounded-xl border border-border bg-card p-3">
                  <div className="mb-2 flex items-center justify-between text-[0.875rem]">
                    <span className="font-medium">{platform}</span>
                    <span className="text-muted-foreground">{value}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, value)}%` }} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Временные слоты вовлеченности</CardTitle>
            <CardDescription>Элегантный контейнер для лучших часов публикации.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {topHours.length === 0 ? (
              <p className="text-[0.9375rem] text-muted-foreground">Недостаточно данных по времени.</p>
            ) : (
              topHours.map(([hour, value]) => (
                <div key={hour} className="rounded-xl border border-border bg-card p-3">
                  <div className="mb-2 flex items-center justify-between text-[0.875rem]">
                    <span className="font-medium">{hour}:00</span>
                    <span className="text-muted-foreground">{value}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, value)}%` }} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Метрики из каналов</CardTitle>
          <CardDescription>
            VK: просмотры и реакции через API при корректном `externalId`. Telegram: ограничения Bot API — см.{' '}
            <code className="rounded bg-muted px-1 text-xs">TELEGRAM_ENGAGEMENT_MOCK</code> в примере env.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {channelLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : channelPosts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Нет опубликованных постов для синхронизации.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 font-medium">Платформа</th>
                    <th className="px-3 py-2 font-medium">Фрагмент</th>
                    <th className="px-3 py-2 font-medium">Просмотры</th>
                    <th className="px-3 py-2 font-medium">Лайки</th>
                    <th className="px-3 py-2 font-medium">Источник</th>
                    <th className="px-3 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {channelPosts.map((row) => (
                    <tr key={row.postId} className="border-b border-border/80">
                      <td className="px-3 py-2">{row.platform}</td>
                      <td className="max-w-[220px] truncate px-3 py-2 text-muted-foreground">{row.excerpt}</td>
                      <td className="px-3 py-2">{row.engagement?.views ?? '—'}</td>
                      <td className="px-3 py-2">{row.engagement?.likes ?? '—'}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {row.engagement?.source ?? '—'}
                        {row.engagement?.error ? ` · ${row.engagement.error.slice(0, 48)}` : ''}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={syncingId === row.postId}
                          onClick={() => void handleSyncEngagement(row.postId)}
                        >
                          {syncingId === row.postId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          <span className="ml-1">Синхрон</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Лучшие паттерны публикаций</CardTitle>
            <CardDescription>Топ-контент через лучшие платформы и временные окна.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[0.75rem] uppercase tracking-[0.08em] text-muted-foreground">Паттерн #1</p>
              <p className="mt-1 text-[0.9375rem] font-medium">
                {data.recommendations.bestPlatform} в {data.recommendations.bestHour}
              </p>
              <p className="mt-1 text-[0.8125rem] text-muted-foreground">Используйте этот слот для главной недельной публикации.</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[0.75rem] uppercase tracking-[0.08em] text-muted-foreground">Паттерн #2</p>
              <p className="mt-1 text-[0.9375rem] font-medium">
                {topPlatforms[1]?.[0] ?? 'Вторая платформа'} + {topHours[1]?.[0] ?? 'следующий лучший час'}:00
              </p>
              <p className="mt-1 text-[0.8125rem] text-muted-foreground">Подходит для репоста и вариаций контента.</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[0.75rem] uppercase tracking-[0.08em] text-muted-foreground">Давление черновиков</p>
              <p className="mt-1 text-[0.9375rem] font-medium">{draftRatio}% контента в черновиках</p>
              <p className="mt-1 text-[0.8125rem] text-muted-foreground">Конвертируйте 1-2 черновика в scheduled posts сегодня.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI-рекомендации</CardTitle>
            <CardDescription>Умные, короткие и actionable шаги.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-border bg-secondary p-4">
              <p className="inline-flex items-center gap-2 text-[0.9375rem] font-medium">
                <Sparkles className="h-4 w-4 text-primary" />
                Публикация в высокоэффективный слот
              </p>
              <p className="mt-1 text-[0.875rem] text-muted-foreground">
                Запланируйте публикацию в {data.recommendations.bestHour} для {data.recommendations.bestPlatform}.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-secondary p-4">
              <p className="inline-flex items-center gap-2 text-[0.9375rem] font-medium">
                <TrendingUp className="h-4 w-4 text-primary" />
                Масштабируйте успешный формат
              </p>
              <p className="mt-1 text-[0.875rem] text-muted-foreground">{data.recommendations.suggestions[0] ?? 'Соберите больше данных для точного совета.'}</p>
            </div>
            <ContextualAiSuggestion
              text={`Этот пост может лучше зайти в ${data.recommendations.bestPlatform} в ${data.recommendations.bestHour}.`}
            />
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <a href="/api/analytics/export?format=csv">Скачать CSV</a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href="/api/analytics/export?format=json">Скачать JSON</a>
              </Button>
            </div>
            <Button className="w-full justify-between" asChild>
              <Link href="/dashboard/generate">
                Создать следующую сильную публикацию
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
