'use client'

import { useSession } from '@/lib/auth/hooks'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { PostCalendar } from '@/components/features/PostCalendar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { addDays, startOfWeek } from 'date-fns'
import { getCalendarPosts, getDrafts } from '@/lib/posts/actions'
import { CreatePostForm } from '@/components/features/CreatePostForm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CalendarClock, CalendarDays, CalendarRange, CircleDot, Clock3, GripVertical, ListFilter, Rocket, Send } from 'lucide-react'
import { cn } from '@/lib/utils'

type ViewMode = 'week' | 'month' | 'list'

const viewModes: Array<{ id: ViewMode; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'week', label: 'Week', icon: CalendarRange },
  { id: 'month', label: 'Month', icon: CalendarDays },
  { id: 'list', label: 'List', icon: ListFilter },
]

export default function CalendarPage() {
  const { user, session, loading } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [posts, setPosts] = useState<any[]>([])
  const [drafts, setDrafts] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false)
  const [publishJobsProcessed, setPublishJobsProcessed] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('week')

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [loading, user, router])

  useEffect(() => {
    if (user) {
      fetchPosts()
    }
  }, [user])

  const fetchPosts = async () => {
    try {
      const startDate = startOfWeek(new Date(), { weekStartsOn: 1 })
      const endDate = addDays(startDate, 6)
      
      const [calendarResult, draftsResult] = await Promise.all([
        getCalendarPosts(user?.id || '', startDate, endDate),
        getDrafts(user?.id || ''),
      ])

      if (calendarResult.success) {
        setPosts(calendarResult.data || [])
      } else {
        toast({
          title: 'Ошибка',
          description: calendarResult.error,
          variant: 'destructive',
        })
      }

      if (draftsResult.success) {
        setDrafts(draftsResult.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch posts:', err)
    } finally {
      setLoadingData(false)
    }
  }

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-10 w-64" />
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-96 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const scheduledCount = posts.filter((post) => post.status === 'SCHEDULED').length
  const publishedCount = posts.filter((post) => post.status === 'PUBLISHED').length
  const queuedCount = posts.filter((post) => post.status === 'SCHEDULED' || post.status === 'DRAFT').length

  const statusClassMap: Record<string, string> = {
    DRAFT: 'bg-secondary text-secondary-foreground',
    SCHEDULED: 'bg-accent text-accent-foreground',
    PUBLISHED: 'bg-primary text-primary-foreground',
    FAILED: 'bg-destructive text-destructive-foreground',
    ARCHIVED: 'bg-secondary text-muted-foreground',
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <Card className="border-border bg-card">
        <CardContent className="flex flex-col gap-5 p-5 md:flex-row md:items-end md:justify-between md:p-7">
          <div className="space-y-2">
            <Badge variant="secondary" className="w-fit">
              Content Planner
            </Badge>
            <div>
              <p className="text-[1.5rem] font-semibold tracking-[-0.02em]">Календарь публикаций</p>
              <p className="mt-1 text-[0.9375rem] text-muted-foreground">
                Простое и мощное планирование: расписание, очередь контента и статусы публикации в одном ритме.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-border bg-background p-1">
              {viewModes.map((mode) => {
                const Icon = mode.icon
                const isActive = mode.id === viewMode
                return (
                  <button
                    key={mode.id}
                    onClick={() => setViewMode(mode.id)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium transition-all',
                      isActive ? 'bg-secondary text-foreground shadow-[var(--shadow-xs)]' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {mode.label}
                  </button>
                )
              })}
            </div>

            <Button
              variant="outline"
              onClick={async () => {
                const res = await fetch('/api/publish/dispatch', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId: user.id }),
                })
                const payload = await res.json()
                if (payload.success) {
                  setPublishJobsProcessed(payload.data.processed)
                }
              }}
            >
              <Send className="h-4 w-4" />
              Запустить очередь публикаций
            </Button>
            <Button onClick={() => setIsCreateFormOpen(true)}>
              <Rocket className="h-4 w-4" />
              + Новый пост
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 md:flex md:items-center md:gap-2">
            <div className="rounded-xl border border-border bg-background px-3 py-2">
              <p className="text-[0.6875rem] uppercase tracking-[0.08em] text-muted-foreground">Scheduled</p>
              <p className="mt-1 text-[1.125rem] font-semibold">{scheduledCount}</p>
            </div>
            <div className="rounded-xl border border-border bg-background px-3 py-2">
              <p className="text-[0.6875rem] uppercase tracking-[0.08em] text-muted-foreground">Queue</p>
              <p className="mt-1 text-[1.125rem] font-semibold">{queuedCount}</p>
            </div>
            <div className="rounded-xl border border-border bg-background px-3 py-2">
              <p className="text-[0.6875rem] uppercase tracking-[0.08em] text-muted-foreground">Published</p>
              <p className="mt-1 text-[1.125rem] font-semibold">{publishedCount}</p>
            </div>
          </div>
          </CardContent>
      </Card>

      {publishJobsProcessed !== null && (
        <p className="text-[0.875rem] text-muted-foreground">Обработано задач публикации: {publishJobsProcessed}</p>
      )}

      {isCreateFormOpen && (
        <Card>
          <CardContent className="pt-6">
            <CreatePostForm
              userId={user.id}
              onSuccess={() => {
                fetchPosts()
                setIsCreateFormOpen(false)
              }}
              onCancel={() => setIsCreateFormOpen(false)}
            />
          </CardContent>
        </Card>
      )}

      {viewMode === 'week' ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="inline-flex items-center gap-2 text-[1.125rem]">
              <CalendarRange className="h-4 w-4 text-primary" />
              Week View
            </CardTitle>
            <CardDescription>Планируйте неделю с drag-and-drop feel и чистой видимостью расписания.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <PostCalendar
              posts={posts}
              userId={user.id}
              onPostClick={(post) => {
                console.log('Post clicked:', post)
              }}
            />
          </CardContent>
        </Card>
      ) : null}

      {viewMode === 'month' ? (
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2 text-[1.125rem]">
              <CalendarDays className="h-4 w-4 text-primary" />
              Month View
            </CardTitle>
            <CardDescription>Обзор публикационной нагрузки и ключевых дней на месяц.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-[0.8125rem] text-muted-foreground">Week {index + 1}</p>
                  <p className="mt-1 text-[1.125rem] font-semibold">{Math.max(1, scheduledCount - index)}</p>
                  <p className="text-[0.8125rem] text-muted-foreground">scheduled posts</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[0.875rem] text-muted-foreground">
              Месячный режим фокусируется на стратегическом ритме. Переносы и детализация доступны в Week View.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {viewMode === 'list' ? (
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2 text-[1.125rem]">
              <ListFilter className="h-4 w-4 text-primary" />
              List View
            </CardTitle>
            <CardDescription>Очередь контента с платформой, статусом публикации и авто-публикацией.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {posts.length === 0 ? (
              <p className="text-[0.9375rem] text-muted-foreground">Постов в календаре пока нет.</p>
            ) : (
              posts.map((post) => (
                <div key={post.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate text-[0.9375rem] font-medium">{post.title ?? 'Без заголовка'}</p>
                      <p className="mt-1 text-[0.8125rem] text-muted-foreground">
                        {post.scheduledAt ? new Date(post.scheduledAt).toLocaleString() : 'Дата не назначена'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{post.platform ?? 'Unknown'}</Badge>
                    <Badge className={cn(statusClassMap[post.status] ?? 'bg-secondary text-secondary-foreground')}>
                      {post.status ?? 'DRAFT'}
                    </Badge>
                    <span className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2 py-1 text-[0.75rem] text-muted-foreground">
                      <Clock3 className="h-3 w-3" />
                      {post.autoPublish ? 'Auto-publish ON' : 'Manual publish'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2 text-[1.125rem]">
              <CalendarClock className="h-4 w-4 text-primary" />
              Content Queue
            </CardTitle>
            <CardDescription>Черновики и контент в очереди на публикацию.</CardDescription>
          </CardHeader>
          <CardContent>
            {drafts.length === 0 ? (
              <p className="text-[0.9375rem] text-muted-foreground">Черновиков пока нет.</p>
            ) : (
              <div className="space-y-3">
                {drafts.slice(0, 8).map((draft) => (
                  <div key={draft.id} className="rounded-xl border border-border bg-card p-3.5">
                    <p className="text-[0.9375rem] font-medium">{draft.title ?? 'Без заголовка'}</p>
                    <p className="mt-1 line-clamp-2 text-[0.875rem] text-muted-foreground">{draft.content}</p>
                    <p className="mt-2 text-[0.75rem] text-muted-foreground">
                      Платформа: {draft.platform}
                      {draft.brand?.name ? ` | Бренд: ${draft.brand.name}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2 text-[1.125rem]">
              <CircleDot className="h-4 w-4 text-primary" />
              Publishing State
            </CardTitle>
            <CardDescription>Спокойные индикаторы статуса и быстрый контроль состояния.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
                <span className="text-[0.875rem]">Черновик</span>
                <Badge className={statusClassMap.DRAFT}>DRAFT</Badge>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
                <span className="text-[0.875rem]">Запланирован</span>
                <Badge className={statusClassMap.SCHEDULED}>SCHEDULED</Badge>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
                <span className="text-[0.875rem]">Опубликован</span>
                <Badge className={statusClassMap.PUBLISHED}>PUBLISHED</Badge>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
                <span className="text-[0.875rem]">Ошибка</span>
                <Badge className={statusClassMap.FAILED}>FAILED</Badge>
              </div>
            </div>
            <p className="text-[0.8125rem] text-muted-foreground">
              Подсказка: для точного перепланирования используйте Week View — он лучше всего передает drag-and-drop workflow.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
