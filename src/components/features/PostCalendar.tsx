'use client'

import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { restrictToWindowEdges } from '@dnd-kit/modifiers'
import { addDays, format, startOfDay } from 'date-fns'
import { ru } from 'date-fns/locale'
import { type ContentStatus, type Platform } from '@prisma/client'
import { useMemo, useState } from 'react'

import { schedulePost } from '@/lib/posts/actions'
import { DraggablePostCard } from '@/components/features/DraggablePostCard'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'

type CalendarPost = {
  id: string
  title: string
  content?: string
  platform: Platform | string
  status: ContentStatus | string
  scheduledAt: string | null
}

type PostCalendarProps = {
  initialPosts?: Array<{
    id: string
    title?: string
    content?: string
    metadata?: unknown
    platform: string
    status: string
    scheduledAt: string | Date | null
  }>
  posts?: Array<{
    id: string
    title?: string
    content?: string
    metadata?: unknown
    platform: string
    status: string
    scheduledAt: string | Date | null
  }>
  userId: string
  onPostClick?: (post: { id: string; title: string; platform: string; status: string; scheduledAt: string | Date | null }) => void
  onPostScheduled?: () => void
}

type DayColumnProps = {
  dayId: string
  label: string
  posts: CalendarPost[]
  publishTimes: Record<string, string>
  onPublishTimeChange: (postId: string, value: string) => void
}

function isDayId(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function getMetadataTitle(metadata: unknown): string {
  if (!metadata || typeof metadata !== 'object') return ''
  const maybeTitle = (metadata as { title?: unknown }).title
  return typeof maybeTitle === 'string' ? maybeTitle : ''
}

function DayColumn({ dayId, label, posts, publishTimes, onPublishTimeChange }: DayColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: dayId })

  return (
    <Card ref={setNodeRef} className={isOver ? 'border-primary' : 'border-border'}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <span>{label}</span>
          <Badge variant="outline">{posts.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {posts.length === 0 ? (
          <p className="text-xs text-muted-foreground">Нет постов</p>
        ) : (
          posts.map((post) => (
            <DraggablePostCard
              key={post.id}
              post={post}
              publishTime={publishTimes[post.id] ?? '09:00'}
              onPublishTimeChange={onPublishTimeChange}
            />
          ))
        )}
      </CardContent>
    </Card>
  )
}

function toPublishTime(isoDate: string | null): string {
  if (!isoDate) return '09:00'
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return '09:00'
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`
}

export function PostCalendar({ initialPosts, posts: legacyPosts, userId, onPostScheduled }: PostCalendarProps) {
  const { toast } = useToast()
  const sourcePosts = initialPosts ?? legacyPosts ?? []
  const [posts, setPosts] = useState<CalendarPost[]>(
    sourcePosts.map((post) => ({
      ...post,
      title:
        post.title?.trim() ||
        getMetadataTitle(post.metadata) ||
        post.content?.slice(0, 80) ||
        'Без заголовка',
      platform: post.platform as Platform,
      status: post.status as ContentStatus,
      scheduledAt:
        post.scheduledAt instanceof Date
          ? post.scheduledAt.toISOString()
          : typeof post.scheduledAt === 'string'
            ? post.scheduledAt
            : null,
    }))
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [activePostId, setActivePostId] = useState<string | null>(null)
  const [hoveredDayId, setHoveredDayId] = useState<string | null>(null)
  const [weekOffset, setWeekOffset] = useState(0)
  const [publishTimes, setPublishTimes] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      sourcePosts.map((post) => {
        const scheduledAt =
          post.scheduledAt instanceof Date
            ? post.scheduledAt.toISOString()
            : typeof post.scheduledAt === 'string'
              ? post.scheduledAt
              : null
        return [post.id, toPublishTime(scheduledAt)]
      })
    )
  )

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  )

  const days = useMemo(() => {
    const start = startOfDay(addDays(new Date(), weekOffset * 7))
    return Array.from({ length: 7 }).map((_, index) => {
      const date = addDays(start, index)
      return {
        id: format(date, 'yyyy-MM-dd'),
        label: format(date, 'EEE dd.MM', { locale: ru }),
      }
    })
  }, [weekOffset])

  const unscheduledPosts = useMemo(() => posts.filter((post) => !post.scheduledAt), [posts])
  const activePost = useMemo(
    () => (activePostId ? posts.find((post) => post.id === activePostId) ?? null : null),
    [activePostId, posts]
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActivePostId(String(event.active.id))
  }

  const handleDragOver = (event: DragOverEvent) => {
    setHoveredDayId(event.over ? String(event.over.id) : null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActivePostId(null)
    setHoveredDayId(null)
    if (!over) return

    const activeId = String(active.id)
    const rawOverId = String(over.id)
    const targetDayId = isDayId(rawOverId)
      ? rawOverId
      : (() => {
          const overPost = posts.find((post) => post.id === rawOverId)
          if (!overPost?.scheduledAt) return null
          return format(new Date(overPost.scheduledAt), 'yyyy-MM-dd')
        })()
    if (!targetDayId) {
      return
    }

    const selectedPublishTime = publishTimes[activeId] ?? '09:00'
    const [hours, minutes] = selectedPublishTime.split(':').map((part) => Number(part))
    const safeHours = Number.isFinite(hours) ? Math.min(Math.max(hours, 0), 23) : 9
    const safeMinutes = Number.isFinite(minutes) ? Math.min(Math.max(minutes, 0), 59) : 0
    const targetDateIso = new Date(`${targetDayId}T${String(safeHours).padStart(2, '0')}:${String(safeMinutes).padStart(2, '0')}:00.000Z`).toISOString()
    const previousPosts = posts
    const targetPost = posts.find((post) => post.id === activeId)
    if (!targetPost) return

    setErrorMessage(null)

    setPosts((currentPosts) =>
      currentPosts.map((post) =>
        post.id === activeId ? { ...post, scheduledAt: targetDateIso, status: 'SCHEDULED' } : post
      )
    )

    const result = await schedulePost(activeId, targetDateIso, userId)

    if (result.success) {
      onPostScheduled?.()
      toast({
        title: 'Пост запланирован',
        description: `Дата: ${format(new Date(targetDateIso), 'dd.MM.yyyy HH:mm')}`,
      })
      return
    }

    setPosts(previousPosts)
    setErrorMessage(result.error)
    toast({
      title: 'Ошибка',
      description: result.error,
      variant: 'destructive',
    })
  }

  const handlePublishTimeChange = async (postId: string, value: string) => {
    if (!/^\d{2}:\d{2}$/.test(value)) {
      return
    }

    const previousValue = publishTimes[postId] ?? '09:00'
    setPublishTimes((current) => ({ ...current, [postId]: value }))

    const targetPost = posts.find((post) => post.id === postId)
    if (!targetPost?.scheduledAt) {
      return
    }

    const scheduleDate = format(new Date(targetPost.scheduledAt), 'yyyy-MM-dd')
    const [hours, minutes] = value.split(':').map((part) => Number(part))
    const safeHours = Number.isFinite(hours) ? Math.min(Math.max(hours, 0), 23) : 9
    const safeMinutes = Number.isFinite(minutes) ? Math.min(Math.max(minutes, 0), 59) : 0
    const updatedIso = new Date(
      `${scheduleDate}T${String(safeHours).padStart(2, '0')}:${String(safeMinutes).padStart(2, '0')}:00.000Z`
    ).toISOString()

    const previousPosts = posts
    setPosts((currentPosts) =>
      currentPosts.map((post) => (post.id === postId ? { ...post, scheduledAt: updatedIso } : post))
    )

    const result = await schedulePost(postId, updatedIso, userId)
    if (result.success) {
      onPostScheduled?.()
      return
    }

    setPosts(previousPosts)
    setPublishTimes((current) => ({ ...current, [postId]: previousValue }))
    setErrorMessage(result.error)
    toast({
      title: 'Ошибка',
      description: result.error,
      variant: 'destructive',
    })
  }

  return (
    <div className="space-y-4 overflow-x-hidden">
      {errorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>Ошибка планирования</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <DndContext
        sensors={sensors}
        autoScroll={false}
        modifiers={[restrictToWindowEdges]}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-3 py-4">
              <div className="flex items-center justify-between gap-3">
                <Button variant="outline" onClick={() => setWeekOffset((value) => value - 1)}>
                  Предыдущие 7 дней
                </Button>
                <p className="text-sm text-muted-foreground">
                  {days[0]?.label} - {days[6]?.label}
                </p>
                <Button variant="outline" onClick={() => setWeekOffset((value) => value + 1)}>
                  Следующие 7 дней
                </Button>
              </div>
            </CardContent>
          </Card>

          {unscheduledPosts.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Очередь контента (без даты)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-xs text-muted-foreground">
                  Перетащите карточку в день недели, чтобы запланировать публикацию.
                </p>
                <div className="space-y-2">
                  {unscheduledPosts.map((post) => (
                    <DraggablePostCard
                      key={post.id}
                      post={post}
                      publishTime={publishTimes[post.id] ?? '09:00'}
                      onPublishTimeChange={handlePublishTimeChange}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          <div className="space-y-3">
            {days.map((day) => {
              const dayPosts = posts.filter((post) => {
                if (!post.scheduledAt) return false
                return format(new Date(post.scheduledAt), 'yyyy-MM-dd') === day.id
              })
              return (
                <DayColumn
                  key={day.id}
                  dayId={day.id}
                  label={day.label}
                  posts={dayPosts}
                  publishTimes={publishTimes}
                  onPublishTimeChange={handlePublishTimeChange}
                />
              )
            })}
          </div>
        </div>
        <DragOverlay adjustScale={false}>
          {activePost ? (
            <div className="w-64" style={{ marginLeft: 2, marginTop: 2 }}>
              <Card className="border-primary/60 shadow-xl">
                <CardContent className="space-y-2 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline">{activePost.platform}</Badge>
                    <Badge>{activePost.status}</Badge>
                  </div>
                  <p className="line-clamp-2 text-sm font-medium">{activePost.title || 'Без заголовка'}</p>
                  {hoveredDayId ? (
                    <div className="rounded-md border border-primary/30 bg-primary/5 px-2 py-1.5 text-xs">
                      Планируется:{' '}
                      {format(
                        new Date(`${hoveredDayId}T${publishTimes[activePost.id] ?? '09:00'}:00.000Z`),
                        'dd.MM.yyyy HH:mm',
                        { locale: ru }
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Перенесите карточку на день в календаре</p>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
