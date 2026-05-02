'use client'

import { useSession } from '@/lib/auth/hooks'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { PostApprovalDialog } from '@/components/features/PostApprovalDialog'
import { PostCalendar } from '@/components/features/PostCalendar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { getCalendarPostsWithFilters } from '@/lib/posts/actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CalendarRange, Clock3, Download, FileCheck, GripVertical, ListFilter, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getBrands } from '@/lib/brands/actions'
import { type ContentStatus, type Platform } from '@prisma/client'
import { getApprovalStatus } from '@/lib/approval/workflow'

type ViewMode = 'week' | 'list'
type CalendarStatusFilter = ContentStatus | 'ALL'
type CalendarPlatformFilter = Platform | 'ALL'
type CalendarApprovalFilter = 'ALL' | 'DRAFT' | 'REVIEW_PENDING' | 'APPROVED' | 'REJECTED'
type BrandLite = { id: string; name: string }

const viewModes: Array<{ id: ViewMode; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'week', label: 'Неделя', icon: CalendarRange },
  { id: 'list', label: 'Список', icon: ListFilter },
]

export default function CalendarPage() {
  const { user, loading } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [posts, setPosts] = useState<any[]>([])
  const [brands, setBrands] = useState<BrandLite[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [publishJobsProcessed, setPublishJobsProcessed] = useState<number | null>(null)
  const [isDispatchingQueue, setIsDispatchingQueue] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [statusFilter, setStatusFilter] = useState<CalendarStatusFilter>('ALL')
  const [platformFilter, setPlatformFilter] = useState<CalendarPlatformFilter>('ALL')
  const [brandFilter, setBrandFilter] = useState<string>('ALL')
  const [approvalFilter, setApprovalFilter] = useState<CalendarApprovalFilter>('ALL')
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false)
  const [approvalInitialPostId, setApprovalInitialPostId] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [loading, user, router])

  useEffect(() => {
    if (user) {
      fetchPosts(user.id, {
        status: statusFilter,
        platform: platformFilter,
        brandId: brandFilter,
      })
      fetchBrands(user.id)
    }
  }, [user, statusFilter, platformFilter, brandFilter])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(new Date())
    }, 15000)

    return () => window.clearInterval(intervalId)
  }, [])

  const reviewPendingCount = useMemo(
    () =>
      posts.filter((post) => getApprovalStatus((post as Record<string, unknown>).metadata) === 'REVIEW_PENDING').length,
    [posts]
  )

  const fetchPosts = async (
    userId: string,
    filters: { status: CalendarStatusFilter; platform: CalendarPlatformFilter; brandId: string }
  ) => {
    try {
      const calendarResult = await getCalendarPostsWithFilters(userId, {
        status: filters.status === 'ALL' ? undefined : filters.status,
        platform: filters.platform === 'ALL' ? undefined : filters.platform,
        brandId: filters.brandId === 'ALL' ? undefined : filters.brandId,
      })

      if (calendarResult.success) {
        setPosts(calendarResult.data || [])
      } else {
        toast({
          title: 'Ошибка',
          description: calendarResult.error,
          variant: 'destructive',
        })
      }
    } catch (err) {
      console.error('Failed to fetch posts:', err)
    } finally {
      setLoadingData(false)
    }
  }

  const fetchBrands = async (userId: string) => {
    const result = await getBrands(userId)
    if (result.success) {
      setBrands((result.data ?? []).map((item) => ({ id: item.id, name: item.name })))
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

  const filteredPosts =
    approvalFilter === 'ALL'
      ? posts
      : posts.filter((post) => getApprovalStatus((post as Record<string, unknown>).metadata) === approvalFilter)
  const scheduledCount = filteredPosts.filter((post) => post.status === 'SCHEDULED').length
  const publishedCount = filteredPosts.filter((post) => post.status === 'PUBLISHED').length
  const queuedCount = filteredPosts.filter((post) => post.status === 'SCHEDULED' || post.status === 'DRAFT').length
  const now = currentTime
  const dispatchableNowCount = filteredPosts.filter((post) => {
    if (post.status !== 'SCHEDULED' || !post.scheduledAt) return false
    const scheduledAt = new Date(post.scheduledAt)
    return !Number.isNaN(scheduledAt.getTime()) && scheduledAt <= now
  }).length
  const canDispatchQueue = dispatchableNowCount > 0

  const statusClassMap: Record<string, string> = {
    DRAFT: 'bg-secondary text-secondary-foreground',
    SCHEDULED: 'bg-accent text-accent-foreground',
    PUBLISHED: 'bg-primary text-primary-foreground',
    FAILED: 'bg-destructive text-destructive-foreground',
    ARCHIVED: 'bg-secondary text-muted-foreground',
  }

  const extractPostTitle = (post: Record<string, unknown>): string => {
    const metadata = post.metadata
    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
      const title = (metadata as Record<string, unknown>).title
      if (typeof title === 'string' && title.trim().length > 0) {
        return title
      }
    }
    return 'Без заголовка'
  }

  const extractDzenFallbackMarkdown = (post: Record<string, unknown>): string | null => {
    const metadata = post.metadata
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null

    const fallback = (metadata as Record<string, unknown>).fallback
    if (!fallback || typeof fallback !== 'object' || Array.isArray(fallback)) return null

    const markdown = (fallback as Record<string, unknown>).markdown
    return typeof markdown === 'string' && markdown.trim().length > 0 ? markdown : null
  }

  const hasDzenFallback = (post: Record<string, unknown>): boolean => {
    const metadata = post.metadata
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false
    const fallback = (metadata as Record<string, unknown>).fallback
    if (!fallback || typeof fallback !== 'object' || Array.isArray(fallback)) return false
    return (fallback as Record<string, unknown>).used === true
  }

  const downloadDzenMarkdown = (post: Record<string, unknown>) => {
    const markdown = extractDzenFallbackMarkdown(post)
    if (!markdown) {
      toast({
        title: 'Markdown недоступен',
        description: 'Для этой публикации fallback-черновик не найден.',
        variant: 'destructive',
      })
      return
    }

    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const baseName = post.id != null && String(post.id).length > 0 ? String(post.id) : 'draft'
    link.download = `dzen-export-${baseName}.md`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
  const getApprovalBadgeClass = (status: string): string => {
    if (status === 'APPROVED') return 'bg-green-100 text-green-700'
    if (status === 'REVIEW_PENDING') return 'bg-amber-100 text-amber-700'
    if (status === 'REJECTED') return 'bg-red-100 text-red-700'
    return 'bg-secondary text-secondary-foreground'
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <Card className="border-border bg-card">
        <CardContent className="space-y-4 p-5 md:space-y-5 md:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
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

            <div className="grid grid-cols-2 gap-2 md:flex md:items-center md:gap-2">
              <div className="rounded-xl border border-border bg-background px-3 py-2">
                <p className="text-[0.6875rem] uppercase tracking-[0.08em] text-muted-foreground">Запланировано</p>
                <p className="mt-1 text-[1.125rem] font-semibold">{scheduledCount}</p>
              </div>
              <div className="rounded-xl border border-border bg-background px-3 py-2">
                <p className="text-[0.6875rem] uppercase tracking-[0.08em] text-muted-foreground">В очереди</p>
                <p className="mt-1 text-[1.125rem] font-semibold">{queuedCount}</p>
              </div>
              <div className="rounded-xl border border-border bg-background px-3 py-2">
                <p className="text-[0.6875rem] uppercase tracking-[0.08em] text-muted-foreground">Опубликовано</p>
                <p className="mt-1 text-[1.125rem] font-semibold">{publishedCount}</p>
              </div>
              <div
                className={cn(
                  'rounded-xl border px-3 py-2',
                  dispatchableNowCount > 0 ? 'border-primary/40 bg-primary/5' : 'border-border bg-background'
                )}
              >
                <p className="text-[0.6875rem] uppercase tracking-[0.08em] text-muted-foreground">Готово к публикации сейчас</p>
                <p className={cn('mt-1 text-[1.125rem] font-semibold', dispatchableNowCount > 0 ? 'text-primary' : '')}>
                  {dispatchableNowCount}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
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
                type="button"
                variant="secondary"
                className="gap-2"
                onClick={() => {
                  setApprovalInitialPostId(null)
                  setApprovalDialogOpen(true)
                }}
              >
                <FileCheck className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Согласование постов</span>
                <span className="sm:hidden">Согласование</span>
                {reviewPendingCount > 0 ? (
                  <Badge variant="destructive" className="min-w-6 px-1.5 text-[0.6875rem]">
                    {reviewPendingCount}
                  </Badge>
                ) : null}
              </Button>

              <Button
                variant="outline"
                disabled={isDispatchingQueue || !canDispatchQueue}
                onClick={async () => {
                  try {
                    setIsDispatchingQueue(true)
                    const res = await fetch('/api/publish/dispatch', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userId: user.id }),
                    })
                    const payload = await res.json()
                    if (!res.ok || !payload.success) {
                      toast({
                        title: 'Ошибка',
                        description: payload.error?.message ?? 'Не удалось запустить очередь публикаций',
                        variant: 'destructive',
                      })
                      return
                    }
                    setPublishJobsProcessed(payload.data.processed)
                    await fetchPosts(user.id, {
                      status: statusFilter,
                      platform: platformFilter,
                      brandId: brandFilter,
                    })
                    toast({
                      title: 'Очередь обработана',
                      description:
                        payload.data.dzenFallbackCount > 0
                          ? `Для ${payload.data.dzenFallbackCount} задач Дзена сработал fallback: Markdown + "Экспорт в Дзен" + RSS-импорт.`
                          : payload.data.failedJobs > 0
                          ? `Часть задач завершилась ошибкой (${payload.data.failedJobs}). Проверьте подключения в "Интеграции платформ".`
                          : payload.data.processed > 0
                            ? payload.data.mode === 'production'
                              ? `Обработано: ${payload.data.processed} (посты: ${payload.data.processedPosts}, jobs: ${payload.data.processedJobs})`
                              : `Sandbox: обработано ${payload.data.processed}. Статусы обновляются, но в реальный Telegram посты не отправляются.`
                            : 'Нет задач к публикации: обрабатываются только SCHEDULED-посты с датой не позже текущего времени.',
                    })
                  } catch (error: unknown) {
                    toast({
                      title: 'Ошибка',
                      description: error instanceof Error ? error.message : 'Ошибка запуска очереди',
                      variant: 'destructive',
                    })
                  } finally {
                    setIsDispatchingQueue(false)
                  }
                }}
              >
                <Send className="h-4 w-4" />
                {isDispatchingQueue
                  ? 'Запуск...'
                  : !canDispatchQueue
                  ? 'Нет задач к запуску'
                  : `Запустить очередь (${dispatchableNowCount})`}
              </Button>
            </div>

            <div className="grid w-full gap-2 sm:grid-cols-2 xl:w-auto xl:grid-cols-4">
            <Select value={platformFilter} onValueChange={(value) => setPlatformFilter(value as CalendarPlatformFilter)}>
              <SelectTrigger className="h-9 w-full xl:w-[180px]">
                <SelectValue placeholder="Платформа" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Все платформы</SelectItem>
                <SelectItem value="TELEGRAM">Telegram</SelectItem>
                <SelectItem value="VK">VK</SelectItem>
                <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                <SelectItem value="TIKTOK">TikTok</SelectItem>
                <SelectItem value="YOUTUBE">YouTube</SelectItem>
                <SelectItem value="LINKEDIN">LinkedIn</SelectItem>
                <SelectItem value="FACEBOOK">Facebook</SelectItem>
                <SelectItem value="TWITTER">X/Twitter</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as CalendarStatusFilter)}>
              <SelectTrigger className="h-9 w-full xl:w-[180px]">
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Все статусы</SelectItem>
                <SelectItem value="DRAFT">DRAFT</SelectItem>
                <SelectItem value="SCHEDULED">SCHEDULED</SelectItem>
                <SelectItem value="PUBLISHED">PUBLISHED</SelectItem>
                <SelectItem value="ARCHIVED">ARCHIVED</SelectItem>
              </SelectContent>
            </Select>

            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger className="h-9 w-full xl:w-[220px]">
                <SelectValue placeholder="Бренд" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Все бренды</SelectItem>
                {brands.map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>
                    {brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={approvalFilter} onValueChange={(value) => setApprovalFilter(value as CalendarApprovalFilter)}>
              <SelectTrigger className="h-9 w-full xl:w-[220px]">
                <SelectValue placeholder="Approval" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Approval: все</SelectItem>
                <SelectItem value="DRAFT">Approval: DRAFT</SelectItem>
                <SelectItem value="REVIEW_PENDING">Approval: REVIEW_PENDING</SelectItem>
                <SelectItem value="APPROVED">Approval: APPROVED</SelectItem>
                <SelectItem value="REJECTED">Approval: REJECTED</SelectItem>
              </SelectContent>
            </Select>
          </div>
          </div>
        </CardContent>
      </Card>

      <PostApprovalDialog
        open={approvalDialogOpen}
        onOpenChange={(nextOpen) => {
          setApprovalDialogOpen(nextOpen)
          if (!nextOpen) {
            setApprovalInitialPostId(null)
          }
        }}
        posts={posts}
        initialPostId={approvalInitialPostId}
        onCompleted={async () => {
          await fetchPosts(user.id, {
            status: statusFilter,
            platform: platformFilter,
            brandId: brandFilter,
          })
        }}
      />

      {publishJobsProcessed !== null && (
        <p className="text-[0.875rem] text-muted-foreground">Обработано задач публикации: {publishJobsProcessed}</p>
      )}

      {viewMode === 'week' ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="inline-flex items-center gap-2 text-[1.125rem]">
              <CalendarRange className="h-4 w-4 text-primary" />
              Вид по неделе
            </CardTitle>
            <CardDescription>Планируйте неделю с drag-and-drop feel и чистой видимостью расписания.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <PostCalendar
              posts={filteredPosts}
              onPostScheduled={() =>
                fetchPosts(user.id, {
                  status: statusFilter,
                  platform: platformFilter,
                  brandId: brandFilter,
                })
              }
              onOpenPostApproval={(postId) => {
                setApprovalInitialPostId(postId)
                setApprovalDialogOpen(true)
              }}
            />
          </CardContent>
        </Card>
      ) : null}

      {viewMode === 'list' ? (
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2 text-[1.125rem]">
              <ListFilter className="h-4 w-4 text-primary" />
              Вид списком
            </CardTitle>
            <CardDescription>Очередь контента с платформой, статусом публикации и авто-публикацией.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {filteredPosts.length === 0 ? (
              <p className="text-[0.9375rem] text-muted-foreground">Постов в календаре пока нет.</p>
            ) : (
              filteredPosts.map((post) => (
                <div key={post.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate text-[0.9375rem] font-medium">{extractPostTitle(post as Record<string, unknown>)}</p>
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
                    <Badge className={cn('text-[0.6875rem]', getApprovalBadgeClass(getApprovalStatus((post as Record<string, unknown>).metadata)))}>
                      Approval: {getApprovalStatus((post as Record<string, unknown>).metadata)}
                    </Badge>
                    {hasDzenFallback(post as Record<string, unknown>) ? (
                      <Badge variant="secondary" className="text-[0.6875rem]">
                        Dzen fallback
                      </Badge>
                    ) : null}
                    <span className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2 py-1 text-[0.75rem] text-muted-foreground">
                      <Clock3 className="h-3 w-3" />
                      {post.autoPublish ? 'Автопубликация включена' : 'Ручная публикация'}
                    </span>
                    {post.platform === 'DZEN' && extractDzenFallbackMarkdown(post as Record<string, unknown>) ? (
                      <Button variant="outline" size="sm" onClick={() => downloadDzenMarkdown(post as Record<string, unknown>)}>
                        <Download className="h-3.5 w-3.5" />
                        Экспорт в Дзен
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => {
                        setApprovalInitialPostId(String(post.id))
                        setApprovalDialogOpen(true)
                      }}
                    >
                      <FileCheck className="h-3.5 w-3.5" />
                      Согласование
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
