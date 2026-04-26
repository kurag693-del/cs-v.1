'use client'

import { useSession } from '@/lib/auth/hooks'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowRight,
  AtSign,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Play,
  Sparkles,
  TrendingUp,
  Wand2,
} from 'lucide-react'
import { ContextualAiSuggestion } from '@/components/ui/contextual-ai-suggestion'

export default function DashboardPage() {
  const { user, session, loading } = useSession()
  const router = useRouter()
  const [logs, setLogs] = useState<string[]>([])

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [loading, user, router])

  const testMiddleware = async () => {
    try {
      const res = await fetch('/api/test-auth', { credentials: 'include' })
      const raw = await res.text()
      const parsed = raw ? JSON.parse(raw) : { success: false, error: 'Empty response body' }
      setLogs((prev) => [...prev, `[${new Date().toISOString()}] ${JSON.stringify(parsed)}`])
    } catch (error) {
      setLogs((prev) => [
        ...prev,
        `[${new Date().toISOString()}] ${JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Invalid response format',
        })}`,
      ])
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-52 w-full rounded-2xl" />
          <Skeleton className="h-52 w-full rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const upcomingPosts = [
    { title: 'Пост: 5 AI-ошибок в контенте', time: 'Сегодня, 18:30', channel: 'Instagram' },
    { title: 'Карусель: Кейсы клиентов Q2', time: 'Завтра, 10:00', channel: 'LinkedIn' },
    { title: 'Short: контент-план на май', time: 'Вт, 12:00', channel: 'YouTube' },
  ] as const

  const aiSuggestions = [
    'Сделать репост лучшего поста недели в формате короткого видео.',
    'Подготовить экспертный тред по теме, где растет вовлеченность.',
    'Обновить tone-of-voice для продуктовых публикаций на следующую неделю.',
  ] as const

  return (
    <div className="space-y-6 md:space-y-8">
      <section className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
        <Card className="border-primary/20 bg-card">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Badge variant="secondary" className="w-fit">
                Today Focus
              </Badge>
              <span className="text-[0.8125rem] text-muted-foreground">Sunday plan</span>
            </div>
            <div>
              <CardTitle>Что нужно сделать прямо сейчас</CardTitle>
              <CardDescription className="mt-1.5">
                Подготовить и запланировать 1 ключевой пост до 18:30, чтобы сохранить ритм публикаций.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-border bg-secondary p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[0.9375rem] font-medium">Finalize draft: “5 AI-ошибок в контенте”</p>
                  <p className="mt-1 text-[0.8125rem] text-muted-foreground">Оценка: 35 мин • Приоритет: высокий</p>
                </div>
                <Badge>Now</Badge>
              </div>
            </div>
            <ContextualAiSuggestion text="Этот пост может лучше зайти в Telegram вечером, после 19:00." />
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/dashboard/generate">
                  Перейти к генерации
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/dashboard/calendar">Открыть календарь</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Badge variant="outline" className="w-fit">
              Quick Create CTA
            </Badge>
            <CardTitle className="mt-3">Создать контент за 2 минуты</CardTitle>
            <CardDescription>Быстрый запуск для поста, треда или сценария Reels.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <Button className="w-full justify-start gap-2" asChild>
              <Link href="/dashboard/generate">
                <Wand2 className="h-4 w-4" />
                Новый AI draft
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" asChild>
              <Link href="/dashboard/brands">
                <Sparkles className="h-4 w-4" />
                Обновить бренд-профиль
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <Badge variant="secondary" className="w-fit">
              Upcoming Posts
            </Badge>
            <CardTitle className="mt-3">Ближайшие публикации</CardTitle>
            <CardDescription>Только критичные слоты на ближайшие 72 часа.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {upcomingPosts.map((post) => (
              <div key={post.title} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3.5">
                <div>
                  <p className="text-[0.9375rem] font-medium">{post.title}</p>
                  <p className="mt-1 text-[0.8125rem] text-muted-foreground">{post.channel}</p>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1 text-[0.8125rem] text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" />
                  {post.time}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Badge variant="outline" className="w-fit">
              Connected Accounts
            </Badge>
            <CardTitle className="mt-3">Площадки</CardTitle>
            <CardDescription>Статус подключений для автопубликации.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-2.5">
                <AtSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-[0.9375rem]">Instagram</span>
              </div>
              <Badge variant="secondary">Connected</Badge>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-2.5">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span className="text-[0.9375rem]">LinkedIn</span>
              </div>
              <Badge variant="secondary">Connected</Badge>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-2.5">
                <Play className="h-4 w-4 text-muted-foreground" />
                <span className="text-[0.9375rem]">YouTube</span>
              </div>
              <Badge variant="outline">Pending</Badge>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <Badge variant="secondary" className="w-fit">
              AI Suggestions
            </Badge>
            <CardTitle className="mt-3">Рекомендации от AI</CardTitle>
            <CardDescription>Контекстные идеи на основе текущего темпа публикаций.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {aiSuggestions.map((suggestion) => (
              <div key={suggestion} className="flex items-start gap-2.5 rounded-xl border border-border bg-card p-3.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-[0.9375rem] text-foreground">{suggestion}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Badge variant="outline" className="w-fit">
              Weekly Content Plan
            </Badge>
            <CardTitle className="mt-3">План недели</CardTitle>
            <CardDescription>4 из 6 слотов уже заполнены и готовы к публикации.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[0.875rem]">
                <span className="text-muted-foreground">Weekly completion</span>
                <span className="font-medium">67%</span>
              </div>
              <Progress value={67} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-[0.875rem]">
              <div className="rounded-lg bg-secondary px-3 py-2">Mon: Ready</div>
              <div className="rounded-lg bg-secondary px-3 py-2">Tue: Draft</div>
              <div className="rounded-lg bg-secondary px-3 py-2">Wed: Ready</div>
              <div className="rounded-lg bg-secondary px-3 py-2">Thu: Empty</div>
            </div>
            <Button variant="outline" className="w-full justify-start gap-2" asChild>
              <Link href="/dashboard/calendar">
                <CalendarDays className="h-4 w-4" />
                Открыть контент-календарь
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <Badge variant="secondary" className="w-fit">
              Performance Snapshot
            </Badge>
            <CardTitle className="mt-3">Ключевой срез эффективности</CardTitle>
            <CardDescription>Минимум метрик для принятия решений без шумного дашборда.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-3.5">
              <p className="text-[0.8125rem] text-muted-foreground">Engagement</p>
              <p className="mt-1 text-xl font-semibold tracking-[-0.02em]">6.8%</p>
              <p className="mt-1 inline-flex items-center gap-1 text-[0.8125rem] text-primary">
                <TrendingUp className="h-3.5 w-3.5" />
                +0.9% vs last week
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3.5">
              <p className="text-[0.8125rem] text-muted-foreground">Published</p>
              <p className="mt-1 text-xl font-semibold tracking-[-0.02em]">12</p>
              <p className="mt-1 text-[0.8125rem] text-muted-foreground">за 7 дней</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3.5">
              <p className="text-[0.8125rem] text-muted-foreground">Best slot</p>
              <p className="mt-1 text-xl font-semibold tracking-[-0.02em]">18:30</p>
              <p className="mt-1 text-[0.8125rem] text-muted-foreground">Instagram / Mon-Thu</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Session & Access</CardTitle>
            <CardDescription>Системная панель для текущей авторизации.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-[0.8125rem] text-muted-foreground">Email</p>
              <p className="mt-1 text-[0.9375rem] font-medium">{user.email}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-[0.8125rem] text-muted-foreground">Session expires</p>
              <p className="mt-1 text-[0.9375rem] font-medium">
                {session?.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : 'N/A'}
              </p>
            </div>
            <Button variant="outline" onClick={testMiddleware} className="w-full">
              Test Auth Headers
            </Button>
            {logs.length > 0 && (
              <pre className="max-h-36 overflow-auto rounded-xl border border-border bg-secondary p-3 text-[0.75rem] text-muted-foreground">
                {logs.map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
              </pre>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
