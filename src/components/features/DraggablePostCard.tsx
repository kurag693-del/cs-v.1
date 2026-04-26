'use client'

import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { type ContentStatus, type Platform } from '@prisma/client'
import { type CSSProperties } from 'react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

type DraggablePost = {
  id: string
  title: string
  content?: string
  platform: Platform | string
  status: ContentStatus | string
}

type DraggablePostCardProps = {
  post: DraggablePost
  draggingOpacity?: number
  publishTime: string
  onPublishTimeChange: (postId: string, value: string) => void
}

export function DraggablePostCard({
  post,
  draggingOpacity = 0.35,
  publishTime,
  onPublishTimeChange,
}: DraggablePostCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: post.id,
  })

  const style: CSSProperties = {
    transform: isDragging ? undefined : CSS.Translate.toString(transform),
    opacity: isDragging ? draggingOpacity : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  }

  return (
    <div ref={setNodeRef} style={style} className="relative z-10" {...listeners} {...attributes}>
      <Card className="border-border">
        <CardContent className="space-y-2 p-3">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="outline">{post.platform}</Badge>
            <Badge>{post.status}</Badge>
          </div>
          <p className="line-clamp-2 text-sm font-medium">{post.title}</p>
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
