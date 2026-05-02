'use client'

import { useEffect, useMemo, useState } from 'react'
import { FileCheck, Loader2 } from 'lucide-react'

import { getApprovalStatus } from '@/lib/approval/workflow'
import { approvePost, rejectPost, requestPostApproval } from '@/lib/approval/actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

export type PostForApproval = {
  id: string
  content?: string | null
  platform?: string
  status?: string
  scheduledAt?: string | Date | null
  metadata?: unknown
}

type PostApprovalDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  posts: PostForApproval[]
  /** Если задан — при открытии выбирается этот пост (например, с карточки календаря). */
  initialPostId?: string | null
  onCompleted: () => void | Promise<void>
}

function extractPostTitle(metadata: unknown): string {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return ''
  const title = (metadata as Record<string, unknown>).title
  return typeof title === 'string' && title.trim().length > 0 ? title.trim() : ''
}

function approvalBadgeClass(status: string): string {
  if (status === 'APPROVED') return 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
  if (status === 'REVIEW_PENDING') return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
  if (status === 'REJECTED') return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200'
  return 'bg-secondary text-secondary-foreground'
}

function stepHint(status: ReturnType<typeof getApprovalStatus>): string {
  switch (status) {
    case 'DRAFT':
      return 'Черновик ещё не отправлен на проверку. Нажмите «На согласование», чтобы можно было одобрить пост и затем перенести его в календарь.'
    case 'REVIEW_PENDING':
      return 'Пост ждёт решения: одобрите его или отклоните с комментарием. После одобрения можно назначать дату публикации.'
    case 'REJECTED':
      return 'Пост отклонён. Отредактируйте текст при необходимости и отправьте снова на согласование.'
    case 'APPROVED':
      return 'Пост одобрён — его можно переносить в календарь и публиковать. При необходимости снова отправьте на согласование.'
    default:
      return ''
  }
}

export function PostApprovalDialog({
  open,
  onOpenChange,
  posts,
  initialPostId,
  onCompleted,
}: PostApprovalDialogProps) {
  const { toast } = useToast()
  const [selectedId, setSelectedId] = useState<string>('')
  const [rejectNote, setRejectNote] = useState('')
  const [pending, setPending] = useState(false)

  const selectedPost = useMemo(() => posts.find((p) => p.id === selectedId) ?? null, [posts, selectedId])
  const approvalStatus = selectedPost ? getApprovalStatus(selectedPost.metadata) : 'DRAFT'
  const title = selectedPost ? extractPostTitle(selectedPost.metadata) || 'Без заголовка' : ''

  useEffect(() => {
    if (!open) return
    if (initialPostId && posts.some((p) => p.id === initialPostId)) {
      setSelectedId(initialPostId)
      return
    }
    setSelectedId((current) => {
      if (current && posts.some((p) => p.id === current)) return current
      return posts[0]?.id ?? ''
    })
  }, [open, initialPostId, posts])

  useEffect(() => {
    if (!open) {
      setRejectNote('')
    }
  }, [open])

  const run = async (fn: () => ReturnType<typeof requestPostApproval>) => {
    if (!selectedId) return
    setPending(true)
    try {
      const res = await fn()
      if (!res.success) {
        toast({ title: 'Ошибка', description: res.error, variant: 'destructive' })
        return
      }
      await onCompleted()
      toast({ title: 'Готово', description: 'Статус согласования обновлён.' })
    } finally {
      setPending(false)
    }
  }

  const selectLabel = (post: PostForApproval) => {
    const st = getApprovalStatus(post.metadata)
    const t = extractPostTitle(post.metadata) || post.content?.slice(0, 48)?.trim() || 'Без названия'
    return `${t} · ${post.platform ?? '?'} · ${st}`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-4 w-[min(96vw,56rem)] max-w-[min(96vw,56rem)] sm:max-w-[min(96vw,56rem)]">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary" />
            Согласование поста
          </DialogTitle>
          <DialogDescription>
            Все шаги проверки в одном месте: отправка на согласование, одобрение и отклонение. Без одобрения пост нельзя
            поставить в расписание календаря.
          </DialogDescription>
        </DialogHeader>

        {posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Нет постов для отображения. Создайте черновик в генераторе или календаре.</p>
        ) : (
          <div className="min-w-0 space-y-4">
            <div className="min-w-0 space-y-2">
              <Label htmlFor="approval-post">Пост</Label>
              <p className="text-xs text-muted-foreground">
                В списке все загруженные посты (фильтры календаря выше на это окно не действуют).
              </p>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger id="approval-post" className="min-w-0 max-w-full [&>span]:truncate">
                  <SelectValue placeholder="Выберите пост" />
                </SelectTrigger>
                <SelectContent>
                  {posts.map((post) => (
                    <SelectItem key={post.id} value={post.id}>
                      {selectLabel(post)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedPost ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{selectedPost.platform ?? '—'}</Badge>
                  <Badge variant="outline">{selectedPost.status ?? 'DRAFT'}</Badge>
                  <Badge className={cn('text-[0.6875rem]', approvalBadgeClass(approvalStatus))}>
                    Согласование: {approvalStatus}
                  </Badge>
                </div>

                <div className="min-w-0">
                  <p className="break-words text-sm font-medium">{title}</p>
                  <p className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-border bg-muted/40 p-3 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap [overflow-wrap:anywhere]">
                    {selectedPost.content?.trim() || 'Текст поста недоступен.'}
                  </p>
                </div>

                <p className="text-sm text-muted-foreground">{stepHint(approvalStatus)}</p>

                {approvalStatus === 'REVIEW_PENDING' ? (
                  <div className="space-y-2">
                    <Label htmlFor="reject-note">Комментарий при отклонении (необязательно)</Label>
                    <Textarea
                      id="reject-note"
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      placeholder="Например: усилить призыв, убрать утверждения без источника"
                      rows={3}
                      disabled={pending}
                    />
                  </div>
                ) : null}

                <DialogFooter className="flex-col gap-2 sm:flex-col">
                  {approvalStatus === 'DRAFT' ? (
                    <Button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        run(() => requestPostApproval(selectedId))
                      }
                    >
                      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      На согласование
                    </Button>
                  ) : null}

                  {approvalStatus === 'REVIEW_PENDING' ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                      <Button
                        type="button"
                        variant="default"
                        disabled={pending}
                        onClick={() => run(() => approvePost(selectedId))}
                      >
                        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Одобрить
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={pending}
                        onClick={() =>
                          run(() => rejectPost(selectedId, rejectNote.trim() || undefined))
                        }
                      >
                        Отклонить
                      </Button>
                    </div>
                  ) : null}

                  {approvalStatus === 'REJECTED' ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={pending}
                      onClick={() => run(() => requestPostApproval(selectedId))}
                    >
                      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Снова на согласование
                    </Button>
                  ) : null}

                  {approvalStatus === 'APPROVED' ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending}
                      onClick={() => run(() => requestPostApproval(selectedId))}
                    >
                      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Снова отправить на согласование
                    </Button>
                  ) : null}
                </DialogFooter>
              </>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
