'use client'

import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { type ContentStatus, type Platform } from '@prisma/client'
import { type CSSProperties } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getApprovalStatus } from '@/lib/approval/workflow'

type DraggablePost = {
  id: string
  title: string
  content?: string
  platform: Platform | string
  status: ContentStatus | string
  metadata?: unknown
}

type DraggablePostCardProps = {
  post: DraggablePost
  draggingOpacity?: number
  publishTime: string
  onPublishTimeChange: (postId: string, value: string) => void
  /** Открывает окно согласования; клик не запускает перетаскивание. */
  onOpenApproval?: () => void
}

export function DraggablePostCard({
  post,
  draggingOpacity = 0.35,
  publishTime,
  onPublishTimeChange,
  onOpenApproval,
}: DraggablePostCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: post.id,
  })

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? draggingOpacity : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  }

  const hasDzenFallback = (() => {
    if (post.platform !== 'DZEN') return false
    if (!post.metadata || typeof post.metadata !== 'object' || Array.isArray(post.metadata)) return false
    const fallback = (post.metadata as Record<string, unknown>).fallback
    if (!fallback || typeof fallback !== 'object' || Array.isArray(fallback)) return false
    return (fallback as Record<string, unknown>).used === true
  })()
  const approvalStatus = getApprovalStatus(post.metadata)

  return (
    <div ref={setNodeRef} style={style} className="relative z-10" {...listeners} {...attributes}>
      <Card className="border-border">
        <CardContent className="space-y-2 p-3">
          {onOpenApproval ? (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 text-xs"
                aria-label="Открыть согласование поста"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onOpenApproval()
                }}
              >
                Согласование
              </Button>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <Badge variant="outline">{post.platform}</Badge>
            <div className="flex items-center gap-1.5">
              <Badge>{post.status}</Badge>
              {hasDzenFallback ? (
                <Badge variant="secondary" className="text-[0.6875rem]">
                  Dzen fallback
                </Badge>
              ) : null}
            </div>
          </div>
          <p className="line-clamp-2 text-sm font-medium">{post.title}</p>
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="text-[0.6875rem]">
              Approval: {approvalStatus}
            </Badge>
          </div>
          <p className="line-clamp-1 text-xs text-muted-foreground">
            {post.content?.trim() || 'Содержимое поста недоступно'}
          </p>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Время</span>
            <input
              type="time"
              value={publishTime}
              onChange={(event) => onPublishTimeChange(post.id, event.target.value)}
              onPointerDown={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
              onTouchStart={(event) => event.stopPropagation()}
              className="rounded-md border border-input bg-background px-2 py-1 text-xs"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
