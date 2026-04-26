import * as React from 'react'
import { cn } from '@/lib/utils'

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-border bg-secondary before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.8s_ease-in-out_infinite] before:bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.24)_45%,transparent_100%)] dark:before:bg-[linear-gradient(90deg,transparent_0%,rgba(248,250,252,0.12)_45%,transparent_100%)]',
        className
      )}
      {...props}
    />
  )
}
