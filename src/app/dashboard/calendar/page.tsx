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

export default function CalendarPage() {
  const { user, session, loading } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [posts, setPosts] = useState<any[]>([])
  const [drafts, setDrafts] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false)
  const [publishJobsProcessed, setPublishJobsProcessed] = useState<number | null>(null)

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

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <CardTitle className="text-2xl">Календарь публикаций</CardTitle>
            <CardDescription>
              Планируйте и управляйте публикациями на неделю. Перетаскивайте посты для изменения даты.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <button
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
              className="px-4 py-2 border rounded-md hover:bg-accent transition-colors"
            >
              Запустить очередь публикаций
            </button>
            <button
              onClick={() => setIsCreateFormOpen(true)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              + Новый пост
            </button>
          </div>
        </div>
        {publishJobsProcessed !== null && (
          <p className="text-sm text-muted-foreground mb-4">
            Обработано задач публикации: {publishJobsProcessed}
          </p>
        )}

        {isCreateFormOpen && (
          <Card className="mb-6">
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

        <Card>
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

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Черновики</CardTitle>
            <CardDescription>
              Посты из генератора и ручного создания. Запланируйте их через календарь или отредактируйте.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {drafts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Черновиков пока нет.</p>
            ) : (
              <div className="space-y-3">
                {drafts.slice(0, 10).map((draft) => (
                  <div key={draft.id} className="rounded-md border p-3">
                    <p className="font-medium">{draft.title ?? 'Без заголовка'}</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">{draft.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Платформа: {draft.platform}
                      {draft.brand?.name ? ` | Бренд: ${draft.brand.name}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Legend */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Легенда статусов</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-gray-500"></span>
                <span className="text-sm">Черновик (DRAFT)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                <span className="text-sm">Запланирован (SCHEDULED)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                <span className="text-sm">Опубликован (PUBLISHED)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                <span className="text-sm">Ошибка (FAILED)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-gray-400"></span>
                <span className="text-sm">Архив (ARCHIVED)</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t">
              <h4 className="font-medium mb-2">Правила смены статусов:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• DRAFT → SCHEDULED (с указанием даты не раньше +5 мин)</li>
                <li>• DRAFT → PUBLISHED (незамедлительная публикация)</li>
                <li>• SCHEDULED → PUBLISHED (только если scheduledAt ≤ now)</li>
                <li>• SCHEDULED → DRAFT (возврат в черновики)</li>
                <li>• SCHEDULED → FAILED (ошибка публикации)</li>
                <li>• FAILED → DRAFT (возврат для исправления)</li>
                <li>• PUBLISHED → ARCHIVED (архивация)</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
