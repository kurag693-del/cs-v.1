'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/lib/auth/hooks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, Sparkles, TrendingUp } from 'lucide-react'
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
    note: string
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

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
      return
    }
    if (user) {
      fetch(`/api/analytics?userId=${user.id}`)
        .then((res) => res.json())
        .then((result) => setData(result.data))
        .finally(() => setLoadingData(false))
    }
  }, [loading, user, router])

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

  if (!user || !data) return null

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
          <Badge variant="secondary">Calm Intelligence</Badge>
        </div>

        <Card>
          <CardHeader className="space-y-3">
            <CardTitle>Minimal Intelligence Dashboard</CardTitle>
            <CardDescription>Сначала ключевые инсайты, затем действия. Без BI-перегруза.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-[0.75rem] uppercase tracking-[0.08em] text-muted-foreground">Growth</p>
              <p className="mt-2 text-[1.75rem] font-semibold tracking-[-0.02em]">{publishedRatio}%</p>
              <p className="text-[0.8125rem] text-muted-foreground">Доля опубликованного контента</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-[0.75rem] uppercase tracking-[0.08em] text-muted-foreground">Reach</p>
              <p className="mt-2 text-[1.75rem] font-semibold tracking-[-0.02em]">{reachScore}</p>
              <p className="text-[0.8125rem] text-muted-foreground">Суммарный вклад топ-платформ</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-[0.75rem] uppercase tracking-[0.08em] text-muted-foreground">Engagement</p>
              <p className="mt-2 text-[1.75rem] font-semibold tracking-[-0.02em]">{engagementScore}</p>
              <p className="text-[0.8125rem] text-muted-foreground">Активность в лучших временных слотах</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Reach by Platform</CardTitle>
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
            <CardTitle>Engagement Time Slots</CardTitle>
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

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Best-Performing Posts</CardTitle>
            <CardDescription>Топ-контент через лучшие платформы и временные окна.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[0.75rem] uppercase tracking-[0.08em] text-muted-foreground">Top Pattern #1</p>
              <p className="mt-1 text-[0.9375rem] font-medium">
                {data.recommendations.bestPlatform} at {data.recommendations.bestHour}
              </p>
              <p className="mt-1 text-[0.8125rem] text-muted-foreground">Используйте этот слот для главного weekly post.</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[0.75rem] uppercase tracking-[0.08em] text-muted-foreground">Top Pattern #2</p>
              <p className="mt-1 text-[0.9375rem] font-medium">
                {topPlatforms[1]?.[0] ?? 'Secondary platform'} + {topHours[1]?.[0] ?? 'next best hour'}:00
              </p>
              <p className="mt-1 text-[0.8125rem] text-muted-foreground">Подходит для репоста и вариаций контента.</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[0.75rem] uppercase tracking-[0.08em] text-muted-foreground">Draft Pressure</p>
              <p className="mt-1 text-[0.9375rem] font-medium">{draftRatio}% контента в черновиках</p>
              <p className="mt-1 text-[0.8125rem] text-muted-foreground">Конвертируйте 1-2 черновика в scheduled posts сегодня.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Recommendations</CardTitle>
            <CardDescription>Умные, короткие и actionable шаги.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-border bg-secondary p-4">
              <p className="inline-flex items-center gap-2 text-[0.9375rem] font-medium">
                <Sparkles className="h-4 w-4 text-primary" />
                Publish in high-impact slot
              </p>
              <p className="mt-1 text-[0.875rem] text-muted-foreground">
                Запланируйте публикацию в {data.recommendations.bestHour} для {data.recommendations.bestPlatform}.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-secondary p-4">
              <p className="inline-flex items-center gap-2 text-[0.9375rem] font-medium">
                <TrendingUp className="h-4 w-4 text-primary" />
                Scale winning format
              </p>
              <p className="mt-1 text-[0.875rem] text-muted-foreground">{data.recommendations.note}</p>
            </div>
            <ContextualAiSuggestion
              text={`Этот пост может лучше зайти в ${data.recommendations.bestPlatform} в ${data.recommendations.bestHour}.`}
            />
            <Button className="w-full justify-between" asChild>
              <Link href="/dashboard/generate">
                Create next high-performing post
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
