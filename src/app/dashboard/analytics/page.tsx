'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/lib/auth/hooks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

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

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard">Назад</Link>
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Базовая аналитика</CardTitle>
            <CardDescription>MVP аналитика публикаций и простые рекомендации</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Всего постов</p>
              <p className="text-2xl font-semibold">{data.totals.posts}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Опубликовано</p>
              <p className="text-2xl font-semibold">{data.totals.published}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Черновики</p>
              <p className="text-2xl font-semibold">{data.totals.drafts}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Рекомендации времени публикации</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>
              Лучшее время: <strong>{data.recommendations.bestHour}</strong>
            </p>
            <p>
              Лучшая платформа: <strong>{data.recommendations.bestPlatform}</strong>
            </p>
            <p className="text-sm text-muted-foreground">{data.recommendations.note}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
