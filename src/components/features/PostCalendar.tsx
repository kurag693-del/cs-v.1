'use client'

import { useState, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'
import { updatePostSchedule } from '@/lib/posts/actions'

interface Post {
  id: string
  title: string
  content: string
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED' | 'ARCHIVED'
  platform: 'TWITTER' | 'LINKEDIN' | 'FACEBOOK' | 'INSTAGRAM' | 'TIKTOK' | 'YOUTUBE'
  scheduledAt: string | null
  publishedAt: string | null
  brand?: { name: string } | null
  metadata?: any
}

interface CalendarDay {
  date: Date
  posts: Post[]
}

interface PostCardProps {
  post: Post
  onEdit?: (post: Post) => void
}

function PostCard({ post }: PostCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: post.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const getStatusColor = (status: Post['status']) => {
    const colors = {
      DRAFT: 'bg-gray-500',
      SCHEDULED: 'bg-blue-500',
      PUBLISHED: 'bg-green-500',
      FAILED: 'bg-red-500',
      ARCHIVED: 'bg-gray-400',
    }
    return colors[status] || 'bg-gray-500'
  }

  const getPlatformColor = (platform: Post['platform']) => {
    const colors = {
      TWITTER: 'bg-blue-400',
      LINKEDIN: 'bg-blue-600',
      FACEBOOK: 'bg-blue-700',
      INSTAGRAM: 'bg-pink-500',
      TIKTOK: 'bg-black',
      YOUTUBE: 'bg-red-600',
    }
    return colors[platform]
  }

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return ''
    return format(new Date(dateStr), 'HH:mm')
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'p-3 mb-2 rounded-lg border bg-card text-card-foreground shadow-sm cursor-move hover:shadow-md transition-shadow',
        'hover:border-primary/50'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate">{post.title}</h4>
          {post.scheduledAt && (
            <p className="text-xs text-muted-foreground">
              {formatTime(post.scheduledAt)}
            </p>
          )}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <span className={cn('w-2 h-2 rounded-full', getStatusColor(post.status))} title={post.status} />
          <span className={cn('w-2 h-2 rounded-full', getPlatformColor(post.platform))} title={post.platform} />
        </div>
      </div>
    </div>
  )
}

function DayColumn({ day, onDropPost }: { day: CalendarDay; onDropPost: (postId: string, date: Date) => void }) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      onDropPost(active.id as string, day.date)
    }
  }

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="text-center mb-2">
        <div className="text-lg font-semibold">{format(day.date, 'd')}</div>
        <div className="text-xs text-muted-foreground">{format(day.date, 'EEE')}</div>
        {isToday(day.date) && <Badge className="mt-1">Сегодня</Badge>}
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="flex-1 min-h-[120px] max-h-[200px] overflow-y-auto rounded-md border border-dashed p-2">
          <SortableContext items={day.posts.map(p => p.id)} strategy={verticalListSortingStrategy}>
            {day.posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
            {day.posts.length === 0 && (
              <div className="text-center text-xs text-muted-foreground py-4">
                Нет публикаций
              </div>
            )}
          </SortableContext>
        </div>
      </DndContext>
    </div>
  )
}

interface PostCalendarProps {
  posts: Post[]
  userId: string
  onPostClick?: (post: Post) => void
}

export function PostCalendar({ posts, userId, onPostClick }: PostCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedPlatform, setSelectedPlatform] = useState<'ALL' | Post['platform']>('ALL')
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const { toast } = useToast()

  const exportTemplate = async (target: 'VK' | 'TELEGRAM') => {
    if (!selectedPost) return
    const payload =
      target === 'VK'
        ? `Пост для VK\n\n${selectedPost.title}\n\n${selectedPost.content}`
        : `Пост для Telegram\n\n${selectedPost.title}\n\n${selectedPost.content}`
    await navigator.clipboard.writeText(payload)
    toast({
      title: `Скопировано для ${target}`,
      description: 'Шаблон публикации скопирован в буфер',
    })
  }

  const downloadTemplate = () => {
    if (!selectedPost) return
    const body = `${selectedPost.title}\n\n${selectedPost.content}`
    const blob = new Blob([body], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `post-${selectedPost.id}.txt`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const queuePublish = async (target: 'VK' | 'TELEGRAM') => {
    if (!selectedPost) return
    const response = await fetch('/api/publish/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        postId: selectedPost.id,
        target,
      }),
    })

    const result = await response.json()
    if (result.success) {
      toast({
        title: `Поставлено в очередь (${target})`,
        description: 'Задание автопубликации создано',
      })
      return
    }

    toast({
      title: 'Ошибка очереди публикации',
      description: result?.error?.message ?? 'Не удалось поставить задачу в очередь',
      variant: 'destructive',
    })
  }

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })

  const filteredPosts = posts.filter((post) => {
    if (selectedPlatform === 'ALL') return true
    return post.platform === selectedPlatform
  })

  const daysWithPosts: CalendarDay[] = days.map((date) => ({
    date,
    posts: filteredPosts.filter((post) => {
      if (!post.scheduledAt) return false
      const postDate = new Date(post.scheduledAt)
      return isSameDay(postDate, date)
    }),
  }))

  const handleDropPost = async (postId: string, date: Date) => {
    // Set time to 9:00 AM by default for dropped posts
    const scheduledAt = new Date(date)
    scheduledAt.setHours(9, 0, 0, 0)

    if (scheduledAt < new Date(Date.now() + 5 * 60 * 1000)) {
      toast({
        title: 'Ошибка',
        description: 'Дата публикации должна быть не ранее 5 минут от текущего времени',
        variant: 'destructive',
      })
      return
    }

    const result = await updatePostSchedule(
      new FormData() as any,
      userId
    )

    // Manual FormData construction
    const formData = new FormData()
    formData.set('postId', postId)
    formData.set('scheduledAt', scheduledAt.toISOString())
    formData.set('platform', 'TWITTER') // Default, should come from post

    // @ts-ignore - we need a better way
    const updateResult = await updatePostSchedule(formData, userId)

    if (updateResult.success) {
      toast({
        title: 'Успешно',
        description: `Пост запланирован на ${format(scheduledAt, 'dd.MM.yyyy HH:mm')}`,
        variant: 'default',
      })
    } else {
      toast({
        title: 'Ошибка',
        description: updateResult.error,
        variant: 'destructive',
      })
    }
  }

  const handlePostClick = (post: Post) => {
    setSelectedPost(post)
    setIsPreviewOpen(true)
    onPostClick?.(post)
  }

  const handleStatusChange = async (postId: string, newStatus: Post['status']) => {
    const formData = new FormData()
    formData.set('postId', postId)
    formData.set('status', newStatus)

    // @ts-ignore
    const result = await (window as any).updatePostStatus?.(formData, userId)

    if (result?.success) {
      toast({
        title: 'Успешно',
        description: `Статус изменен на "${newStatus}"`,
        variant: 'default',
      })
      setIsPreviewOpen(false)
    } else {
      toast({
        title: 'Ошибка',
        description: result?.error || 'Не удалось изменить статус',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => setCurrentDate(addDays(currentDate, -7))}
          >
            ←
          </Button>
          <h2 className="text-lg font-semibold">
            {format(weekStart, 'dd MMM')} - {format(weekEnd, 'dd MMM, yyyy')}
          </h2>
          <Button
            variant="outline"
            onClick={() => setCurrentDate(addDays(currentDate, 7))}
          >
            →
          </Button>
          <Button
            variant="ghost"
            onClick={() => setCurrentDate(new Date())}
          >
            Сегодня
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Платформа:</span>
          <Select
            value={selectedPlatform}
            onValueChange={(value) => setSelectedPlatform(value as any)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Все" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Все</SelectItem>
              <SelectItem value="TWITTER">Твиттер</SelectItem>
              <SelectItem value="LINKEDIN">LinkedIn</SelectItem>
              <SelectItem value="FACEBOOK">Фейсбук</SelectItem>
              <SelectItem value="INSTAGRAM">Instagram</SelectItem>
              <SelectItem value="TIKTOK">TikTok</SelectItem>
              <SelectItem value="YOUTUBE">Ютуб</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-7 gap-4">
            {daysWithPosts.map((day) => (
              <DayColumn
                key={day.date.toISOString()}
                day={day}
                onDropPost={handleDropPost}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedPost?.title}</DialogTitle>
            <DialogDescription>
              Платформа: {selectedPost?.platform} | Статус: {selectedPost?.status}
            </DialogDescription>
          </DialogHeader>
          {selectedPost && (
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <p className="whitespace-pre-wrap">{selectedPost.content}</p>
                  {selectedPost.brand && (
                    <Badge variant="outline" className="mt-2">
                      {selectedPost.brand.name}
                    </Badge>
                  )}
                </CardContent>
              </Card>

              <div className="flex gap-2">
                {selectedPost.status === 'DRAFT' && (
                  <Button
                    onClick={() => handleStatusChange(selectedPost.id, 'SCHEDULED')}
                  >
                    Запланировать
                  </Button>
                )}
                {selectedPost.status === 'SCHEDULED' && (
                  <>
                    <Button
                      onClick={() => handleStatusChange(selectedPost.id, 'PUBLISHED')}
                    >
                      Опубликовать сейчас
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleStatusChange(selectedPost.id, 'DRAFT')}
                    >
                      В черновик
                    </Button>
                  </>
                )}
                {selectedPost.status === 'PUBLISHED' && (
                  <Button
                    variant="outline"
                    onClick={() => handleStatusChange(selectedPost.id, 'ARCHIVED')}
                  >
                    Архивировать
                  </Button>
                )}
                {selectedPost.status === 'FAILED' && (
                  <Button
                    variant="outline"
                    onClick={() => handleStatusChange(selectedPost.id, 'DRAFT')}
                  >
                    В черновик
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <Button variant="outline" onClick={() => exportTemplate('VK')}>
                  Экспорт VK (копировать)
                </Button>
                <Button variant="outline" onClick={() => exportTemplate('TELEGRAM')}>
                  Экспорт Telegram (копировать)
                </Button>
                <Button variant="outline" onClick={downloadTemplate}>
                  Скачать .txt
                </Button>
                <Button variant="outline" onClick={() => queuePublish('VK')}>
                  В очередь VK
                </Button>
                <Button variant="outline" onClick={() => queuePublish('TELEGRAM')}>
                  В очередь Telegram
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
